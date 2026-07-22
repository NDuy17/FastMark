const crypto = require("crypto");
const Review = require("../models/Review");
const ReviewImage = require("../models/ReviewImage");
const Reservation = require("../models/Reservation");
const Product = require("../models/Product");
const ShopProfile = require("../models/ShopProfile");
const User = require("../models/User");
const { RESERVATION_STATUS } = require("../constants");
const { uploadImageToSupabase, resolveFileExtension } = require("./uploadService");

const REVIEWABLE_STATUSES = [
  RESERVATION_STATUS.COMPLETED,
  RESERVATION_STATUS.AUTO_COMPLETED,
];

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickString(value) {
  return String(value || "").trim();
}

function isStrictMongoObjectId(value) {
  return /^[a-f\d]{24}$/i.test(pickString(value));
}

function normalizeRating(value) {
  const rating = Number(value);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw createServiceError("Vui lòng chọn số sao từ 1 đến 5.");
  }
  return Math.round(rating);
}

async function resolveImageUrl(imageInput) {
  if (imageInput && typeof imageInput === "object") {
    const existing = pickString(imageInput.imageUrl || imageInput.ImageUrl);
    if (existing) {
      return existing;
    }
    const base64 = imageInput.imageBase64 || imageInput.ImageBase64 || imageInput.base64;
    if (base64) {
      return resolveImageUrl(
        String(base64).startsWith("data:")
          ? base64
          : `data:${imageInput.mimeType || "image/jpeg"};base64,${base64}`
      );
    }
  }

  const raw = pickString(imageInput);
  if (!raw) {
    return "";
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  const match = raw.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) {
    return raw;
  }

  const mimeType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  const uploaded = await uploadImageToSupabase({
    buffer,
    mimeType,
    folder: "review-images",
    fileName: `review-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${resolveFileExtension(mimeType)}`,
  });
  return uploaded.publicUrl;
}

function collectImageInputs(payload = {}) {
  if (Array.isArray(payload.images) && payload.images.length) {
    return payload.images;
  }
  if (Array.isArray(payload.imageUrls) && payload.imageUrls.length) {
    return payload.imageUrls;
  }
  const single =
    payload.imageUrl ||
    payload.image_url ||
    payload.imageContent ||
    payload.imageUri ||
    null;
  return single ? [single] : [];
}

async function replaceReviewImages(reviewId, imageInputs = []) {
  await ReviewImage.deleteMany({ reviewId });
  const urls = [];
  for (let index = 0; index < imageInputs.length; index += 1) {
    const url = await resolveImageUrl(imageInputs[index]);
    if (url) {
      urls.push(url);
    }
  }
  if (!urls.length) {
    return [];
  }
  const now = new Date();
  return ReviewImage.insertMany(
    urls.map((imageUrl, index) => ({
      reviewId,
      ImageUrl: imageUrl,
      Stt: index,
      UploadedAt: now,
    }))
  );
}

async function loadReviewImagesMap(reviewIds = []) {
  if (!reviewIds.length) {
    return new Map();
  }
  const rows = await ReviewImage.find({ reviewId: { $in: reviewIds } }).sort({
    Stt: 1,
    UploadedAt: 1,
  });
  return rows.reduce((map, row) => {
    const key = String(row.reviewId);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push({
      id: row._id,
      imageUrl: row.ImageUrl,
      stt: Number(row.Stt) || 0,
      uploadedAt: row.UploadedAt || null,
    });
    return map;
  }, new Map());
}

async function toPublicReview(review, extras = {}) {
  const user =
    extras.user ||
    (review.userId
      ? await User.findById(review.userId).select("FullName UserName Avatar").lean()
      : null);
  const product =
    extras.product ||
    (review.productId
      ? await Product.findById(review.productId).select("ProductName").lean()
      : null);
  const shop =
    extras.shop ||
    (review.shopId ? await ShopProfile.findById(review.shopId).select("shopName").lean() : null);
  const images =
    extras.images ||
    (await loadReviewImagesMap([review._id])).get(String(review._id)) ||
    [];

  const userName = pickString(user?.FullName) || pickString(user?.UserName) || "Khách hàng";
  const avatar = pickString(user?.Avatar);
  const productName = pickString(product?.ProductName);
  let shopName = pickString(shop?.shopName);
  if (!shopName && shop?.userId) {
    const owner =
      extras.shopOwner ||
      (await User.findById(shop.userId).select("FullName UserName").lean());
    shopName = pickString(owner?.FullName) || pickString(owner?.UserName);
  }
  if (!shopName) {
    shopName = pickString(shop?.description);
  }
  const imageUrl = images[0]?.imageUrl || "";

  return {
    id: String(review._id),
    userId: review.userId ? String(review.userId) : "",
    shopId: review.shopId ? String(review.shopId) : "",
    storeId: review.shopId ? String(review.shopId) : "",
    store_id: review.shopId ? String(review.shopId) : "",
    storeName: shopName,
    productId: review.productId ? String(review.productId) : "",
    productName,
    reservationId: review.reservationId ? String(review.reservationId) : "",
    orderCode: review.reservationId ? String(review.reservationId) : "",
    userName,
    user_name: userName,
    avatar,
    photoUrl: avatar,
    rating: review.rating,
    comment: review.comment || "",
    images,
    imageUrl,
    image_url: imageUrl,
    createdAt: review.CreatedAt || null,
    created_at: review.CreatedAt || null,
    isHidden: Boolean(review.isHidden),
  };
}

async function refreshShopReviewStats(shopId) {
  const id = pickString(shopId);
  if (!id || !isStrictMongoObjectId(id)) {
    return null;
  }

  const shop = await ShopProfile.findById(id);
  if (!shop) {
    return null;
  }

  const reviews = await Review.find({
    shopId: id,
    isDeleted: { $ne: true },
    isHidden: { $ne: true },
  }).lean();

  const total = reviews.length;
  const averageRating =
    total > 0
      ? Math.round((reviews.reduce((sum, row) => sum + Number(row.rating || 0), 0) / total) * 10) /
        10
      : 0;

  shop.totalReviews = total;
  shop.averageRating = averageRating;
  shop.UpdatedAt = new Date();
  await shop.save();
  return shop;
}

async function assertPurchasedProduct(user, { productId, reservationId, shopId } = {}) {
  const productObjectId = pickString(productId);
  if (!productObjectId || !isStrictMongoObjectId(productObjectId)) {
    throw createServiceError("Thiếu productId hợp lệ.");
  }

  const product = await Product.findById(productObjectId).lean();
  if (!product) {
    throw createServiceError("Không tìm thấy sản phẩm.", 404);
  }

  const filter = {
    userId: user._id,
    productId: product._id,
    status: { $in: REVIEWABLE_STATUSES },
  };

  if (reservationId && isStrictMongoObjectId(pickString(reservationId))) {
    filter._id = pickString(reservationId);
  }

  const reservation = await Reservation.findOne(filter).sort({ completedAt: -1, UpdatedAt: -1 });
  if (!reservation) {
    throw createServiceError("Chỉ đánh giá được sản phẩm bạn đã mua / nhận hàng.", 403);
  }

  if (
    shopId &&
    String(reservation.shopId) !== String(shopId) &&
    String(product.ShopId) !== String(shopId)
  ) {
    throw createServiceError("Sản phẩm không thuộc gian hàng này.", 400);
  }

  return { product, reservation, shopId: reservation.shopId || product.ShopId };
}

async function listBuyerReviews(user) {
  const rows = await Review.find({
    userId: user._id,
    isDeleted: { $ne: true },
  })
    .sort({ CreatedAt: -1 })
    .limit(100)
    .lean();

  const imagesByReview = await loadReviewImagesMap(rows.map((row) => row._id));
  const productIds = rows.map((row) => row.productId).filter(Boolean);
  const shopIds = rows.map((row) => row.shopId).filter(Boolean);
  const [products, shops] = await Promise.all([
    productIds.length
      ? Product.find({ _id: { $in: productIds } }).select("ProductName").lean()
      : [],
    shopIds.length
      ? ShopProfile.find({ _id: { $in: shopIds } }).select("shopName description userId").lean()
      : [],
  ]);
  const ownerIds = shops.map((shop) => shop.userId).filter(Boolean);
  const owners = ownerIds.length
    ? await User.find({ _id: { $in: ownerIds } }).select("FullName UserName").lean()
    : [];
  const productById = new Map(products.map((item) => [String(item._id), item]));
  const shopById = new Map(shops.map((item) => [String(item._id), item]));
  const ownerById = new Map(owners.map((item) => [String(item._id), item]));

  return Promise.all(
    rows.map((row) => {
      const shop = shopById.get(String(row.shopId));
      return toPublicReview(row, {
        user,
        product: productById.get(String(row.productId)),
        shop,
        shopOwner: shop?.userId ? ownerById.get(String(shop.userId)) : null,
        images: imagesByReview.get(String(row._id)) || [],
      });
    })
  );
}

async function createBuyerReview(user, payload = {}) {
  const rating = normalizeRating(payload.rating);
  const reservationId = pickString(
    payload.reservationId || payload.orderCode || payload.order_code
  );
  if (!reservationId || !isStrictMongoObjectId(reservationId)) {
    throw createServiceError("Thiếu reservationId hợp lệ.");
  }

  const { product, reservation, shopId } = await assertPurchasedProduct(user, {
    productId: payload.productId || payload.product_id,
    reservationId,
    shopId: payload.shopId || payload.storeId || payload.store_id,
  });

  const existing = await Review.findOne({
    reservationId: reservation._id,
    isDeleted: { $ne: true },
  });
  if (existing) {
    throw createServiceError("Bạn đã đánh giá đơn hàng này.", 409);
  }

  const now = new Date();
  const review = await Review.create({
    userId: user._id,
    shopId,
    productId: product._id,
    reservationId: reservation._id,
    rating,
    comment: pickString(payload.comment),
    isHidden: false,
    isDeleted: false,
    CreatedAt: now,
    UpdatedAt: now,
  });

  const imageDocs = await replaceReviewImages(review._id, collectImageInputs(payload));
  await refreshShopReviewStats(shopId);

  return toPublicReview(review, {
    user,
    product,
    images: imageDocs.map((doc, index) => ({
      id: doc._id,
      imageUrl: doc.ImageUrl,
      stt: Number(doc.Stt) || index,
      uploadedAt: doc.UploadedAt || null,
    })),
  });
}

async function updateBuyerReview(user, reviewId, payload = {}) {
  const review = await Review.findOne({
    _id: reviewId,
    userId: user._id,
    isDeleted: { $ne: true },
  });
  if (!review) {
    throw createServiceError("Không tìm thấy đánh giá.", 404);
  }

  if (payload.rating !== undefined) {
    review.rating = normalizeRating(payload.rating);
  }
  if (payload.comment !== undefined) {
    review.comment = pickString(payload.comment);
  }
  review.UpdatedAt = new Date();
  await review.save();

  const imageInputs = collectImageInputs(payload);
  let images;
  if (
    imageInputs.length ||
    payload.images !== undefined ||
    payload.imageUrl !== undefined
  ) {
    const imageDocs = await replaceReviewImages(review._id, imageInputs);
    images = imageDocs.map((doc, index) => ({
      id: doc._id,
      imageUrl: doc.ImageUrl,
      stt: Number(doc.Stt) || index,
      uploadedAt: doc.UploadedAt || null,
    }));
  }

  await refreshShopReviewStats(review.shopId);
  return toPublicReview(review, { user, images });
}

async function deleteBuyerReview(user, reviewId) {
  const review = await Review.findOne({
    _id: reviewId,
    userId: user._id,
    isDeleted: { $ne: true },
  });
  if (!review) {
    throw createServiceError("Không tìm thấy đánh giá.", 404);
  }

  const now = new Date();
  review.isDeleted = true;
  review.isHidden = true;
  review.deletedAt = now;
  review.UpdatedAt = now;
  await review.save();

  await refreshShopReviewStats(review.shopId);
  return { id: String(review._id) };
}

module.exports = {
  listBuyerReviews,
  createBuyerReview,
  updateBuyerReview,
  deleteBuyerReview,
  refreshShopReviewStats,
  loadReviewImagesMap,
  toPublicReview,
};
