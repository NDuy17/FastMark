const Review = require("../models/Review");
const User = require("../models/User");
const ShopProfile = require("../models/ShopProfile");
const Product = require("../models/Product");
const { refreshShopReviewStats, loadReviewImagesMap } = require("./buyerReviewService");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickString(value) {
  return String(value || "").trim();
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isStrictMongoObjectId(value) {
  return /^[a-f\d]{24}$/i.test(pickString(value));
}

function toReviewerSummary(user, fallbackName = "") {
  if (!user) {
    return {
      fullName: fallbackName || "Khách hàng",
      email: "",
      userName: "",
    };
  }

  return {
    fullName: user.FullName || fallbackName || "Khách hàng",
    email: user.Email || "",
    userName: user.UserName || "",
    avatar: user.Avatar || "",
  };
}

async function buildReviewFilter({ search, rating, status }) {
  const filter = {
    isDeleted: { $ne: true },
  };
  const normalizedRating = pickString(rating);
  const normalizedStatus = pickString(status);
  const keyword = pickString(search);

  if (normalizedRating !== "" && Number(normalizedRating) >= 1 && Number(normalizedRating) <= 5) {
    filter.rating = Number(normalizedRating);
  }

  if (normalizedStatus === "visible") {
    filter.isHidden = { $ne: true };
  } else if (normalizedStatus === "hidden") {
    filter.isHidden = true;
  }

  if (!keyword) {
    return filter;
  }

  const regex = new RegExp(escapeRegex(keyword), "i");
  const [matchedUsers, matchedShops, matchedProducts] = await Promise.all([
    User.find({
      $or: [{ UserName: regex }, { FullName: regex }, { Email: regex }],
    })
      .select("_id")
      .lean(),
    ShopProfile.find({
      $or: [{ shopName: regex }, { description: regex }],
    })
      .select("_id")
      .lean(),
    Product.find({ ProductName: regex }).select("_id").lean(),
  ]);

  const userIds = matchedUsers.map((user) => user._id);
  const shopIds = matchedShops.map((shop) => shop._id);
  const productIds = matchedProducts.map((product) => product._id);

  filter.$or = [
    { comment: regex },
    ...(userIds.length ? [{ userId: { $in: userIds } }] : []),
    ...(shopIds.length ? [{ shopId: { $in: shopIds } }] : []),
    ...(productIds.length ? [{ productId: { $in: productIds } }] : []),
  ];

  return filter;
}

async function enrichReviews(reviews) {
  const userIds = reviews.map((row) => row.userId).filter(Boolean);
  const shopIds = reviews.map((row) => row.shopId).filter(Boolean);
  const productIds = reviews.map((row) => row.productId).filter(Boolean);
  const reviewIds = reviews.map((row) => row._id).filter(Boolean);

  const [users, shops, products, imagesByReview] = await Promise.all([
    userIds.length ? User.find({ _id: { $in: userIds } }).lean() : [],
    shopIds.length ? ShopProfile.find({ _id: { $in: shopIds } }).select("shopName").lean() : [],
    productIds.length
      ? Product.find({ _id: { $in: productIds } }).select("ProductName").lean()
      : [],
    loadReviewImagesMap(reviewIds),
  ]);

  const userById = new Map(users.map((user) => [String(user._id), user]));
  const shopById = new Map(shops.map((shop) => [String(shop._id), shop]));
  const productById = new Map(products.map((product) => [String(product._id), product]));

  return reviews.map((review) => {
    const user = review.userId ? userById.get(String(review.userId)) : null;
    const shop = review.shopId ? shopById.get(String(review.shopId)) : null;
    const product = review.productId ? productById.get(String(review.productId)) : null;
    const images = imagesByReview.get(String(review._id)) || [];

    return {
      id: String(review._id),
      reviewer: toReviewerSummary(user),
      shopId: review.shopId ? String(review.shopId) : "",
      shopName: shop?.shopName || "—",
      productId: review.productId ? String(review.productId) : "",
      productName: product?.ProductName || "—",
      reservationId: review.reservationId ? String(review.reservationId) : "",
      rating: review.rating,
      comment: review.comment || "",
      images,
      imageUrl: images[0]?.imageUrl || "",
      createdAt: review.CreatedAt || null,
      isHidden: Boolean(review.isHidden),
      deletedAt: review.deletedAt || null,
    };
  });
}

async function listReviews({
  page = 1,
  limit = 20,
  search = "",
  rating = "",
  status = "",
} = {}) {
  const pageSize = Math.min(50, Math.max(1, Number(limit) || 20));
  const pageNumber = Math.max(1, Number(page) || 1);
  const skip = (pageNumber - 1) * pageSize;
  const filter = await buildReviewFilter({ search, rating, status });

  const [reviews, total] = await Promise.all([
    Review.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(pageSize).lean(),
    Review.countDocuments(filter),
  ]);

  const items = await enrichReviews(reviews);

  return {
    items,
    pagination: {
      page: pageNumber,
      limit: pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    meta: {
      dataSource: "mongodb",
      collection: "reviews",
    },
  };
}

async function findReviewByPublicId(publicId) {
  const normalized = pickString(publicId);
  if (!normalized || !isStrictMongoObjectId(normalized)) {
    throw createServiceError("Không tìm thấy đánh giá.", 404);
  }

  const review = await Review.findById(normalized);
  if (!review) {
    throw createServiceError("Không tìm thấy đánh giá.", 404);
  }
  return review;
}

async function setReviewVisibility(publicId, isHidden) {
  const review = await findReviewByPublicId(publicId);
  if (review.isDeleted) {
    throw createServiceError("Đánh giá đã bị xóa mềm.", 400);
  }

  review.isHidden = Boolean(isHidden);
  review.UpdatedAt = new Date();
  await review.save();
  await refreshShopReviewStats(review.shopId);

  const [item] = await enrichReviews([review.toObject()]);
  return item;
}

async function softDeleteReview(publicId) {
  const review = await findReviewByPublicId(publicId);
  if (review.isDeleted) {
    throw createServiceError("Đánh giá đã bị xóa mềm.", 400);
  }

  const now = new Date();
  review.isDeleted = true;
  review.isHidden = true;
  review.deletedAt = now;
  review.UpdatedAt = now;
  await review.save();
  await refreshShopReviewStats(review.shopId);

  return { id: String(review._id), deletedAt: now };
}

module.exports = {
  listReviews,
  setReviewVisibility,
  softDeleteReview,
  findReviewByPublicId,
};
