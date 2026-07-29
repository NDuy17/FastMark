const User = require("../models/User");
const Follow = require("../models/Follow");
const ShopProfile = require("../models/ShopProfile");
const { USER_ROLE, USER_STATUS, SHOP_STATUS } = require("../constants");
const { buildSearchRegex } = require("../utils/searchText");
const {
  resolveShopDisplayName,
  resolveShopUsername,
  resolveShopAvatar,
} = require("../utils/shopIdentity");
const { getFollowStatus } = require("./userFollowService");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickString(value) {
  return String(value || "").trim();
}

function toUserCard(user, shop = null) {
  return {
    id: String(user._id),
    userId: String(user._id),
    fullName: user.FullName || "",
    userName: user.UserName || "",
    avatar: user.Avatar || "",
    followersCount: Number(user.FollowersCount) || 0,
    followingCount: Number(user.FollowingCount) || 0,
    shopId: shop?._id ? String(shop._id) : "",
    shopName: shop ? resolveShopDisplayName(shop, user) : "",
    shopUsername: shop ? resolveShopUsername(shop, user) : "",
    shopAvatar: shop ? resolveShopAvatar(shop, user) : "",
  };
}

function parsePagination(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

async function searchUsers(currentUser, query = {}) {
  const keyword = pickString(query.search || query.q);
  const { page, limit, skip } = parsePagination(query);
  const regex = buildSearchRegex(keyword);

  if (!regex) {
    return {
      items: [],
      pagination: { page, limit, total: 0, totalPages: 1 },
    };
  }

  const filter = {
    Status: USER_STATUS.ACTIVE,
    Role: { $in: [USER_ROLE.BUYER, USER_ROLE.SELLER] },
    $or: [{ FullName: regex }, { UserName: regex }],
  };

  if (currentUser?._id) {
    filter._id = { $ne: currentUser._id };
  }

  const [rows, total] = await Promise.all([
    User.find(filter)
      .select("FullName UserName Avatar FollowersCount FollowingCount Role")
      .sort({ FollowersCount: -1, CreatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  const userIds = rows.map((row) => row._id);
  const shops = userIds.length
    ? await ShopProfile.find({
        userId: { $in: userIds },
        status: { $ne: SHOP_STATUS.BLOCKED },
      })
        .select("userId shopName shopUsername avatar followersCount")
        .lean()
    : [];
  const shopByUserId = new Map(shops.map((shop) => [String(shop.userId), shop]));

  const items = rows.map((user) =>
    toUserCard(user, shopByUserId.get(String(user._id)) || null)
  );

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

async function getPublicUserProfile(currentUser, userIdInput) {
  const userId = pickString(userIdInput);
  if (!userId) {
    throw createServiceError("Thiếu mã người dùng.", 400);
  }

  const user = await User.findById(userId).lean();
  if (!user || Number(user.Status) === USER_STATUS.BLOCKED) {
    throw createServiceError("Không tìm thấy người dùng.", 404);
  }
  if (Number(user.Role) === USER_ROLE.ADMIN) {
    throw createServiceError("Không tìm thấy người dùng.", 404);
  }

  const shop = await ShopProfile.findOne({
    userId: user._id,
    status: { $ne: SHOP_STATUS.BLOCKED },
  }).lean();

  let followMeta = {
    isFollowing: false,
    followersCount: Number(user.FollowersCount) || 0,
    followingCount: Number(user.FollowingCount) || 0,
    shopId: shop?._id ? String(shop._id) : "",
  };

  if (currentUser?._id) {
    const status = await getFollowStatus(currentUser, { followedUserId: userId });
    followMeta = {
      ...status,
      followingCount: Number(user.FollowingCount) || 0,
    };
  }

  return {
    user: toUserCard(user, shop),
    ...followMeta,
    isSelf: Boolean(currentUser?._id && String(currentUser._id) === String(user._id)),
  };
}

async function listPublicUserFollowing(userIdInput, query = {}) {
  const userId = pickString(userIdInput);
  if (!userId) {
    throw createServiceError("Thiếu mã người dùng.", 400);
  }

  const user = await User.findById(userId).select("_id Status Role").lean();
  if (!user || Number(user.Status) === USER_STATUS.BLOCKED) {
    throw createServiceError("Không tìm thấy người dùng.", 404);
  }
  if (Number(user.Role) === USER_ROLE.ADMIN) {
    throw createServiceError("Không tìm thấy người dùng.", 404);
  }

  const { page, limit, skip } = parsePagination(query);
  const filter = { followerId: user._id };
  const [rows, total] = await Promise.all([
    Follow.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(limit).lean(),
    Follow.countDocuments(filter),
  ]);

  const followedUserIds = rows.map((row) => row.followedUserId).filter(Boolean);
  const users = followedUserIds.length
    ? await User.find({
        _id: { $in: followedUserIds },
        Status: { $ne: USER_STATUS.BLOCKED },
        Role: { $ne: USER_ROLE.ADMIN },
      })
        .select("FullName UserName Avatar FollowersCount FollowingCount")
        .lean()
    : [];
  const userById = new Map(users.map((row) => [String(row._id), row]));

  const shops = followedUserIds.length
    ? await ShopProfile.find({
        userId: { $in: followedUserIds },
        status: { $ne: SHOP_STATUS.BLOCKED },
      })
        .select("userId shopName shopUsername avatar followersCount")
        .lean()
    : [];
  const shopByUserId = new Map(shops.map((shop) => [String(shop.userId), shop]));

  const items = rows
    .map((row) => {
      const followedUser = userById.get(String(row.followedUserId));
      if (!followedUser) {
        return null;
      }
      return toUserCard(followedUser, shopByUserId.get(String(followedUser._id)) || null);
    })
    .filter(Boolean);

  return {
    userId: String(user._id),
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

module.exports = {
  searchUsers,
  getPublicUserProfile,
  listPublicUserFollowing,
};
