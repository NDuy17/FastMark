const ShopProfile = require("../models/ShopProfile");
const SellerVerification = require("../models/SellerVerification");
const User = require("../models/User");
const { SELLER_VERIFICATION_STATUS } = require("../constants");

const SHOP_USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

function pickString(value) {
  return String(value || "").trim();
}

function escapeRegex(value) {
  return pickString(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeShopName(value) {
  return pickString(value).replace(/\s+/g, " ");
}

function normalizeShopUsername(value) {
  return pickString(value).toLowerCase();
}

function resolveShopDisplayName(shop, owner = null) {
  return (
    pickString(shop?.shopName) ||
    pickString(owner?.FullName) ||
    pickString(owner?.UserName) ||
    "Gian hàng"
  );
}

function resolveShopUsername(shop, owner = null) {
  return pickString(shop?.shopUsername) || pickString(owner?.UserName) || "";
}

function resolveShopAvatar(shop, owner = null) {
  return (
    pickString(shop?.avatar) ||
    pickString(shop?.shopAvatar) ||
    pickString(owner?.Avatar) ||
    pickString(owner?.avatar) ||
    ""
  );
}

function assertShopNameValid(shopName) {
  const normalized = normalizeShopName(shopName);
  if (normalized.length < 2 || normalized.length > 80) {
    const error = new Error("Tên gian hàng phải từ 2-80 ký tự.");
    error.statusCode = 400;
    throw error;
  }
  return normalized;
}

async function assertShopUsernameAvailable(shopUsername, userId) {
  const normalized = normalizeShopUsername(shopUsername);

  if (!SHOP_USERNAME_PATTERN.test(normalized)) {
    const error = new Error(
      "Username shop phải từ 3-30 ký tự, chỉ chữ thường, số và dấu gạch dưới."
    );
    error.statusCode = 400;
    throw error;
  }

  const existingUserName = await User.findOne({
    UserName: { $regex: `^${escapeRegex(normalized)}$`, $options: "i" },
  }).lean();
  if (existingUserName) {
    const error = new Error("Username shop đã được sử dụng.");
    error.statusCode = 409;
    throw error;
  }

  const existingShop = await ShopProfile.findOne({
    shopUsername: { $regex: `^${escapeRegex(normalized)}$`, $options: "i" },
  }).lean();
  if (existingShop && String(existingShop.userId) !== String(userId)) {
    const error = new Error("Username shop đã được sử dụng.");
    error.statusCode = 409;
    throw error;
  }

  const pendingVerification = await SellerVerification.findOne({
    shopUsername: { $regex: `^${escapeRegex(normalized)}$`, $options: "i" },
    status: SELLER_VERIFICATION_STATUS.PENDING,
    userId: { $ne: userId },
  }).lean();

  if (pendingVerification) {
    const error = new Error("Username shop đã được sử dụng.");
    error.statusCode = 409;
    throw error;
  }

  return normalized;
}

module.exports = {
  SHOP_USERNAME_PATTERN,
  pickString,
  normalizeShopName,
  normalizeShopUsername,
  resolveShopDisplayName,
  resolveShopUsername,
  resolveShopAvatar,
  assertShopNameValid,
  assertShopUsernameAvailable,
};
