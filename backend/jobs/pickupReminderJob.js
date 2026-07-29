const reservationService = require("../services/reservationService");

/** Nhắc nhận hàng trước 15 phút — chạy mỗi phút. */
const DEFAULT_INTERVAL_MS = 60 * 1000;

function startPickupReminderJob(intervalMs = DEFAULT_INTERVAL_MS) {
  const run = async () => {
    try {
      const result = await reservationService.sendPickupReminders();
      if (result.sentCount > 0) {
        console.log(`[pickup-reminder] sent=${result.sentCount}`);
      }
    } catch (error) {
      console.error("[pickup-reminder] job failed:", error.message);
    }
  };

  setTimeout(run, 8000);
  const timer = setInterval(run, intervalMs);
  if (typeof timer.unref === "function") {
    timer.unref();
  }
  return timer;
}

module.exports = {
  startPickupReminderJob,
};
