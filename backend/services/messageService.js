const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const ShopProfile = require("../models/ShopProfile");
const User = require("../models/User");
const Follow = require("../models/Follow");
const { MESSAGE_TYPE } = require("../constants");
const { MESSAGE_READ, MESSAGE_STATUS } = require("../constants");
const { getShopForSeller } = require("./shopSettingsService");
const { mapPresenceFields } = require("../utils/activityLabel");
const { emitConversationEvent } = require("../socket");
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

function isMongoObjectId(value) {
  return /^[a-f\d]{24}$/i.test(pickString(value));
}

function activeMessageFilter(extra = {}) {
  return {
    ...extra,
    DeletedAt: null,
  };
}

function orderParticipants(userId1, userId2) {
  const a = String(userId1);
  const b = String(userId2);
  if (a < b) {
    return { participantA: userId1, participantB: userId2 };
  }
  return { participantA: userId2, participantB: userId1 };
}

function getPeerUserId(conversation, myUserId) {
  const me = String(myUserId);
  if (String(conversation.participantA) === me) {
    return conversation.participantB;
  }
  if (String(conversation.participantB) === me) {
    return conversation.participantA;
  }
  return null;
}

function isParticipant(conversation, userId) {
  const me = String(userId);
  return (
    String(conversation.participantA) === me || String(conversation.participantB) === me
  );
}

async function resolveShopForBuyerChat(shopId) {
  const rawId = pickString(shopId);
  if (!rawId) {
    throw createServiceError("Thiếu shopId.", 400);
  }

  if (!isMongoObjectId(rawId)) {
    throw createServiceError("Không tìm thấy gian hàng.", 404);
  }

  const shop = await ShopProfile.findById(rawId);
  if (!shop) {
    throw createServiceError("Không tìm thấy gian hàng.", 404);
  }
  return shop;
}

function formatBubbleTime(date) {
  if (!date) {
    return "";
  }
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) {
    return "";
  }
  return value.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function formatTime(date) {
  if (!date) {
    return "";
  }
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) {
    return "";
  }
  const now = new Date();
  const isToday = value.toDateString() === now.toDateString();
  if (isToday) {
    return value.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  }
  return value.toLocaleDateString("vi-VN");
}

function mapStatusToString(messageStatus) {
  if (messageStatus === MESSAGE_STATUS.SEEN) {
    return "seen";
  }
  if (messageStatus === MESSAGE_STATUS.DELIVERED) {
    return "delivered";
  }
  return "sent";
}

function buildViewerContext(user, mode = "buyer") {
  return {
    mode,
    userId: user?._id,
  };
}

function isMessageFromViewer(message, viewer) {
  if (!viewer || !message) {
    return false;
  }
  return String(message.senderId || "") === String(viewer.userId || "");
}

function buildOpponentReadFilter(viewer) {
  return { senderId: { $ne: viewer.userId } };
}

function buildUnreadFilter(viewer) {
  return buildOpponentReadFilter(viewer);
}

async function repairMessageSenders(conversation) {
  // No-op for user-peer model; legacy shop-sender remap is done in migrate script.
  return conversation;
}

async function ensureMessageSequences(conversation) {
  const missing = await Message.find({
    conversationId: conversation._id,
    $or: [{ ThuTu: { $exists: false } }, { ThuTu: null }, { ThuTu: 0 }],
  })
    .sort({ CreatedAt: 1 })
    .select("_id ThuTu CreatedAt");

  if (missing.length === 0) {
    return conversation;
  }

  const maxExisting = await Message.findOne({
    conversationId: conversation._id,
    ThuTu: { $gt: 0 },
  })
    .sort({ ThuTu: -1 })
    .select("ThuTu");

  let counter = Number(maxExisting?.ThuTu) || Number(conversation.nextThuTu) || 0;

  for (const row of missing) {
    counter += 1;
    await Message.updateOne({ _id: row._id }, { $set: { ThuTu: counter, UpdatedAt: new Date() } });
  }

  conversation.nextThuTu = counter;
  await conversation.save();
  return conversation;
}

function buildSequenceMeta(messages, totalCount) {
  const numbered = messages
    .map((message) => Number(message.thuTu))
    .filter((value) => Number.isFinite(value) && value > 0);

  return {
    from: numbered.length > 0 ? Math.min(...numbered) : 0,
    to: numbered.length > 0 ? Math.max(...numbered) : 0,
    total: totalCount,
    count: messages.length,
  };
}

/** URL ảnh trên Message; fallback content cũ (trước khi gộp MessageImage). */
function resolveMessageImageUri(message) {
  if (Number(message?.messageType) !== MESSAGE_TYPE.IMAGE) {
    return undefined;
  }
  return pickString(message.imageUrl) || pickString(message.content) || "";
}

function formatLegacyOfferContent(content) {
  const raw = String(content || "").trim();
  if (!raw) {
    return "";
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      if (parsed.text) {
        return String(parsed.text);
      }
      if (parsed.offeredPrice != null) {
        return `Đề nghị giá: ${Number(parsed.offeredPrice).toLocaleString("vi-VN")}đ`;
      }
    }
  } catch {
    // Keep plain text / historical content as-is.
  }
  return raw;
}

function mapMessageToBroadcast(message) {
  const isDeleted = Boolean(message.DeletedAt);
  const isImage = Number(message.messageType) === MESSAGE_TYPE.IMAGE;
  const isOffer = Number(message.messageType) === MESSAGE_TYPE.OFFER;
  const imageUri = resolveMessageImageUri(message);
  const textContent = isImage
    ? ""
    : isOffer
      ? formatLegacyOfferContent(message.content)
      : message.content || "";

  if (isDeleted) {
    return {
      id: message._id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      thuTu: message.ThuTu || 0,
      messageType: message.messageType,
      content: "Tin nhắn đã được gỡ",
      isDeleted: true,
      isRead: message.isRead,
      messageStatus: message.messageStatus,
      createdAt: message.CreatedAt,
      timeLabel: formatBubbleTime(message.CreatedAt),
    };
  }

  return {
    id: message._id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    thuTu: message.ThuTu || 0,
    messageType: message.messageType,
    content: textContent,
    isOffer,
    imageUrl: imageUri || "",
    imageUri,
    isDeleted: false,
    isRead: message.isRead,
    messageStatus: message.messageStatus,
    createdAt: message.CreatedAt,
    timeLabel: formatBubbleTime(message.CreatedAt),
  };
}

function mapMessageToClient(message, viewer) {
  const isMine = isMessageFromViewer(message, viewer);
  const isDeleted = Boolean(message.DeletedAt);
  const isImage = Number(message.messageType) === MESSAGE_TYPE.IMAGE;
  const isOffer = Number(message.messageType) === MESSAGE_TYPE.OFFER;
  const imageUri = resolveMessageImageUri(message);
  const textContent = isImage
    ? ""
    : isOffer
      ? formatLegacyOfferContent(message.content)
      : message.content || "";

  if (isDeleted) {
    return {
      id: message._id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      thuTu: message.ThuTu || 0,
      isMine,
      messageType: message.messageType,
      content: "Tin nhắn đã được gỡ",
      isDeleted: true,
      isRead: message.isRead,
      messageStatus: message.messageStatus,
      status: isMine ? mapStatusToString(message.messageStatus) : undefined,
      createdAt: message.CreatedAt,
      timeLabel: formatBubbleTime(message.CreatedAt),
    };
  }

  return {
    id: message._id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    thuTu: message.ThuTu || 0,
    isMine,
    messageType: message.messageType,
    content: textContent,
    isOffer,
    imageUrl: imageUri || "",
    imageUri,
    isDeleted: false,
    isRead: message.isRead,
    messageStatus: message.messageStatus,
    status: isMine ? mapStatusToString(message.messageStatus) : undefined,
    createdAt: message.CreatedAt,
    timeLabel: formatBubbleTime(message.CreatedAt),
  };
}

function mapBuyerPublicInfo(buyer) {
  if (!buyer) {
    return null;
  }

  return {
    id: buyer._id,
    fullName: buyer.FullName || "",
    name: buyer.FullName || "",
    userName: buyer.UserName || "",
    avatar: buyer.Avatar || "",
    followingCount: Number(buyer.FollowingCount) || 0,
    ...mapPresenceFields(buyer),
  };
}

async function getShopPublicInfo(shop) {
  const seller = shop?.userId ? await User.findById(shop.userId) : null;
  const displayName = shop?.shopName || seller?.FullName || seller?.UserName || "";

  const name =
    displayName ||
    pickString(shop?.description).slice(0, 40) ||
    "Gian hàng";

  const shopPresence = mapPresenceFields(shop);
  const sellerPresence = mapPresenceFields(seller || {});
  // Ưu tiên presence gian hàng; nếu chưa có dữ liệu thì fallback chủ shop.
  const hasShopPresence =
    shop?.DangHoatDong != null || shop?.LanHoatDongCuoi != null;
  const displayPresence = hasShopPresence ? shopPresence : sellerPresence;

  return {
    id: shop._id,
    name,
    shopName: shop.shopName || name,
    shopUsername: shop.shopUsername || "",
    // Avatar gian hàng = avatar tài khoản chủ shop.
    avatar: seller?.Avatar || "",
    accountAvatar: seller?.Avatar || "",
    phone: shop.phone || seller?.Phone || "",
    description: shop.description || "",
    isOnline: displayPresence.isOnline,
    lastActiveAt: displayPresence.lastActiveAt,
    activityLabel: displayPresence.activityLabel,
    // Seller personal account fields (used by chat "Tài khoản" view).
    ownerUserId: seller?._id ? String(seller._id) : "",
    userId: seller?._id ? String(seller._id) : "",
    fullName: seller?.FullName || "",
    userName: seller?.UserName || "",
    followersCount: Number(shop?.followersCount) || 0,
    followingCount: Number(seller?.FollowingCount) || 0,
    accountIsOnline: sellerPresence.isOnline,
    accountLastActiveAt: sellerPresence.lastActiveAt,
    accountActivityLabel: sellerPresence.activityLabel,
  };
}

async function resolveImageContent(imageContent) {
  const raw = pickString(imageContent);
  if (!raw) {
    return "";
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  const match = raw.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) {
    return raw;
  }

  const mimeType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  const uploaded = await uploadImageToSupabase({
    buffer,
    mimeType,
    folder: "chat-images",
    fileName: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${resolveFileExtension(mimeType)}`,
  });

  return uploaded.publicUrl;
}

function resolveMessagePayload(payload = {}) {
  const messageType = Number(payload.messageType ?? MESSAGE_TYPE.TEXT);
  if (messageType === MESSAGE_TYPE.OFFER) {
    const content = pickString(payload.content || payload.message);
    if (!content) {
      throw createServiceError("Thiếu nội dung tin nhắn.");
    }
    return {
      messageType: MESSAGE_TYPE.TEXT,
      content,
      preview: content.slice(0, 80),
    };
  }
  if (messageType === MESSAGE_TYPE.IMAGE) {
    const imageContent = pickString(payload.imageContent || payload.content);
    if (!imageContent) {
      throw createServiceError("Thiếu dữ liệu ảnh.");
    }
    return {
      messageType: MESSAGE_TYPE.IMAGE,
      rawImageContent: imageContent,
      preview: "[Ảnh]",
    };
  }

  const content = pickString(payload.content || payload.message);
  if (!content) {
    throw createServiceError("Nội dung tin nhắn không được để trống.");
  }

  return {
    messageType: MESSAGE_TYPE.TEXT,
    content,
    preview: content,
  };
}

async function createConversationMessage(conversation, senderId, payload, viewer) {
  const resolved = resolveMessagePayload(payload);
  const now = new Date();

  let content = resolved.content || "";
  let imageUrl = "";
  if (resolved.messageType === MESSAGE_TYPE.IMAGE) {
    imageUrl = await resolveImageContent(resolved.rawImageContent);
    content = "";
  }

  const updatedConversation = await Conversation.findByIdAndUpdate(
    conversation._id,
    {
      $inc: { nextThuTu: 1 },
      $set: {
        lastMessage: resolved.preview,
        lastMessageAt: now,
        UpdatedAt: now,
      },
    },
    { new: true }
  );

  const thuTu = Number(updatedConversation?.nextThuTu) || 1;

  const message = await Message.create({
    conversationId: conversation._id,
    senderId,
    ThuTu: thuTu,
    messageType: resolved.messageType,
    content,
    imageUrl,
    isRead: MESSAGE_READ.UNREAD,
    messageStatus: MESSAGE_STATUS.SENT,
    CreatedAt: now,
    UpdatedAt: now,
  });

  emitConversationEvent(String(conversation._id), "message:new", {
    conversationId: String(conversation._id),
    message: mapMessageToBroadcast(message),
  });

  return message;
}

async function markOpponentMessagesRead(conversation, viewer) {
  const unreadMessages = await Message.find({
    conversationId: conversation._id,
    ...buildOpponentReadFilter(viewer),
    isRead: MESSAGE_READ.UNREAD,
    DeletedAt: null,
  });

  if (unreadMessages.length === 0) {
    return [];
  }

  const messageIds = unreadMessages.map((message) => message._id);
  const now = new Date();

  await Message.updateMany(
    { _id: { $in: messageIds } },
    {
      $set: {
        isRead: MESSAGE_READ.READ,
        messageStatus: MESSAGE_STATUS.SEEN,
        UpdatedAt: now,
      },
    }
  );

  emitConversationEvent(String(conversation._id), "message:read", {
    conversationId: String(conversation._id),
    messageIds: messageIds.map(String),
    status: "seen",
  });

  return messageIds;
}

async function listSellerConversations(user) {
  const conversations = await Conversation.find({
    $or: [{ participantA: user._id }, { participantB: user._id }],
    lastMessage: { $exists: true, $nin: [null, ""] },
  })
    .sort({ lastMessageAt: -1, UpdatedAt: -1 })
    .limit(100);

  const viewer = buildViewerContext(user, "seller");
  const result = [];
  for (const conversation of conversations) {
    const peerId = getPeerUserId(conversation, user._id);
    const buyer = peerId ? await User.findById(peerId) : null;
    const unreadCount = await Message.countDocuments({
      conversationId: conversation._id,
      ...buildUnreadFilter(viewer),
      isRead: MESSAGE_READ.UNREAD,
      DeletedAt: null,
    });

    result.push({
      id: conversation._id,
      lastMessage: conversation.lastMessage || "",
      lastMessageAt: conversation.lastMessageAt || conversation.UpdatedAt,
      timeLabel: formatTime(conversation.lastMessageAt || conversation.UpdatedAt),
      unreadCount,
      buyer: mapBuyerPublicInfo(buyer),
    });
  }

  return result;
}

async function getOwnedConversation(user, conversationId) {
  const conversation = await Conversation.findOne({
    _id: conversationId,
    $or: [{ participantA: user._id }, { participantB: user._id }],
  });
  if (!conversation) {
    throw createServiceError("Không tìm thấy cuộc trò chuyện.", 404);
  }
  // Resolve shop via peer (seller) participant's ShopProfile when available for display.
  const peerId = getPeerUserId(conversation, user._id);
  const shop = peerId
    ? await ShopProfile.findOne({ userId: peerId }).sort({ CreatedAt: -1 })
    : null;
  return { shop, conversation };
}

async function getBuyerOwnedConversation(user, conversationId) {
  return getOwnedConversation(user, conversationId);
}

async function fetchConversationMessages(conversation, viewer) {
  await ensureMessageSequences(conversation);
  await repairMessageSenders(conversation);

  const rows = await Message.find({ conversationId: conversation._id })
    .sort({ ThuTu: 1, CreatedAt: 1 })
    .limit(200);

  const clientMessages = rows.map((row) => mapMessageToClient(row, viewer));

  const totalCount = await Message.countDocuments({
    conversationId: conversation._id,
    DeletedAt: null,
  });

  return {
    messages: clientMessages,
    sequence: buildSequenceMeta(clientMessages, totalCount),
  };
}

async function listConversationMessages(user, conversationId) {
  const { conversation } = await getOwnedConversation(user, conversationId);
  const viewer = buildViewerContext(user, "seller");
  await markOpponentMessagesRead(conversation, viewer);
  return fetchConversationMessages(conversation, viewer);
}

async function listBuyerConversationMessages(user, conversationId) {
  const { conversation } = await getBuyerOwnedConversation(user, conversationId);
  const viewer = buildViewerContext(user, "buyer");
  await markOpponentMessagesRead(conversation, viewer);
  return fetchConversationMessages(conversation, viewer);
}

async function sendSellerMessage(user, conversationId, payload) {
  const { conversation } = await getOwnedConversation(user, conversationId);
  const viewer = buildViewerContext(user, "seller");
  const message = await createConversationMessage(
    conversation,
    user._id,
    payload,
    viewer
  );
  return mapMessageToClient(message, viewer);
}

async function sendBuyerMessage(user, conversationId, payload) {
  const { conversation } = await getBuyerOwnedConversation(user, conversationId);
  const viewer = buildViewerContext(user, "buyer");
  const message = await createConversationMessage(
    conversation,
    user._id,
    payload,
    viewer
  );
  return mapMessageToClient(message, viewer);
}

function syncConversationPreviewAfterDelete(conversation, deletedMessage, actorName) {
  const now = new Date();
  const lastMessage = `${pickString(actorName) || "Ai đó"} đã gỡ 1 tin nhắn`;

  return Conversation.findByIdAndUpdate(conversation._id, {
    $set: {
      lastMessage,
      lastMessageAt: deletedMessage.DeletedAt || now,
      UpdatedAt: now,
    },
  }).then(() => lastMessage);
}

async function deleteMessage(user, conversationId, messageId, { asSeller = false } = {}) {
  const { conversation } = asSeller
    ? await getOwnedConversation(user, conversationId)
    : await getBuyerOwnedConversation(user, conversationId);

  const viewer = buildViewerContext(user, asSeller ? "seller" : "buyer");
  const ownerFilter = {
    senderId: user._id,
  };

  const message = await Message.findOne({
    _id: messageId,
    conversationId: { $in: [conversation._id, String(conversation._id)] },
    ...ownerFilter,
    DeletedAt: null,
  });

  if (!message) {
    throw createServiceError("Không tìm thấy tin nhắn để gỡ.", 404);
  }

  const now = new Date();
  message.DeletedAt = now;
  message.UpdatedAt = now;
  message.content = "";
  message.imageUrl = "";
  await message.save();

  const actorName =
    pickString(user.FullName) || pickString(user.UserName) || (asSeller ? "Người bán" : "Người mua");

  const conversationLastMessage = await syncConversationPreviewAfterDelete(
    conversation,
    message,
    actorName
  );

  const clientMessage = mapMessageToClient(message, viewer);
  emitConversationEvent(String(conversation._id), "message:deleted", {
    conversationId: String(conversation._id),
    message: mapMessageToBroadcast(message),
    lastMessage: conversationLastMessage,
  });

  return {
    ...clientMessage,
    conversationLastMessage,
  };
}

async function getSellerConversationPeer(user, conversationId) {
  const { conversation } = await getOwnedConversation(user, conversationId);
  const peerId = getPeerUserId(conversation, user._id);
  const buyer = peerId ? await User.findById(peerId) : null;
  return mapBuyerPublicInfo(buyer);
}

async function getBuyerConversationPeer(user, conversationId) {
  const { conversation, shop } = await getBuyerOwnedConversation(user, conversationId);
  if (shop) {
    return getShopPublicInfo(shop);
  }
  const peerId = getPeerUserId(conversation, user._id);
  const peer = peerId ? await User.findById(peerId) : null;
  if (!peer) {
    return null;
  }
  return {
    id: peer._id,
    name: peer.FullName || peer.UserName || "Người dùng",
    shopName: peer.FullName || "",
    shopUsername: peer.UserName || "",
    avatar: peer.Avatar || "",
    accountAvatar: peer.Avatar || "",
    fullName: peer.FullName || "",
    userName: peer.UserName || "",
    followersCount: Number(peer.FollowersCount) || 0,
    followingCount: Number(peer.FollowingCount) || 0,
    ...mapPresenceFields(peer),
    accountIsOnline: mapPresenceFields(peer).isOnline,
    accountLastActiveAt: mapPresenceFields(peer).lastActiveAt,
    accountActivityLabel: mapPresenceFields(peer).activityLabel,
  };
}

async function listBuyerConversations(user) {
  const conversations = await Conversation.find({
    $or: [{ participantA: user._id }, { participantB: user._id }],
    lastMessage: { $exists: true, $nin: [null, ""] },
  })
    .sort({ lastMessageAt: -1, UpdatedAt: -1 })
    .limit(100);

  const viewer = buildViewerContext(user, "buyer");
  const result = [];
  for (const conversation of conversations) {
    const peerId = getPeerUserId(conversation, user._id);
    let shop = peerId
      ? await ShopProfile.findOne({ userId: peerId }).sort({ CreatedAt: -1 })
      : null;

    const unreadCount = await Message.countDocuments({
      conversationId: conversation._id,
      ...buildUnreadFilter(viewer),
      isRead: MESSAGE_READ.UNREAD,
      DeletedAt: null,
    });

    let peerPayload = null;
    if (shop) {
      peerPayload = await getShopPublicInfo(shop);
    } else {
      const peer = peerId ? await User.findById(peerId) : null;
      if (!peer) {
        continue;
      }
      peerPayload = {
        id: peer._id,
        name: peer.FullName || peer.UserName || "Người dùng",
        shopName: peer.FullName || "",
        avatar: peer.Avatar || "",
        accountAvatar: peer.Avatar || "",
        fullName: peer.FullName || "",
        userName: peer.UserName || "",
      };
    }

    result.push({
      id: conversation._id,
      lastMessage: conversation.lastMessage || "",
      lastMessageAt: conversation.lastMessageAt || conversation.UpdatedAt,
      timeLabel: formatTime(conversation.lastMessageAt || conversation.UpdatedAt),
      unreadCount,
      shop: peerPayload,
    });
  }

  return result;
}

async function listShopsForBuyer(user) {
  const follows = await Follow.find({ followerId: user._id })
    .select("followedUserId")
    .lean();
  const followedUserIds = follows.map((row) => row.followedUserId).filter(Boolean);

  if (followedUserIds.length === 0) {
    return [];
  }

  const shops = await ShopProfile.find({ userId: { $in: followedUserIds } })
    .sort({ UpdatedAt: -1 })
    .limit(30);
  const result = [];

  for (const shop of shops) {
    result.push({
      shop: await getShopPublicInfo(shop),
    });
  }

  return result;
}

async function findOrCreateConversationBetweenUsers(userAId, userBId, _ignoredShopId = null) {
  if (String(userAId) === String(userBId)) {
    throw createServiceError("Không thể tự nhắn với chính mình.", 400);
  }
  const { participantA, participantB } = orderParticipants(userAId, userBId);
  let conversation = await Conversation.findOne({ participantA, participantB });
  const now = new Date();
  if (!conversation) {
    conversation = await Conversation.create({
      participantA,
      participantB,
      lastMessage: "",
      lastMessageAt: now,
      CreatedAt: now,
      UpdatedAt: now,
    });
  }
  return conversation;
}

async function findOrCreateBuyerConversation(user, shopId) {
  const shop = await resolveShopForBuyerChat(shopId);
  if (!shop?.userId) {
    throw createServiceError("Gian hàng chưa gắn chủ sở hữu.", 400);
  }
  const conversation = await findOrCreateConversationBetweenUsers(
    user._id,
    shop.userId
  );
  return { shop, conversation };
}

async function startConversationWithShop(user, shopId, payload = {}) {
  const { shop, conversation } = await findOrCreateBuyerConversation(user, shopId);
  const content = pickString(payload.content);

  if (content || payload.messageType === MESSAGE_TYPE.IMAGE) {
    const message = await sendBuyerMessage(user, conversation._id, payload);
    return {
      conversationId: conversation._id,
      shop: await getShopPublicInfo(shop),
      message,
    };
  }

  return {
    conversationId: conversation._id,
    shop: await getShopPublicInfo(shop),
  };
}

async function startConversationWithBuyer(user, buyerId, payload = {}) {
  await getShopForSeller(user);
  const buyer = await User.findById(buyerId);
  if (!buyer) {
    throw createServiceError("Không tìm thấy khách hàng.", 404);
  }

  const conversation = await findOrCreateConversationBetweenUsers(
    user._id,
    buyer._id
  );

  const content = pickString(payload.content);
  if (content || payload.messageType === MESSAGE_TYPE.IMAGE) {
    return sendSellerMessage(user, conversation._id, payload);
  }

  return {
    conversationId: conversation._id,
  };
}

module.exports = {
  listSellerConversations,
  listBuyerConversations,
  listShopsForBuyer,
  listConversationMessages,
  listBuyerConversationMessages,
  sendSellerMessage,
  sendBuyerMessage,
  deleteMessage,
  getSellerConversationPeer,
  getBuyerConversationPeer,
  startConversationWithShop,
  startConversationWithBuyer,
  findOrCreateBuyerConversation,
  findOrCreateConversationBetweenUsers,
  getShopPublicInfo,
  mapBuyerPublicInfo,
};
