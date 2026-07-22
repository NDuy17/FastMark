const reservationService = require("../services/reservationService");

/** Cron quyết định cọc mỗi 5 phút khi hết hạn PickupTime + 24h. */
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

function startReservationExpiryJob(intervalMs = DEFAULT_INTERVAL_MS) {
  const run = async () => {
    try {
      const result = await reservationService.expireOverdueReservations();
      if (
        result.cancelledCount > 0 ||
        result.autoCompletedCount > 0 ||
        result.buyerRefundedCount > 0 ||
        result.sellerReleasedCount > 0
      ) {
        console.log(
          `[reservation-expiry] cancelled=${result.cancelledCount} autoCompleted=${result.autoCompletedCount} buyerRefunded=${result.buyerRefundedCount} sellerReleased=${result.sellerReleasedCount}`
        );
      }
    } catch (error) {
      console.error("[reservation-expiry] job failed:", error.message);
    }
  };

  // Initial sweep shortly after boot (wait for Mongo)
  setTimeout(run, 5000);
  const timer = setInterval(run, intervalMs);
  if (typeof timer.unref === "function") {
    timer.unref();
  }
  return timer;
}

module.exports = {
  startReservationExpiryJob,
};
