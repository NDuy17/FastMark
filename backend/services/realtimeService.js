const { emitUserEvent, getIO } = require("../socket");

const ADMIN_ROOM = "admin:all";

function buildPayload(type, payload = {}) {
  return {
    type: String(type || "").trim(),
    updatedAt: new Date().toISOString(),
    ...payload,
  };
}

function emitAdminUpdated(type, payload = {}) {
  const io = getIO();
  if (!io) {
    return;
  }

  const eventPayload = buildPayload(type, payload);
  io.to(ADMIN_ROOM).emit("admin_updated", eventPayload);

  const normalizedType = String(type || "").trim();
  if (normalizedType) {
    io.to(ADMIN_ROOM).emit(`${normalizedType}_updated`, eventPayload);
  }

  if (normalizedType === "order" || normalizedType === "reservation") {
    io.to(ADMIN_ROOM).emit("order_updated", eventPayload);
    io.to("admin:reservations").emit("order_updated", eventPayload);
  }
}

function emitUserResourceUpdated(userId, type, payload = {}) {
  if (!userId) {
    return;
  }

  const eventPayload = buildPayload(type, payload);
  const userKey = String(userId);
  emitUserEvent(userKey, "resource_updated", eventPayload);

  const normalizedType = String(type || "").trim();
  if (normalizedType) {
    emitUserEvent(userKey, `${normalizedType}_updated`, eventPayload);
  }
}

function emitPublicUpdated(type, payload = {}) {
  const io = getIO();
  if (!io) {
    return;
  }

  const eventPayload = buildPayload(type, payload);
  io.emit("public_updated", eventPayload);

  const normalizedType = String(type || "").trim();
  if (normalizedType) {
    io.emit(`${normalizedType}_updated`, eventPayload);
  }
}

module.exports = {
  ADMIN_ROOM,
  emitAdminUpdated,
  emitUserResourceUpdated,
  emitPublicUpdated,
};
