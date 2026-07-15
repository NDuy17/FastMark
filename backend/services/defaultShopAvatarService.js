const sharp = require("sharp");
const { getAvatarInitial } = require("../utils/avatarInitial");
const { uploadImageToSupabase } = require("./uploadService");

const AVATAR_SIZE = 512;
const AVATAR_BG = "#0d7377";

function pickString(value) {
  return String(value || "").trim();
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function buildDefaultShopAvatarBuffer(shopName) {
  const initial = escapeXml(getAvatarInitial(shopName));
  const fontSize = Math.floor(AVATAR_SIZE * 0.42);
  const svg = `<svg width="${AVATAR_SIZE}" height="${AVATAR_SIZE}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${AVATAR_SIZE / 2}" cy="${AVATAR_SIZE / 2}" r="${AVATAR_SIZE / 2}" fill="${AVATAR_BG}" />
  <text
    x="50%"
    y="50%"
    dy="0.35em"
    text-anchor="middle"
    fill="#ffffff"
    font-family="Arial, Helvetica, sans-serif"
    font-weight="800"
    font-size="${fontSize}"
  >${initial}</text>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function uploadDefaultShopAvatar({ user, shopName, shopId }) {
  const buffer = await buildDefaultShopAvatarBuffer(shopName);
  const ownerKey = user?.FirebaseUID || String(user?._id || shopId || "shop");
  const fileName = `${ownerKey}-default-${Date.now()}.png`;
  const uploadResult = await uploadImageToSupabase({
    buffer,
    mimeType: "image/png",
    folder: "shop-avatars",
    fileName,
  });
  return uploadResult.publicUrl;
}

async function ensureDefaultShopAvatar(shop, user) {
  if (!shop || pickString(shop.avatar)) {
    return shop?.avatar || "";
  }

  const shopName =
    shop.shopName || user?.FullName || user?.UserName || shop.shopUsername || "Gian hàng";

  try {
    const avatarUrl = await uploadDefaultShopAvatar({
      user,
      shopName,
      shopId: shop._id,
    });
    shop.avatar = avatarUrl;
    shop.UpdatedAt = new Date();
    await shop.save();
    return avatarUrl;
  } catch (error) {
    console.error("[defaultShopAvatar] upload failed:", error?.message || error);
    return "";
  }
}

module.exports = {
  buildDefaultShopAvatarBuffer,
  uploadDefaultShopAvatar,
  ensureDefaultShopAvatar,
};
