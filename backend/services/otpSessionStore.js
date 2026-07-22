/**
 * Phiên OTP tạm trên process (không ghi vào User).
 * Hết hạn / restart server → phải gửi lại mã — đúng với luồng màn hình xác minh.
 */

const sessions = new Map();

function buildKey(purpose, userId) {
  return `${String(purpose)}:${String(userId)}`;
}

function pruneIfExpired(key, session) {
  if (!session) {
    return null;
  }
  if (session.expiresAt && Date.now() > new Date(session.expiresAt).getTime()) {
    sessions.delete(key);
    return null;
  }
  return session;
}

function getOtpSession(purpose, userId) {
  const key = buildKey(purpose, userId);
  return pruneIfExpired(key, sessions.get(key));
}

function setOtpSession(purpose, userId, payload) {
  const key = buildKey(purpose, userId);
  const next = {
    target: String(payload.target || ""),
    code: String(payload.code || ""),
    expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
    resendAt: payload.resendAt ? new Date(payload.resendAt) : null,
    failCount: Number(payload.failCount) || 0,
  };
  sessions.set(key, next);
  return next;
}

function clearOtpSession(purpose, userId) {
  sessions.delete(buildKey(purpose, userId));
}

function bumpOtpFailCount(purpose, userId) {
  const key = buildKey(purpose, userId);
  const session = pruneIfExpired(key, sessions.get(key));
  if (!session) {
    return null;
  }
  session.failCount = (Number(session.failCount) || 0) + 1;
  sessions.set(key, session);
  return session;
}

const OTP_PURPOSE = {
  EMAIL_VERIFY: "email_verify",
  PASSWORD_RESET: "password_reset",
  PHONE_VERIFY: "phone_verify",
};

module.exports = {
  OTP_PURPOSE,
  getOtpSession,
  setOtpSession,
  clearOtpSession,
  bumpOtpFailCount,
};
