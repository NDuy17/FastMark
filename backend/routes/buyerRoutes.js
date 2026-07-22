const express = require("express");
const buyerController = require("../controllers/buyerController");
const verifyFirebaseToken = require("../middleware/authMiddleware");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.get(
  "/conversations",
  verifyFirebaseToken,
  asyncHandler(buyerController.listConversations)
);
router.get("/shops", verifyFirebaseToken, asyncHandler(buyerController.listShops));
router.post(
  "/conversations",
  verifyFirebaseToken,
  asyncHandler(buyerController.startConversation)
);
router.get(
  "/conversations/:id/messages",
  verifyFirebaseToken,
  asyncHandler(buyerController.listMessages)
);
router.post(
  "/conversations/:id/messages",
  verifyFirebaseToken,
  asyncHandler(buyerController.sendMessage)
);
router.delete(
  "/conversations/:id/messages/:messageId",
  verifyFirebaseToken,
  asyncHandler(buyerController.deleteMessage)
);
router.get(
  "/conversations/:id/peer",
  verifyFirebaseToken,
  asyncHandler(buyerController.getConversationPeer)
);
router.get("/reviews", verifyFirebaseToken, asyncHandler(buyerController.listReviews));
router.post("/reviews", verifyFirebaseToken, asyncHandler(buyerController.createReview));
router.put("/reviews/:id", verifyFirebaseToken, asyncHandler(buyerController.updateReview));
router.delete("/reviews/:id", verifyFirebaseToken, asyncHandler(buyerController.deleteReview));
router.post("/reports", verifyFirebaseToken, asyncHandler(buyerController.createReport));

const buyerOpsController = require("../controllers/buyerOpsController");

router.get("/favorites", verifyFirebaseToken, asyncHandler(buyerController.listFavorites));
router.get("/favorites/ids", verifyFirebaseToken, asyncHandler(buyerController.listFavoriteIds));
router.post("/favorites", verifyFirebaseToken, asyncHandler(buyerController.addFavorite));
router.delete(
  "/favorites/:productId",
  verifyFirebaseToken,
  asyncHandler(buyerController.removeFavorite)
);

router.get("/follows/status", verifyFirebaseToken, asyncHandler(buyerController.getFollowStatus));
router.get("/follows/following", verifyFirebaseToken, asyncHandler(buyerController.listFollowing));
router.get("/follows/followers", verifyFirebaseToken, asyncHandler(buyerController.listFollowers));
router.post("/follows", verifyFirebaseToken, asyncHandler(buyerController.followShop));
router.delete(
  "/follows/:targetId",
  verifyFirebaseToken,
  asyncHandler(buyerController.unfollowShop)
);
router.delete("/follows", verifyFirebaseToken, asyncHandler(buyerController.unfollowShop));

router.get("/orders", verifyFirebaseToken, asyncHandler(buyerOpsController.listOrders));
router.post("/reservations", verifyFirebaseToken, asyncHandler(buyerOpsController.createReservation));
router.post(
  "/reservations/confirm-received",
  verifyFirebaseToken,
  asyncHandler(buyerOpsController.confirmReceived)
);
router.post(
  "/reservations/validate-shop-qr",
  verifyFirebaseToken,
  asyncHandler(buyerOpsController.validateShopQrScan)
);
router.post(
  "/reservations/report",
  verifyFirebaseToken,
  asyncHandler(buyerOpsController.reportReservation)
);
router.get(
  "/reservations/:id",
  verifyFirebaseToken,
  asyncHandler(buyerOpsController.getReservation)
);
router.post(
  "/reservations/:id/cancel",
  verifyFirebaseToken,
  asyncHandler(buyerOpsController.cancelReservation)
);
router.post(
  "/reservations/:id/confirm-received",
  verifyFirebaseToken,
  asyncHandler(buyerOpsController.confirmReceived)
);
router.post(
  "/reservations/:id/report",
  verifyFirebaseToken,
  asyncHandler(buyerOpsController.reportReservation)
);
router.post(
  "/reservations/:id/forfeit-deposit",
  verifyFirebaseToken,
  asyncHandler(buyerOpsController.forfeitDeposit)
);
router.post(
  "/reservations/forfeit-deposit",
  verifyFirebaseToken,
  asyncHandler(buyerOpsController.forfeitDeposit)
);

module.exports = router;
