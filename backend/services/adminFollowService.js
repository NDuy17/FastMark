const User = require("../models/User");
const Follow = require("../models/Follow");
const ShopProfile = require("../models/ShopProfile");
const { USER_ROLE, USER_STATUS, SHOP_STATUS } = require("../constants");
const {
  resolveShopDisplayName,
  resolveShopUsername,
  resolveShopAvatar,
} = require("../utils/shopIdentity");
const { matchesNormalizedSearch } = require("../utils/adminSearchHelpers");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickString(value) {
  return String(value || "").trim();
}

function parsePagination(query = {}, defaultLimit = 20) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

function buildPagination(page, limit, total) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

async function assertViewableUser(userId) {
  const user = await User.findById(userId).lean();
  if (!user) {
    throw createServiceError("Không tìm thấy tài khoản.", 404);
  }
  if (user.Role === USER_ROLE.ADMIN) {
    throw createServiceError("Không thể xem follow của tài khoản quản trị.", 403);
  }
  return user;
}

async function assertViewableShop(shopId) {
  const shop = await ShopProfile.findById(shopId).select("userId").lean();
  if (!shop) {
    throw createServiceError("Không tìm thấy gian hàng.", 404);
  }
  return shop;
}

function toAdminFollowItem(user, shop = null, extra = {}) {
  return {
    id: String(user._id),
    userId: String(user._id),
    fullName: user.FullName || "",
    userName: user.UserName || "",
    avatar: user.Avatar || "",
    shopId: shop?._id ? String(shop._id) : "",
    shopName: resolveShopDisplayName(shop, user),
    shopUsername: resolveShopUsername(shop, user),
    shopAvatar: resolveShopAvatar(shop, user),
    followedAt: extra.followedAt || null,
  };
}

async function loadShopsByUserIds(userIds) {
  if (!userIds.length) {
    return new Map();
  }
  const shops = await ShopProfile.find({
    userId: { $in: userIds },
    status: { $ne: SHOP_STATUS.BLOCKED },
  }).lean();
  return new Map(shops.map((shop) => [String(shop.userId), shop]));
}

async function listUserFollowing(userId, query = {}) {
  await assertViewableUser(userId);
  const { page, limit, skip } = parsePagination(query);
  const search = pickString(query.search || query.q);
  const filter = { followerId: userId };

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
  const shopByUserId = await loadShopsByUserIds(userIds);

  let items = rows
    .map((row) => {
      const user = userById.get(String(row.followedUserId));
      if (!user) {
        return null;
      }
      const shop = shopByUserId.get(String(user._id)) || null;
      return toAdminFollowItem(user, shop, { followedAt: row.CreatedAt });
    })
    .filter(Boolean);

  if (search) {
    items = items.filter((item) =>
      matchesNormalizedSearch(
        `${item.fullName} ${item.userName} ${item.shopName} ${item.shopUsername}`,
        search
      )
    );
  }

  return {
    type: "following",
    userId: String(userId),
    items,
    pagination: buildPagination(page, limit, total),
  };
}

async function listUserFollowers(userId, query = {}) {
  await assertViewableUser(userId);
  const { page, limit, skip } = parsePagination(query);
  const search = pickString(query.search || query.q);
  const filter = { followedUserId: userId };

  const [rows, total] = await Promise.all([
    Follow.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(limit).lean(),
    Follow.countDocuments(filter),
  ]);

  const userIds = rows.map((row) => row.followerId).filter(Boolean);
  const users = userIds.length
    ? await User.find({
        _id: { $in: userIds },
        Status: { $ne: USER_STATUS.BLOCKED },
      }).lean()
    : [];
  const userById = new Map(users.map((user) => [String(user._id), user]));
  const shopByUserId = await loadShopsByUserIds(userIds);

  let items = rows
    .map((row) => {
      const user = userById.get(String(row.followerId));
      if (!user) {
        return null;
      }
      const shop = shopByUserId.get(String(user._id)) || null;
      return toAdminFollowItem(user, shop, { followedAt: row.CreatedAt });
    })
    .filter(Boolean);

  if (search) {
    items = items.filter((item) =>
      matchesNormalizedSearch(
        `${item.fullName} ${item.userName} ${item.shopName} ${item.shopUsername}`,
        search
      )
    );
  }

  return {
    type: "followers",
    userId: String(userId),
    items,
    pagination: buildPagination(page, limit, total),
  };
}

async function listShopFollowing(shopId, query = {}) {
  const shop = await assertViewableShop(shopId);
  const data = await listUserFollowing(String(shop.userId), query);
  return { ...data, shopId: String(shopId) };
}

async function listShopFollowers(shopId, query = {}) {
  const shop = await assertViewableShop(shopId);
  const data = await listUserFollowers(String(shop.userId), query);
  return { ...data, shopId: String(shopId) };
}

module.exports = {
  listUserFollowing,
  listUserFollowers,
  listShopFollowing,
  listShopFollowers,
};
