const express = require("express");
const walletController = require("../controllers/walletController");
const verifyFirebaseToken = require("../middleware/authMiddleware");
const { verifyFirebaseTokenAllowBlocked } = require("../middleware/authMiddleware");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.get("/", verifyFirebaseTokenAllowBlocked, asyncHandler(walletController.getWallet));
router.get(
  "/transactions",
  verifyFirebaseTokenAllowBlocked,
  asyncHandler(walletController.listTransactions)
);
router.get(
  "/transactions/:id",
  verifyFirebaseTokenAllowBlocked,
  asyncHandler(walletController.getTransaction)
);
router.post("/topup", verifyFirebaseToken, asyncHandler(walletController.createTopup));
router.post("/topup/sync", verifyFirebaseToken, asyncHandler(walletController.syncTopup));
router.post("/topup/cancel", verifyFirebaseToken, asyncHandler(walletController.cancelTopup));

const withdrawController = require("../controllers/withdrawController");
router.get(
  "/banks",
  verifyFirebaseTokenAllowBlocked,
  asyncHandler(withdrawController.listActiveBanks)
);
router.get(
  "/withdraws",
  verifyFirebaseTokenAllowBlocked,
  asyncHandler(withdrawController.listMyWithdraws)
);
router.post(
  "/withdraw",
  verifyFirebaseTokenAllowBlocked,
  asyncHandler(withdrawController.createWithdraw)
);

module.exports = router;
