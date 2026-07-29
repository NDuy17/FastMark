const Pusher = require("pusher");

let pusherClient = null;

function isPusherConfigured() {
  return Boolean(
    process.env.PUSHER_APP_ID &&
      process.env.PUSHER_KEY &&
      process.env.PUSHER_SECRET
  );
}

function getPusherClient() {
  if (!isPusherConfigured()) {
    return null;
  }

  if (!pusherClient) {
    pusherClient = new Pusher({
      appId: String(process.env.PUSHER_APP_ID).trim(),
      key: String(process.env.PUSHER_KEY).trim(),
      secret: String(process.env.PUSHER_SECRET).trim(),
      cluster: String(process.env.PUSHER_CLUSTER || "ap1").trim(),
      useTLS: String(process.env.PUSHER_ENCRYPTED || "true").trim() !== "false",
    });
  }

  return pusherClient;
}

/**
 * Gửi SĐT + mã OTP qua Pusher (dashboard-channel / realtime-update).
 * Tương đương PusherService.SendSMS trong app WinForms.
 */
async function sendPhoneVerificationCode(phone, code) {
  const normalizedPhone = String(phone || "").trim();
  const normalizedCode = String(code || "").trim();

  if (!normalizedPhone || !normalizedCode) {
    throw new Error("Thiếu số điện thoại hoặc mã xác minh.");
  }

  const client = getPusherClient();
  if (!client) {
    console.warn("[Pusher] Chưa cấu hình PUSHER_APP_ID / PUSHER_KEY / PUSHER_SECRET.");
    return false;
  }

  const channel = String(process.env.PUSHER_PHONE_CHANNEL || "dashboard-channel").trim();
  const event = String(process.env.PUSHER_PHONE_EVENT || "realtime-update").trim();

  await client.trigger(channel, event, {
    phone: normalizedPhone,
    code: normalizedCode,
    createdAt: new Date().toISOString(),
  });

  return true;
}

module.exports = {
  isPusherConfigured,
  sendPhoneVerificationCode,
};
