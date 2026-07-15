const ShopProfile = require("../models/ShopProfile");
const User = require("../models/User");
const { SHOP_OPEN } = require("../constants/shopStatus");
const {
  resolveFileExtension,
  uploadImageToSupabase,
} = require("./uploadService");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickString(value) {
  return String(value || "").trim();
}

function toPublicShopSettings(shop, user) {
  const categoryId = shop.categoryId?._id
    ? String(shop.categoryId._id)
    : shop.categoryId
      ? String(shop.categoryId)
      : "";

  return {
    id: shop._id,
    shopId: shop._id,
    shopUsername: shop.shopUsername || "",
    shopName: shop.shopName || "",
    categoryId,
    categoryName: shop.categoryId?.categoryName || "",
    description: shop.description || "",
    shopDescription: shop.description || "",
    avatar: shop.avatar || "",
    shopAvatar: shop.avatar || "",
    address: shop.address || "",
    systemAddress: shop.DiaChiHeThong || "",
    latitude: shop.latitude ?? null,
    longitude: shop.longitude ?? null,
    shopPhone: shop.phone || "",
    userPhone: user?.Phone || "",
    openTime: shop.openTime || "",
    closeTime: shop.closeTime || "",
    isOpen: Number(shop.isOpen) === SHOP_OPEN.OPEN ? 1 : 0,
    status: shop.status ?? 1,
    followersCount: Number(shop.followersCount) || 0,
  };
}

async function getShopForSeller(user) {
  const shop = await ShopProfile.findOne({ userId: user._id })
    .populate("categoryId", "categoryName")
    .sort({ CreatedAt: -1 });
  if (!shop) {
    throw createServiceError("Chưa có gian hàng.", 404);
  }
  return shop;
}

async function getShopSettings(user) {
  const shop = await getShopForSeller(user);
  const freshUser = await User.findById(user._id);
  return toPublicShopSettings(shop, freshUser);
}

function normalizeTime(value) {
  const text = pickString(value);
  if (!text) {
    return "";
  }
  if (!/^\d{1,2}:\d{2}$/.test(text)) {
    throw createServiceError("Giờ mở/đóng cửa phải theo định dạng HH:mm.");
  }
  return text;
}

async function updateShopSettings(user, payload) {
  const shop = await getShopForSeller(user);
  const freshUser = await User.findById(user._id);

  if (payload.shopName !== undefined) {
    shop.shopName = pickString(payload.shopName);
  }
  if (payload.description !== undefined || payload.shopDescription !== undefined) {
    shop.description = pickString(payload.description ?? payload.shopDescription);
  }
  if (payload.address !== undefined) {
    shop.address = pickString(payload.address);
  }
  if (payload.systemAddress !== undefined || payload.DiaChiHeThong !== undefined) {
    shop.DiaChiHeThong = pickString(payload.systemAddress ?? payload.DiaChiHeThong);
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
  }
  if (payload.closeTime !== undefined) {
    shop.closeTime = normalizeTime(payload.closeTime);
  }
  if (payload.isOpen !== undefined) {
    shop.isOpen = Number(payload.isOpen) === SHOP_OPEN.OPEN ? SHOP_OPEN.OPEN : SHOP_OPEN.CLOSED;
  }

  if (payload.avatar !== undefined || payload.shopAvatar !== undefined) {
    shop.avatar = pickString(payload.avatar ?? payload.shopAvatar);
  }

  shop.UpdatedAt = new Date();
  await shop.save();

  return toPublicShopSettings(shop, freshUser);
}

async function uploadShopAvatar(user, { imageBase64, mimeType }) {
  if (!imageBase64) {
    throw createServiceError("Thiếu dữ liệu ảnh gian hàng.");
  }

  const normalizedBase64 = String(imageBase64).replace(
    /^data:image\/[a-zA-Z0-9.+-]+;base64,/,
    ""
  );
  const buffer = Buffer.from(normalizedBase64, "base64");

  if (!buffer.length) {
    throw createServiceError("Ảnh gian hàng không hợp lệ.");
  }

  const maxBytes = 5 * 1024 * 1024;
  if (buffer.length > maxBytes) {
    throw createServiceError("Ảnh không được lớn hơn 5MB.");
  }

  const shop = await getShopForSeller(user);
  const extension = resolveFileExtension(mimeType || "image/jpeg");
  const fileName = `${user.FirebaseUID}-shop-${Date.now()}.${extension}`;
  const uploadResult = await uploadImageToSupabase({
    buffer,
    mimeType: mimeType || "image/jpeg",
    folder: "shop-avatars",
    fileName,
  });

  shop.avatar = uploadResult.publicUrl;
  shop.UpdatedAt = new Date();
  await shop.save();

  const freshUser = await User.findById(user._id);
  return {
    shop: toPublicShopSettings(shop, freshUser),
    avatarUrl: uploadResult.publicUrl,
    storagePath: uploadResult.path,
  };
}

module.exports = {
  getShopSettings,
  updateShopSettings,
  uploadShopAvatar,
  getShopForSeller,
  toPublicShopSettings,
};
