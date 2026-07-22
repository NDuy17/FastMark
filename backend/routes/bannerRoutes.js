const express = require("express");
const bannerController = require("../controllers/bannerController");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.get("/active", asyncHandler(bannerController.listActive));
router.post("/:id/click", asyncHandler(bannerController.recordClick));

module.exports = router;
