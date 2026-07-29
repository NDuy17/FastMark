const Notification = require("../models/Notification.js");
const {
  NOTIFICATION_AUDIENCE,
  NOTIFICATION_INDEX,
  normalizeNotificationAudience,
  normalizeNotificationIndex,
} = require("../constants");
const { emitUserEvent } = require("../socket");
const { sendPushToUser } = require("./pushNotificationService");

function buildAudienceListFilter(audience) {
  const normalized = normalizeNotificationAudience(audience, NOTIFICATION_AUDIENCE.BUYER);

  if (normalized === NOTIFICATION_AUDIENCE.SELLER) {
    return {
      $or: [
        { audience: NOTIFICATION_AUDIENCE.SELLER },
        { audience: NOTIFICATION_AUDIENCE.SYSTEM },
        // Thông báo cũ chưa gắn audience: chỉ hiện ở seller để khỏi lẫn sang buyer.
        { audience: { $exists: false } },
        { audience: null },
        { audience: "" },
      ],
    };
  }

  if (normalized === NOTIFICATION_AUDIENCE.SYSTEM) {
    return {
      $or: [
        { audience: NOTIFICATION_AUDIENCE.SYSTEM },
        { audience: { $exists: false } },
        { audience: null },
        { audience: "" },
      ],
    };
  }

  // buyer: không lấy thông báo seller / legacy chưa gắn (tránh lẫn shop → buyer)
  return {
    audience: { $in: [NOTIFICATION_AUDIENCE.BUYER, NOTIFICATION_AUDIENCE.SYSTEM] },
  };
}

async function createNotification(userId, { title, content, audience, index, isAdminBroadcast } = {}) {
  if (!userId) {
    return null;
  }

  const normalizedAudience = normalizeNotificationAudience(
    audience,
    NOTIFICATION_AUDIENCE.SYSTEM
  );
  const normalizedIndex = normalizeNotificationIndex(
    index,
    NOTIFICATION_INDEX.SYSTEM
  );
  const now = new Date();
  const notification = await Notification.create({
    userId,
    title: String(title || "").trim(),
    content: String(content || "").trim(),
    audience: normalizedAudience,
    index: normalizedIndex,
    isAdminBroadcast: Boolean(isAdminBroadcast),
    isRead: 0,
    CreatedAt: now,
    UpdatedAt: now,
  });

  const payload = {
    id: notification._id,
    title: notification.title,
    content: notification.content,
    audience: notification.audience,
    index: notification.index,
    isAdminBroadcast: Boolean(notification.isAdminBroadcast),
    isRead: notification.isRead,
    createdAt: notification.CreatedAt,
  };

  emitUserEvent(String(userId), "notification:new", payload);
  emitUserEvent(String(userId), "notification_created", payload);

  sendPushToUser(userId, {
    title: notification.title,
    content: notification.content,
    data: {
      notificationId: String(notification._id),
      audience: notification.audience,
      type: "in_app_notification",
    },
  }).catch((error) => {
    console.warn("[FCM] createNotification push failed:", error?.message || error);
  });

  return payload;
}

function toClientNotification(notification) {
  return {
    id: String(notification._id),
    title: notification.title || "",
    content: notification.content || "",
    body: notification.content || "",
    audience: notification.audience || NOTIFICATION_AUDIENCE.SYSTEM,
    index: normalizeNotificationIndex(notification.index, NOTIFICATION_INDEX.SYSTEM),
    isAdminBroadcast: Boolean(notification.isAdminBroadcast),
    isRead: Number(notification.isRead) === 1,
    createdAt: notification.CreatedAt || null,
  };
}

async function listNotificationsForUser(userId, { page = 1, limit = 50, audience } = {}) {
  if (!userId) {
    return { items: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 1 } };
  }

  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 50));
  const skip = (currentPage - 1) * pageSize;
  const filter = {
    userId,
    ...buildAudienceListFilter(audience),
  };

  const [items, total] = await Promise.all([
    Notification.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(pageSize).lean(),
    Notification.countDocuments(filter),
  ]);

  return {
    items: items.map(toClientNotification),
    pagination: {
      page: currentPage,
      limit: pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

async function countUnreadNotifications(userId, audience) {
  if (!userId) {
    return 0;
  }

  return Notification.countDocuments({
    userId,
    isRead: { $ne: 1 },
    ...buildAudienceListFilter(audience || NOTIFICATION_AUDIENCE.BUYER),
  });
}

async function emitNotificationReadEvent(userId, { id, audience, all = false } = {}) {
  if (!userId) {
    return;
  }

  const normalizedAudience = normalizeNotificationAudience(
    audience,
    NOTIFICATION_AUDIENCE.BUYER
  );
  const unreadCount = await countUnreadNotifications(userId, normalizedAudience);

  emitUserEvent(String(userId), "notification:read", {
    id: id ? String(id) : "",
    unreadCount,
    audience: normalizedAudience,
    all: Boolean(all),
  });
}

async function markNotificationAsRead(userId, notificationId, { audience } = {}) {
  if (!userId || !notificationId) {
    const error = new Error("Thiếu thông báo.");
    error.statusCode = 400;
    throw error;
  }

  const now = new Date();
  const filter = {
    _id: notificationId,
    userId,
    ...buildAudienceListFilter(audience || NOTIFICATION_AUDIENCE.BUYER),
  };

  const notification = await Notification.findOneAndUpdate(
    filter,
    { $set: { isRead: 1, UpdatedAt: now } },
    { new: true }
  );

  if (!notification) {
    const error = new Error("Không tìm thấy thông báo.");
    error.statusCode = 404;
    throw error;
  }

  await emitNotificationReadEvent(userId, {
    id: notification._id,
    audience: notification.audience || audience,
  });

  return toClientNotification(notification);
}

async function markAllNotificationsAsRead(userId, { audience } = {}) {
  if (!userId) {
    return { updated: 0 };
  }

  const now = new Date();
  const result = await Notification.updateMany(
    {
      userId,
      isRead: { $ne: 1 },
      ...buildAudienceListFilter(audience || NOTIFICATION_AUDIENCE.BUYER),
    },
    { $set: { isRead: 1, UpdatedAt: now } }
  );

  await emitNotificationReadEvent(userId, {
    audience: audience || NOTIFICATION_AUDIENCE.BUYER,
    all: true,
  });

  return { updated: result.modifiedCount || 0 };
}

module.exports = {
  createNotification,
  listNotificationsForUser,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  countUnreadNotifications,
  NOTIFICATION_AUDIENCE,
  NOTIFICATION_INDEX,
};
