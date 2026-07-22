const mongoose = require("mongoose");
const User = require("../models/User");
const Follow = require("../models/Follow");
const ShopProfile = require("../models/ShopProfile");
const { USER_STATUS } = require("../constants");
const { SHOP_STATUS } = require("../constants");
const { createNotification } = require("./notificationService");
const { NOTIFICATION_AUDIENCE } = require("../constants");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickString(value) {
  return String(value || "").trim();
}

function isStrictMongoObjectId(value) {
  return /^[a-f\d]{24}$/i.test(pickString(value));
}

function toObjectId(value) {
  const text = pickString(value);
  if (!isStrictMongoObjectId(text)) {
    return null;
  }
  return new mongoose.Types.ObjectId(text);
}

function parsePagination(query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

/**
 * Resolve user được follow từ: userId / followedUserId / shopId (→ chủ shop).
 */
async function resolveFollowedUserId(payload = {}) {
  const candidates = [
    payload.followedUserId,
    payload.userId,
    payload.sellerUserId,
    payload.targetId,
    payload.id,
    payload.shopId,
  ]
    .map(pickString)
    .filter(Boolean);

  if (candidates.length === 0) {
    throw createServiceError("Thiếu followedUserId hoặc shopId.", 400);
  }

  for (const candidate of candidates) {
    if (!isStrictMongoObjectId(candidate)) {
      continue;
    }

    const asUser = await User.findById(candidate).select("_id Status").lean();
    if (asUser?._id && Number(asUser.Status) !== USER_STATUS.BLOCKED) {
      return String(asUser._id);
    }

    const asShop = await ShopProfile.findById(candidate).select("userId status").lean();
    if (asShop?.userId && Number(asShop.status) !== SHOP_STATUS.BLOCKED) {
      return String(asShop.userId);
    }
  }

  throw createServiceError("Không tìm thấy người dùng tương ứng.", 404);
}

async function getActiveUser(userId) {
  const user = await User.findById(userId);
  if (!user || Number(user.Status) === USER_STATUS.BLOCKED) {
    throw createServiceError("Không tìm thấy người dùng.", 404);
  }
  return user;
}

async function getShopForUser(userId) {
  if (!userId) {
    return null;
  }
  return ShopProfile.findOne({
    userId,
    status: { $ne: SHOP_STATUS.BLOCKED },
  })
    .sort({ CreatedAt: -1 })
    .lean();
}

function toClientUserCard(user, extra = {}, shop = null) {
  return {
    id: String(user._id),
    userId: String(user._id),
    followedUserId: String(user._id),
    fullName: user.FullName || "",
    userName: user.UserName || "",
    avatar: user.Avatar || "",
    followersCount: Number(user.FollowersCount) || 0,
    followingCount: Number(user.FollowingCount) || 0,
    // Tương thích UI cũ từng hiện shop khi follow seller.
    shopId: shop?._id ? String(shop._id) : "",
    shopName: shop?.shopName || user.FullName || "",
    shopUsername: shop?.shopUsername || user.UserName || "",
    shopAvatar: user.Avatar || "",
    address: shop?.addressHeThong || shop?.address || shop?.DiaChiHeThong || "",
    averageRating: Number(shop?.averageRating) || 0,
    totalProducts: Number(shop?.totalProducts) || 0,
    ...extra,
  };
}

async function hasFollow(followerId, followedUserId) {
  const followerObjectId = toObjectId(followerId);
  const followedObjectId = toObjectId(followedUserId);
  if (!followerObjectId || !followedObjectId) {
    return false;
  }
  return Boolean(
    await Follow.exists({
      followerId: followerObjectId,
      followedUserId: followedObjectId,
    })
  );
}

async function runInOptionalTransaction(work) {
  let session = null;
  try {
    session = await mongoose.startSession();
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (error) {
    const message = String(error?.message || "");
    const needsFallback =
      /transaction|replica set|not supported|IllegalOperation/i.test(message) ||
      error?.code === 20 ||
      error?.codeName === "IllegalOperation";
    if (!needsFallback || !work) {
      throw error;
    }
    return work(null);
  } finally {
    if (session) {
      session.endSession();
    }
  }
}

async function followUser(currentUser, payload = {}) {
  const followedUserId = await resolveFollowedUserId(payload);
  const target = await getActiveUser(followedUserId);
  const followerObjectId = toObjectId(currentUser._id);
  const followedObjectId = toObjectId(target._id);

  if (String(target._id) === String(currentUser._id)) {
    throw createServiceError("Không thể tự theo dõi chính mình.", 400);
  }

  if (await hasFollow(followerObjectId, followedObjectId)) {
    throw createServiceError("Bạn đã theo dõi người này.", 409);
  }

  let followDoc = null;

  try {
    await runInOptionalTransaction(async (session) => {
      const now = new Date();
      const options = session ? { session } : undefined;
      const [created] = await Follow.create(
        [
          {
            followerId: followerObjectId,
            followedUserId: followedObjectId,
            CreatedAt: now,
          },
        ],
        options || {}
      );
      followDoc = created;

      await User.updateOne(
        { _id: followerObjectId },
        { $inc: { FollowingCount: 1 }, $set: { UpdatedAt: now } },
        options
      );
      await User.updateOne(
        { _id: followedObjectId },
        { $inc: { FollowersCount: 1 }, $set: { UpdatedAt: now } },
        options
      );

      // Đồng bộ counter shop nếu target là seller (UI cũ).
      const shopQuery = ShopProfile.findOne({ userId: followedObjectId }).select("_id");
      if (session) {
        shopQuery.session(session);
      }
      const shop = await shopQuery;
      if (shop?._id) {
        await ShopProfile.updateOne(
          { _id: shop._id },
          { $inc: { followersCount: 1 }, $set: { UpdatedAt: now } },
          options
        );
      }
    });
  } catch (error) {
    if (error?.code === 11000 || error?.statusCode === 409) {
      throw createServiceError("Bạn đã theo dõi người này.", 409);
    }
    throw error;
  }

  const followerName = currentUser.FullName || currentUser.UserName || "Một người dùng";
  await createNotification(target._id, {
    title: "Có người theo dõi bạn",
    content: `${followerName} vừa theo dõi bạn.`,
    audience: NOTIFICATION_AUDIENCE.SYSTEM,
  });

  const [freshFollower, freshTarget, shop] = await Promise.all([
    User.findById(currentUser._id).lean(),
    User.findById(target._id).lean(),
    getShopForUser(target._id),
  ]);

  return {
    isFollowing: true,
    followId: followDoc?._id ? String(followDoc._id) : "",
    followedUserId: String(target._id),
    shopId: shop?._id ? String(shop._id) : "",
    user: toClientUserCard(freshTarget || target, {}, shop),
    shop: shop ? toClientUserCard(freshTarget || target, {}, shop) : null,
    followersCount: Number(freshTarget?.FollowersCount) || 0,
    followingCount: Number(freshFollower?.FollowingCount) || 0,
  };
}

async function unfollowUser(currentUser, payload = {}) {
  const followedUserId = await resolveFollowedUserId(payload);
  const followerObjectId = toObjectId(currentUser._id);
  const followedObjectId = toObjectId(followedUserId);

  if (!followerObjectId || !followedObjectId) {
    throw createServiceError("Mã người dùng không hợp lệ.", 400);
  }

  let removed = null;

  await runInOptionalTransaction(async (session) => {
    const options = session ? { session } : undefined;
    removed = await Follow.findOneAndDelete(
      {
        followerId: followerObjectId,
        followedUserId: followedObjectId,
      },
      options
    );

    if (!removed) {
      return;
    }

    const now = new Date();
    await User.updateOne(
      { _id: followerObjectId, FollowingCount: { $gt: 0 } },
      { $inc: { FollowingCount: -1 }, $set: { UpdatedAt: now } },
      options
    );
    await User.updateOne(
      { _id: followedObjectId, FollowersCount: { $gt: 0 } },
      { $inc: { FollowersCount: -1 }, $set: { UpdatedAt: now } },
      options
    );

    const shopQuery = ShopProfile.findOne({ userId: followedObjectId }).select("_id");
    if (session) {
      shopQuery.session(session);
    }
    const shop = await shopQuery;
    if (shop?._id) {
      await ShopProfile.updateOne(
        { _id: shop._id, followersCount: { $gt: 0 } },
        { $inc: { followersCount: -1 }, $set: { UpdatedAt: now } },
        options
      );
    }
  });

  const [freshFollower, freshTarget, shop] = await Promise.all([
    User.findById(currentUser._id).lean(),
    User.findById(followedUserId).lean(),
    getShopForUser(followedUserId),
  ]);

  return {
    isFollowing: false,
    followedUserId: String(followedUserId),
    shopId: shop?._id ? String(shop._id) : "",
    user: freshTarget ? toClientUserCard(freshTarget, {}, shop) : null,
    shop: freshTarget && shop ? toClientUserCard(freshTarget, {}, shop) : null,
    followersCount: Number(freshTarget?.FollowersCount) || 0,
    followingCount: Number(freshFollower?.FollowingCount) || 0,
  };
}

async function getFollowStatus(currentUser, payload = {}) {
  const followedUserId = await resolveFollowedUserId(payload);
  const followerObjectId = toObjectId(currentUser._id);
  const followedObjectId = toObjectId(followedUserId);

  const isFollowing = Boolean(
    followerObjectId &&
      followedObjectId &&
      (await Follow.exists({
        followerId: followerObjectId,
        followedUserId: followedObjectId,
      }))
  );

  const [target, shop] = await Promise.all([
    User.findById(followedUserId).select("FollowersCount").lean(),
    getShopForUser(followedUserId),
  ]);

  return {
    followedUserId: String(followedUserId),
    shopId: shop?._id ? String(shop._id) : "",
    isFollowing,
    followersCount: Number(target?.FollowersCount) || Number(shop?.followersCount) || 0,
  };
}

async function listFollowing(currentUser, query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const search = pickString(query.search || query.q).toLowerCase();
  const followerObjectId = toObjectId(currentUser._id);

  const filter = { followerId: followerObjectId || currentUser._id };
  const [rows, total] = await Promise.all([
    Follow.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(limit).lean(),
    Follow.countDocuments(filter),
  ]);

  const userIds = rows.map((row) => row.followedUserId).filter(Boolean);
  const users = userIds.length
    ? await User.find({
        _id: { $in: userIds },
        Status: { $ne: USER_STATUS.BLOCKED },
      }).lean()
    : [];
  const userById = new Map(users.map((user) => [String(user._id), user]));

  const shops = userIds.length
    ? await ShopProfile.find({
        userId: { $in: userIds },
        status: { $ne: SHOP_STATUS.BLOCKED },
      }).lean()
    : [];
  const shopByUserId = new Map(shops.map((shop) => [String(shop.userId), shop]));

  let items = rows
    .map((row) => {
      const user = userById.get(String(row.followedUserId));
      if (!user) {
        return null;
      }
      const shop = shopByUserId.get(String(user._id)) || null;
      return toClientUserCard(
        user,
        {
          followedAt: row.CreatedAt,
          isFollowing: true,
        },
        shop
      );
    })
    .filter(Boolean);

  if (search) {
    items = items.filter((item) => {
      const haystack =
        `${item.fullName} ${item.userName} ${item.shopName} ${item.shopUsername}`.toLowerCase();
      return haystack.includes(search);
    });
  }

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

async function listFollowers(currentUser, query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const search = pickString(query.search || query.q).toLowerCase();

  // Mặc định: followers của chính mình. Có thể truyền followedUserId/shopId để xem của người khác (chỉ chủ).
  let targetUserId = pickString(query.followedUserId || query.userId);
  if (!targetUserId && pickString(query.shopId)) {
    targetUserId = await resolveFollowedUserId({ shopId: query.shopId });
  }
  if (!targetUserId) {
    targetUserId = String(currentUser._id);
  }

  if (String(targetUserId) !== String(currentUser._id)) {
    throw createServiceError("Chỉ xem được danh sách người theo dõi của chính mình.", 403);
  }

  const followedObjectId = toObjectId(targetUserId);
  const filter = { followedUserId: followedObjectId || targetUserId };
  const [rows, total] = await Promise.all([
    Follow.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(limit).lean(),
    Follow.countDocuments(filter),
  ]);

  const userIds = rows.map((row) => row.followerId).filter(Boolean);
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds }, Status: { $ne: USER_STATUS.BLOCKED } }).lean()
    : [];
  const userById = new Map(users.map((user) => [String(user._id), user]));

  let items = rows
    .map((row) => {
      const user = userById.get(String(row.followerId));
      if (!user) {
        return null;
      }
      return toClientUserCard(user, {
        followedAt: row.CreatedAt,
      });
    })
    .filter(Boolean);

  if (search) {
    items = items.filter((item) => {
      const haystack = `${item.fullName} ${item.userName}`.toLowerCase();
      return haystack.includes(search);
    });
  }

  return {
    followedUserId: String(targetUserId),
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

// Alias tương thích controller cũ (followShop / unfollowShop).
const followShop = followUser;
const unfollowShop = unfollowUser;

module.exports = {
  followUser,
  unfollowUser,
  followShop,
  unfollowShop,
  getFollowStatus,
  listFollowing,
  listFollowers,
};
