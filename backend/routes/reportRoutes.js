const express = require("express");
const verifyFirebaseToken = require("../middleware/authMiddleware");
const requireSeller = require("../middleware/sellerMiddleware");
const asyncHandler = require("../utils/asyncHandler");
const reservationReportController = require("../controllers/reservationReportController");

const router = express.Router();

/**
 * Báo cáo tranh chấp giữ hàng (GPS + ảnh + mô tả).
 * Buyer: SELLER_NO_SHOW | Seller: BUYER_NO_SHOW
 */
router.post(
  "/buyer-report-seller",
  verifyFirebaseToken,
  asyncHandler(reservationReportController.buyerReportSeller)
);

router.post(
  "/seller-report-buyer",
  verifyFirebaseToken,
  requireSeller,
  asyncHandler(reservationReportController.sellerReportBuyer)
);

router.get(
  "/reservation/:reservationId",
  verifyFirebaseToken,
  asyncHandler(reservationReportController.listReservationReports)
);

module.exports = router;
