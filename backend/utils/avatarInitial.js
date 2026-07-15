function pickString(value) {
  return String(value || "").trim();
}

function getAvatarInitial(name, fallback = "?") {
  const text = pickString(name).replace(/^@+/, "");
  if (!text) {
    return fallback;
  }
  const char = text.charAt(0);
  return char ? char.toLocaleUpperCase("vi-VN") : fallback;
}

module.exports = {
  getAvatarInitial,
};
