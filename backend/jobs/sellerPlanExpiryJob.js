const { expireDueSubscriptions } = require("../services/sellerPlanAccessService");

const INTERVAL_MS = 10 * 60 * 1000;
let timer = null;

async function runOnce() {
  try {
    const result = await expireDueSubscriptions({ limit: 300 });
    if (result.expiredSubscriptions > 0 || result.shopsTouched > 0) {
      console.log(
        `[sellerPlanExpiry] expired=${result.expiredSubscriptions} shops=${result.shopsTouched}`
      );
    }
  } catch (error) {
    console.warn("[sellerPlanExpiry] failed:", error.message);
  }
}

function startSellerPlanExpiryJob() {
  if (timer) {
    return;
  }
  runOnce();
  timer = setInterval(runOnce, INTERVAL_MS);
  if (typeof timer.unref === "function") {
    timer.unref();
  }
}

module.exports = { startSellerPlanExpiryJob, runOnce };
