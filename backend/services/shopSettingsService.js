const ShopProfile = require("../models/ShopProfile");
const SellerVerification = require("../models/SellerVerification");
const User = require("../models/User");
const { SHOP_OPEN } = require("../constants");
const { SELLER_VERIFICATION_STATUS } = require("../constants");
const { isSubscriptionActive } = require("../constants");

const SHOP_USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickString(value) {
  return String(value || "").trim();
}

function normalizeShopName(value) {
  return pickString(value).replace(/\s+/g, " ");
}

function normalizeShopUsername(value) {
  return pickString(value).toLowerCase();
}

function assertShopNameValid(shopName) {
  const normalized = normalizeShopName(shopName);
  if (normalized.length < 2 || normalized.length > 80) {
    throw createServiceError("Tên gian hàng phải từ 2-80 ký tự.");
  }
  return normalized;
}

async function assertShopUsernameAvailable(shopUsername, userId) {
  const normalized = normalizeShopUsername(shopUsername);

  if (!SHOP_USERNAME_PATTERN.test(normalized)) {
    throw createServiceError(
      "Username shop phải từ 3-30 ký tự, chỉ chữ thường, số và dấu gạch dưới."
    );
  }

  const existingUserName = await User.findOne({
    UserName: {
      $regex: `^${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
      $options: "i",
    },
  }).lean();
  if (existingUserName) {
    throw createServiceError("Username shop đã được sử dụng.");
  }

  const existingShop = await ShopProfile.findOne({ shopUsername: normalized }).lean();
  if (existingShop && String(existingShop.userId) !== String(userId)) {
    throw createServiceError("Username shop đã được sử dụng.");
  }

  const pendingVerification = await SellerVerification.findOne({
    shopUsername: normalized,
    status: SELLER_VERIFICATION_STATUS.PENDING,
    userId: { $ne: userId },
  }).lean();

  if (pendingVerification) {
    throw createServiceError("Username shop đã được sử dụng.");
  }

  return normalized;
}

function toPublicShopSettings(shop, user) {
  const categoryId = shop.categoryId?._id
    ? String(shop.categoryId._id)
    : shop.categoryId
      ? String(shop.categoryId)
      : "";

  const ownerName = pickString(user?.FullName) || pickString(user?.UserName) || "";
  const ownerUsername = pickString(user?.UserName) || "";
  const systemAddress = pickString(shop.addressHeThong || shop.DiaChiHeThong || shop.address);
  const depositPercent = Math.max(
    0,
    Math.min(100, Number(shop.cocTien ?? shop.depositPercent) || 0)
  );

  return {
    id: shop._id,
    shopId: shop._id,
    // Identity từ User — không lưu tên/handle riêng trên shop.
    shopUsername: ownerUsername,
    shopName: ownerName,
    fullName: ownerName,
    userName: ownerUsername,
    categoryId,
    categoryName: shop.categoryId?.categoryName || "",
    description: shop.description || "",
    shopDescription: shop.description || "",
    avatar: pickString(user?.Avatar) || "",
    shopAvatar: pickString(user?.Avatar) || "",
    systemAddress,
    addressHeThong: systemAddress,
    address: systemAddress,
    latitude: shop.latitude ?? null,
    longitude: shop.longitude ?? null,
    shopPhone: user?.Phone || "",
    userPhone: user?.Phone || "",
    openTime: shop.openTime || "",
    closeTime: shop.closeTime || "",
    isOpen: Number(shop.isOpen) === SHOP_OPEN.OPEN ? 1 : 0,
    status: shop.status ?? 1,
    followersCount: Number(user?.FollowersCount) || 0,
    depositPercent,
    cocTien: depositPercent,
    // QR cố định — payload JSON: {"shopId":"<qrCodeValue>"}
    qrCodeValue: pickString(shop.qrCodeValue) || String(shop._id),
    qrPayload: JSON.stringify({
      shopId: pickString(shop.qrCodeValue) || String(shop._id),
    }),
    pinHours: Boolean(shop.pinHours),
    subscriptionActive: isSubscriptionActive(shop),
    isActive: Boolean(shop.isActive),
  };
}

async function getShopForSeller(user) {
  const shop = await ShopProfile.findOne({ userId: user._id })
    .populate("categoryId", "categoryName")
    .sort({ CreatedAt: -1 });
  if (!shop) {
    throw createServiceError("Chưa có gian hàng.", 404);
  }
  // Đảm bảo mỗi shop có 1 QR cố định (mặc định = shopId).
  if (!pickString(shop.qrCodeValue)) {
    shop.qrCodeValue = String(shop._id);
    shop.UpdatedAt = new Date();
    await shop.save();
  }
  return shop;
}

async function getShopSettings(user) {
  const shop = await getShopForSeller(user);
  const freshUser = await User.findById(user._id);
  const base = toPublicShopSettings(shop, freshUser);

  const { findActiveSubscription } = require("./sellerPlanAccessService");
  const { listShopPurchases } = require("./sellerSubscriptionService");
  const active = await findActiveSubscription(shop._id);
  const purchases = await listShopPurchases(shop._id);
  let expiresAt = active?.endDate || null;
  if (purchases.length) {
    const maxEnd = purchases.reduce((max, row) => {
      const end = row.endDate ? new Date(row.endDate).getTime() : 0;
      return end > max ? end : max;
    }, 0);
    if (maxEnd > 0) expiresAt = new Date(maxEnd);
  }
  const oldest = [...purchases].sort((a, b) => {
    const left = new Date(a.ngayMua || a.createdAt || a.startDate || 0).getTime();
    const right = new Date(b.ngayMua || b.createdAt || b.startDate || 0).getTime();
    return left - right;
  })[0];

  return {
    ...base,
    subscriptionPlan: active?.planName || null,
    goiDangki: active?.planName || null,
    ngayMua: oldest?.ngayMua || oldest?.createdAt || oldest?.startDate || active?.ngayMua || active?.CreatedAt || active?.startDate || null,
    subscriptionExpiresAt: expiresAt,
    ngayHetHan: expiresAt,
    subscriptionActive: Boolean(active) || purchases.length > 0,
    purchases,
    purchaseCount: purchases.length,
  };
}

function normalizeTime(value) {
  const text = pickString(value);
  if (!text) {
    return "";
  }

  // Chấp nhận HH:mm, H:mm, HH:mm:ss (cắt giây).
  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) {
    throw createServiceError("Giờ mở/đóng cửa phải theo định dạng HH:mm.");
  }

  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const minutes = Math.min(59, Math.max(0, Number(match[2])));
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

async function updateShopSettings(user, payload) {
  const shop = await getShopForSeller(user);
  const freshUser = await User.findById(user._id);

  if (payload.description !== undefined || payload.shopDescription !== undefined) {
    shop.description = pickString(payload.description ?? payload.shopDescription);
  }
  if (
    payload.systemAddress !== undefined ||
    payload.addressHeThong !== undefined ||
    payload.DiaChiHeThong !== undefined ||
    payload.address !== undefined
  ) {
    shop.addressHeThong = pickString(
      payload.systemAddress ??
        payload.addressHeThong ??
        payload.DiaChiHeThong ??
        payload.address
    );
  }
  if (payload.latitude !== undefined || payload.lat !== undefined) {
    const latitude = Number(payload.latitude ?? payload.lat);
    if (!Number.isFinite(latitude)) {
      throw createServiceError("Tọa độ vĩ độ không hợp lệ.");
    }
    shop.latitude = latitude;
  }
  if (payload.longitude !== undefined || payload.lng !== undefined) {
    const longitude = Number(payload.longitude ?? payload.lng);
    if (!Number.isFinite(longitude)) {
      throw createServiceError("Tọa độ kinh độ không hợp lệ.");
    }
    shop.longitude = longitude;
  }
  if (payload.openTime !== undefined) {
    shop.openTime = normalizeTime(payload.openTime);
    shop.markModified("openTime");
  }
  if (payload.closeTime !== undefined) {
    shop.closeTime = normalizeTime(payload.closeTime);
    shop.markModified("closeTime");
  }
  if (payload.isOpen !== undefined) {
    shop.isOpen = Number(payload.isOpen) === SHOP_OPEN.OPEN ? SHOP_OPEN.OPEN : SHOP_OPEN.CLOSED;
  }

  if (payload.depositPercent !== undefined || payload.cocTien !== undefined) {
    const percent = Math.round(Number(payload.cocTien ?? payload.depositPercent));
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      throw createServiceError("Phần trăm đặt cọc phải từ 0 đến 100.");
    }
    shop.cocTien = percent;
  }

  if (payload.pinHours !== undefined) {
    shop.pinHours = Boolean(payload.pinHours);
    shop.markModified("pinHours");
  } else if (
    (payload.openTime !== undefined || payload.closeTime !== undefined) &&
    shop.openTime &&
    shop.closeTime &&
    shop.pinHours == null
  ) {
    shop.pinHours = true;
    shop.markModified("pinHours");
  }

  shop.UpdatedAt = new Date();
  await shop.save();

  const savedShop = await ShopProfile.findById(shop._id).populate("categoryId", "categoryName");
  return toPublicShopSettings(savedShop || shop, freshUser);
}

async function checkShopUsernameAvailability(user, shopUsername) {
  try {
    const normalized = await assertShopUsernameAvailable(shopUsername, user._id);
    return {
      available: true,
      shopUsername: normalized,
      message: "",
    };
  } catch (error) {
    return {
      available: false,
      shopUsername: normalizeShopUsername(shopUsername),
      message: error.message || "Username shop đã được sử dụng.",
    };
  }
}

module.exports = {
  getShopSettings,
  updateShopSettings,
  checkShopUsernameAvailability,
  getShopForSeller,
  toPublicShopSettings,
};
