const Notification = require("../models/Notification,js");
const { emitUserEvent } = require("../socket");

async function createNotification(userId, { title, content } = {}) {
  if (!userId) {
    return null;
  }

  const now = new Date();
  const notification = await Notification.create({
    userId,
    title: String(title || "").trim(),
    content: String(content || "").trim(),
    isRead: 0,
    CreatedAt: now,
    UpdatedAt: now,
  });

  const payload = {
    id: notification._id,
    title: notification.title,
    content: notification.content,
    isRead: notification.isRead,
    createdAt: notification.CreatedAt,
  };

  emitUserEvent(String(userId), "notification:new", payload);

  return payload;
}

module.exports = {
  createNotification,
};
