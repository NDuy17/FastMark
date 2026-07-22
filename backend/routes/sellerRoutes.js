const express = require("express");

const sellerController = require("../controllers/sellerController");
const sellerOpsController = require("../controllers/sellerOpsController");
const verifyFirebaseToken = require("../middleware/authMiddleware");
const requireSeller = require("../middleware/sellerMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.post(
  "/phone-code/request",
  verifyFirebaseToken,
  asyncHandler(sellerController.requestPhoneCode)
);
router.post(
  "/phone-code/confirm",
  verifyFirebaseToken,
  asyncHandler(sellerController.confirmPhoneCode)
);
router.get(
  "/verification/me",
  verifyFirebaseToken,
  asyncHandler(sellerController.getMyVerification)
);
router.post(
  "/verification",
  verifyFirebaseToken,
  asyncHandler(sellerController.submitVerification)
);

router.get(
  "/verification/pending",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(sellerController.listPendingVerifications)
);
router.post(
  "/verification/:id/approve",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(sellerController.approveVerification)
);
router.post(
  "/verification/:id/reject",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(sellerController.rejectVerification)
);

router.get("/shop", verifyFirebaseToken, requireSeller, asyncHandler(sellerOpsController.getShopSettings));
router.put("/shop", verifyFirebaseToken, requireSeller, asyncHandler(sellerOpsController.updateShopSettings));
router.post(
  "/shop/username-availability",
  verifyFirebaseToken,
  requireSeller,
  asyncHandler(sellerOpsController.checkShopUsernameAvailability)
);

router.get("/orders", verifyFirebaseToken, requireSeller, asyncHandler(sellerOpsController.listOrders));
router.get(
  "/reservations/:id",
  verifyFirebaseToken,
  requireSeller,
  asyncHandler(sellerOpsController.getReservationDetail)
);
router.post(
  "/reservations/:id/confirm",
  verifyFirebaseToken,
  requireSeller,
  asyncHandler(sellerOpsController.confirmReservation)
);
router.post(
  "/reservations/:id/reject",
  verifyFirebaseToken,
  requireSeller,
  asyncHandler(sellerOpsController.rejectReservation)
);
router.post(
  "/reservations/:id/cancel",
  verifyFirebaseToken,
  requireSeller,
  asyncHandler(sellerOpsController.cancelReservation)
);

/** Alias: seller báo buyer no-show (cùng API /api/reports/seller-report-buyer). */
router.post(
  "/reservations/:id/report-buyer",
  verifyFirebaseToken,
  requireSeller,
  asyncHandler(async (req, res) => {
    const reservationReportController = require("../controllers/reservationReportController");
    req.body = { ...req.body, reservationId: req.params.id };
    return reservationReportController.sellerReportBuyer(req, res);
  })
);

router.get(
  "/conversations",
  verifyFirebaseToken,
  requireSeller,
  asyncHandler(sellerOpsController.listConversations)
);
router.get(
  "/conversations/:id/messages",
  verifyFirebaseToken,
  requireSeller,
  asyncHandler(sellerOpsController.listMessages)
);
router.post(
  "/conversations/:id/messages",
  verifyFirebaseToken,
  requireSeller,
  asyncHandler(sellerOpsController.sendMessage)
);
router.delete(
  "/conversations/:id/messages/:messageId",
  verifyFirebaseToken,
  requireSeller,
  asyncHandler(sellerOpsController.deleteMessage)
);
router.get(
  "/conversations/:id/peer",
  verifyFirebaseToken,
  requireSeller,
  asyncHandler(sellerOpsController.getConversationPeer)
);

router.get("/stats", verifyFirebaseToken, requireSeller, asyncHandler(sellerOpsController.getStats));

const sellerSubscriptionController = require("../controllers/sellerSubscriptionController");
router.get(
  "/subscription",
  verifyFirebaseToken,
  requireSeller,
  asyncHandler(sellerSubscriptionController.getSubscription)
);
router.post(
  "/subscription/purchase",
  verifyFirebaseToken,
  requireSeller,
  asyncHandler(sellerSubscriptionController.purchaseSubscription)
);

const sellerBannerController = require("../controllers/sellerBannerController");
router.get(
  "/banner",
  verifyFirebaseToken,
  requireSeller,
  asyncHandler(sellerBannerController.getMyBanner)
);
router.post(
  "/banner/purchase",
  verifyFirebaseToken,
  requireSeller,
  asyncHandler(sellerBannerController.purchaseBanner)
);
router.put(
  "/banner/creative",
  verifyFirebaseToken,
  requireSeller,
  asyncHandler(sellerBannerController.updateCreative)
);

module.exports = router;
