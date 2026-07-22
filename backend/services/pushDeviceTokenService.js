const PushDeviceToken = require("../models/PushDeviceToken");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickString(value) {
  return String(value || "").trim();
}

function normalizePlatform(platform) {
  const raw = pickString(platform).toLowerCase();
  if (raw === "android" || raw === "ios" || raw === "web") {
    return raw;
  }
  return "unknown";
}

async function registerDeviceToken(userId, { token, platform } = {}) {
  const normalizedToken = pickString(token);
  if (!userId) {
    throw createServiceError("Thiếu người dùng.", 400);
  }
  if (!normalizedToken) {
    throw createServiceError("Thiếu device token.", 400);
  }

  const doc = await PushDeviceToken.findOneAndUpdate(
    { token: normalizedToken },
    {
      userId,
      token: normalizedToken,
      platform: normalizePlatform(platform),
      UpdatedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return {
    id: String(doc._id),
    token: doc.token,
    platform: doc.platform,
    updatedAt: doc.UpdatedAt,
  };
}

async function removeDeviceToken(userId, token) {
  const normalizedToken = pickString(token);
  if (!userId || !normalizedToken) {
    return { removed: 0 };
  }

  const result = await PushDeviceToken.deleteOne({
    userId,
    token: normalizedToken,
  });

  return { removed: result.deletedCount || 0 };
}

async function listTokensForUser(userId) {
  if (!userId) {
    return [];
  }

  const docs = await PushDeviceToken.find({ userId }).select("token platform UpdatedAt").lean();
  return docs.map((doc) => ({
    id: String(doc._id),
    token: doc.token,
    platform: doc.platform,
    updatedAt: doc.UpdatedAt,
  }));
}

async function removeTokenByValue(token) {
  const normalizedToken = pickString(token);
  if (!normalizedToken) {
    return { removed: 0 };
  }

  const result = await PushDeviceToken.deleteOne({ token: normalizedToken });
  return { removed: result.deletedCount || 0 };
}

module.exports = {
  registerDeviceToken,
  removeDeviceToken,
  listTokensForUser,
  removeTokenByValue,
};
