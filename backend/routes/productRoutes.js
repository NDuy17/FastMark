const express = require("express");
const productController = require("../controllers/productController");
const verifyFirebaseToken = require("../middleware/authMiddleware");
const requireSeller = require("../middleware/sellerMiddleware");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.get("/categories", asyncHandler(productController.listCategories));
router.get("/discover", asyncHandler(productController.discoverProducts));
router.get("/promotions", asyncHandler(productController.listPromotions));
router.get(
  "/promotions/mine",
  verifyFirebaseToken,
  asyncHandler(requireSeller),
  asyncHandler(productController.listMyPromotions)
);
router.post(
  "/promotions/bulk",
  verifyFirebaseToken,
  asyncHandler(requireSeller),
  asyncHandler(productController.bulkSetPromotions)
);

router.get(
  "/mine/:id",
  verifyFirebaseToken,
  asyncHandler(requireSeller),
  asyncHandler(productController.getMyProduct)
);

router.get(
  "/",
  verifyFirebaseToken,
  asyncHandler(requireSeller),
  asyncHandler(productController.listMyProducts)
);

router.post(
  "/",
  verifyFirebaseToken,
  asyncHandler(requireSeller),
  asyncHandler(productController.createProduct)
);

router.put(
  "/:id",
  verifyFirebaseToken,
  asyncHandler(requireSeller),
  asyncHandler(productController.updateProduct)
);

router.post(
  "/:id/promotion",
  verifyFirebaseToken,
  asyncHandler(requireSeller),
  asyncHandler(productController.setPromotion)
);
router.put(
  "/:id/promotion",
  verifyFirebaseToken,
  asyncHandler(requireSeller),
  asyncHandler(productController.setPromotion)
);
router.delete(
  "/:id/promotion",
  verifyFirebaseToken,
  asyncHandler(requireSeller),
  asyncHandler(productController.clearPromotion)
);

router.put(
  "/:id/pin",
  verifyFirebaseToken,
  asyncHandler(requireSeller),
  asyncHandler(productController.setProductPin)
);

router.delete(
  "/:id",
  verifyFirebaseToken,
  asyncHandler(requireSeller),
  asyncHandler(productController.softDeleteProduct)
);

router.get("/:id", asyncHandler(productController.getProduct));

module.exports = router;
