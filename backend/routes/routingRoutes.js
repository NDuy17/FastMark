const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const routingController = require("../controllers/routingController");

const router = express.Router();

router.get("/route", asyncHandler(routingController.getRoute));
router.get("/distance", asyncHandler(routingController.getRouteDistance));
router.get("/table", asyncHandler(routingController.getRouteTable));

module.exports = router;
