const express = require("express");
const walletController = require("../controllers/walletController");
const verifyFirebaseToken = require("../middleware/authMiddleware");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.get("/", verifyFirebaseToken, asyncHandler(walletController.getWallet));
router.get(
  "/transactions",
  verifyFirebaseToken,
  asyncHandler(walletController.listTransactions)
);
router.get(
  "/transactions/:id",
  verifyFirebaseToken,
  asyncHandler(walletController.getTransaction)
);
router.post("/topup", verifyFirebaseToken, asyncHandler(walletController.createTopup));
router.post("/topup/sync", verifyFirebaseToken, asyncHandler(walletController.syncTopup));
router.post("/topup/cancel", verifyFirebaseToken, asyncHandler(walletController.cancelTopup));

const withdrawController = require("../controllers/withdrawController");
router.get(
  "/banks",
  verifyFirebaseToken,
  asyncHandler(withdrawController.listActiveBanks)
);
router.get(
  "/withdraws",
  verifyFirebaseToken,
  asyncHandler(withdrawController.listMyWithdraws)
);
router.post(
  "/withdraw",
  verifyFirebaseToken,
  asyncHandler(withdrawController.createWithdraw)
);

module.exports = router;
