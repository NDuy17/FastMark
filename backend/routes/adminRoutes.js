const express = require("express");
const verifyFirebaseToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");
const asyncHandler = require("../utils/asyncHandler");
const adminAccountController = require("../controllers/adminAccountController");

const router = express.Router();

router.get(
  "/accounts",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(adminAccountController.listAccounts)
);
router.get(
  "/accounts/:id",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(adminAccountController.getAccountDetail)
);
router.post(
  "/accounts/:id/block",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(adminAccountController.blockAccount)
);
router.post(
  "/accounts/:id/unblock",
  verifyFirebaseToken,
  requireAdmin,
  asyncHandler(adminAccountController.unblockAccount)
);

module.exports = router;
