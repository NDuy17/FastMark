const Conversation = require("../models/Conversation");
const ShopProfile = require("../models/ShopProfile");
const { mapPresenceFields } = require("../utils/activityLabel");
const { emitConversationEvent, emitUserEvent } = require("../socket");

function buildPresencePayload({ userId, shopId, target, presence }) {
  return {
    target,
    userId: String(userId),
    shopId: shopId ? String(shopId) : null,
    ...presence,
  };
}

/**
 * Gửi presence cho chính user + mọi đối phương trong hội thoại gần đây,
 * và vào room conversation đang mở để ChatScreen cập nhật realtime.
 */
async function emitPresenceUpdate({ userId, shopId, target, presence }) {
  const payload = buildPresencePayload({ userId, shopId, target, presence });
  const selfId = String(userId);

  emitUserEvent(selfId, "presence:update", payload);

  const conversations = await Conversation.find({
    $or: [{ participantA: userId }, { participantB: userId }],
  })
    .select("_id participantA participantB")
    .sort({ UpdatedAt: -1 })
    .limit(80)
    .lean();

  const notifiedPeers = new Set();

  for (const conversation of conversations) {
    const conversationId = String(conversation._id);
    emitConversationEvent(conversationId, "presence:update", payload);

    const peerId =
      String(conversation.participantA) === selfId
        ? String(conversation.participantB)
        : String(conversation.participantA);

    if (!peerId || peerId === selfId || notifiedPeers.has(peerId)) {
      continue;
    }

    notifiedPeers.add(peerId);
    emitUserEvent(peerId, "presence:update", payload);
  }
}

async function findShopByUser(user) {
  return ShopProfile.findOne({ userId: user._id });
}

async function setUserOnline(user) {
  user.DangHoatDong = true;
  user.LanHoatDongCuoi = new Date();
  await user.save();

  const presence = mapPresenceFields(user);
  await emitPresenceUpdate({
    userId: user._id,
    shopId: null,
    target: "user",
    presence,
  });

  return presence;
}

async function setUserOffline(user) {
  user.DangHoatDong = false;
  user.LanHoatDongCuoi = new Date();
  await user.save();

  const presence = mapPresenceFields(user);
  await emitPresenceUpdate({
    userId: user._id,
    shopId: null,
    target: "user",
    presence,
  });

  return presence;
}

async function setShopOnline(user) {
  const shop = await findShopByUser(user);
  if (!shop) {
    const error = new Error("Chưa có gian hàng để bật trạng thái hoạt động.");
    error.statusCode = 404;
    throw error;
  }

  shop.DangHoatDong = true;
  shop.LanHoatDongCuoi = new Date();
  await shop.save();

  const presence = mapPresenceFields(shop);
  await emitPresenceUpdate({
    userId: user._id,
    shopId: shop._id,
    target: "shop",
    presence,
  });

  return presence;
}

async function setShopOffline(user) {
  const shop = await findShopByUser(user);
  if (!shop) {
    return null;
  }

  shop.DangHoatDong = false;
  shop.LanHoatDongCuoi = new Date();
  await shop.save();

  const presence = mapPresenceFields(shop);
  await emitPresenceUpdate({
    userId: user._id,
    shopId: shop._id,
    target: "shop",
    presence,
  });

  return presence;
}

module.exports = {
  setUserOnline,
  setUserOffline,
  setShopOnline,
  setShopOffline,
};
