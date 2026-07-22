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

async function buildDefaultUserAvatarBuffer(displayName) {
  const initial = escapeXml(getAvatarInitial(displayName));
  const fontSize = Math.floor(AVATAR_SIZE * 0.42);
  const svg = `<svg width="${AVATAR_SIZE}" height="${AVATAR_SIZE}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${AVATAR_SIZE}" height="${AVATAR_SIZE}" fill="${AVATAR_BG}" />
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

async function uploadDefaultUserAvatar({ user, displayName }) {
  const buffer = await buildDefaultUserAvatarBuffer(displayName);
  const ownerKey = user?.FirebaseUID || String(user?._id || "user");
  const fileName = `${ownerKey}-default-${Date.now()}.png`;
  const uploadResult = await uploadImageToSupabase({
    buffer,
    mimeType: "image/png",
    folder: "user-avatars",
    fileName,
  });
  return uploadResult.publicUrl;
}

function isGoogleHostedAvatar(url) {
  const value = pickString(url).toLowerCase();
  if (!value) {
    return false;
  }

  return (
    value.includes("googleusercontent.com") ||
    value.includes("ggpht.com") ||
    value.includes("google.com/a/")
  );
}

function isSystemDefaultAvatar(url) {
  return pickString(url).includes("-default-");
}

function hasCustomUploadedAvatar(user) {
  const avatar = pickString(user?.Avatar);
  if (!avatar) {
    return false;
  }
  // Giữ avatar user tự upload; Google + default hệ thống sẽ được thay.
  return !isGoogleHostedAvatar(avatar) && !isSystemDefaultAvatar(avatar);
}

async function ensureDefaultUserAvatar(user) {
  if (!user) {
    return "";
  }

  if (hasCustomUploadedAvatar(user)) {
    return user.Avatar;
  }

  const displayName = user.FullName || user.UserName || "User";

  try {
    const avatarUrl = await uploadDefaultUserAvatar({ user, displayName });
    user.Avatar = avatarUrl;
    user.UpdatedAt = new Date();
    await user.save();
    return avatarUrl;
  } catch (error) {
    console.error("[defaultUserAvatar] upload failed:", error?.message || error);
    return pickString(user.Avatar);
  }
}

module.exports = {
  buildDefaultUserAvatarBuffer,
  uploadDefaultUserAvatar,
  ensureDefaultUserAvatar,
};
