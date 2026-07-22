const { expireDuePromotions } = require("../services/productPromotionService");

const INTERVAL_MS = 15 * 60 * 1000;
let timer = null;

async function runOnce() {
  try {
    const result = await expireDuePromotions({ limit: 400 });
    if (result.expired > 0) {
      console.log(`[promotionExpiry] expired=${result.expired}`);
    }
  } catch (error) {
    console.warn("[promotionExpiry] failed:", error.message);
  }
}

function startPromotionExpiryJob() {
  if (timer) {
    return;
  }
  runOnce();
  timer = setInterval(runOnce, INTERVAL_MS);
  if (typeof timer.unref === "function") {
    timer.unref();
  }
}

module.exports = { startPromotionExpiryJob, runOnce };
