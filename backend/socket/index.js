const { Server } = require("socket.io");
const { auth } = require("../config/firebaseAdmin");
const { findUserByFirebaseUid } = require("../services/userService");
const presenceService = require("../services/presenceService");
const User = require("../models/User");
const { USER_ROLE } = require("../constants");

let io = null;
const userConnectionCounts = new Map();

function incrementUserConnections(userId) {
  const key = String(userId || "");
  if (!key) {
    return 0;
  }
  const next = (userConnectionCounts.get(key) || 0) + 1;
  userConnectionCounts.set(key, next);
  return next;
}

function decrementUserConnections(userId) {
  const key = String(userId || "");
  if (!key) {
    return 0;
  }
  const next = Math.max(0, (userConnectionCounts.get(key) || 1) - 1);
  if (next === 0) {
    userConnectionCounts.delete(key);
  } else {
    userConnectionCounts.set(key, next);
  }
  return next;
}

async function markUserDisconnected(userId) {
  if (!userId) {
    return;
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return;
    }
    await presenceService.setUserOffline(user);
    await presenceService.setShopOffline(user);
  } catch (error) {
    console.warn("[presence] socket disconnect offline failed:", error?.message || error);
  }
}

function initSocket(server) {
  io = new Server(server, {
    cors: { origin: "*" },
    transports: ["websocket", "polling"],
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error("Unauthorized"));
      }

      const decoded = await auth.verifyIdToken(token);
      const user = await findUserByFirebaseUid(decoded.uid);
      if (!user) {
        return next(new Error("User not found"));
      }

      socket.userId = String(user._id);
      socket.mongoUser = user;
      next();
    } catch (error) {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    incrementUserConnections(socket.userId);
    socket.join(`user:${socket.userId}`);

    if (Number(socket.mongoUser?.Role) === USER_ROLE.ADMIN) {
      socket.join("admin:all");
      socket.join("admin:reservations");
    }

    socket.on("disconnect", () => {
      const remaining = decrementUserConnections(socket.userId);
      if (remaining === 0) {
        markUserDisconnected(socket.userId);
      }
    });
  });

  return io;
}

function getIO() {
  return io;
}

function emitUserEvent(userId, event, payload) {
  if (!io || !userId) {
    return;
  }
  io.to(`user:${userId}`).emit(event, payload);
}

module.exports = {
  initSocket,
  getIO,
  emitUserEvent,
};
