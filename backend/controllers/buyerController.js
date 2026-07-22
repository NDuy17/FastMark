const messageService = require("../services/messageService");
const buyerReviewService = require("../services/buyerReviewService");
const favoriteProductService = require("../services/favoriteProductService");
const userFollowService = require("../services/userFollowService");
const reportService = require("../services/reportService");
const { success, fail } = require("../utils/apiResponse");

function pickBodyValue(body, keys) {
  if (!body || typeof body !== "object") {
    return "";
  }
  for (const key of keys) {
    if (body[key] !== undefined && body[key] !== null && String(body[key]).trim() !== "") {
      return String(body[key]).trim();
    }
  }
  return "";
}

exports.listConversations = async (req, res) => {
  const conversations = await messageService.listBuyerConversations(req.currentUser);
  return success(res, { data: { conversations } });
};

exports.listShops = async (req, res) => {
  const shops = await messageService.listShopsForBuyer(req.currentUser);
  return success(res, { data: { shops } });
};

exports.startConversation = async (req, res) => {
  const shopId = pickBodyValue(req.body, ["shopId", "shop_id"]);
  if (!shopId) {
    return fail(res, { status: 400, message: "Thiếu shopId." });
  }

  const content = pickBodyValue(req.body, ["content", "message"]);
  const shopName = pickBodyValue(req.body, ["shopName", "shop_name"]);
  const messageType = req.body.messageType;
  const imageContent = pickBodyValue(req.body, ["imageContent", "imageUri"]);

  const result = await messageService.startConversationWithShop(req.currentUser, shopId, {
    shopName,
    content,
    messageType,
    imageContent,
  });

  return success(res, {
    message: "Đã mở cuộc trò chuyện.",
    data: result,
  });
};

exports.listMessages = async (req, res) => {
  const result = await messageService.listBuyerConversationMessages(
    req.currentUser,
    req.params.id
  );
  return success(res, { data: result });
};

exports.sendMessage = async (req, res) => {
  const content = pickBodyValue(req.body, ["content", "message"]);
  const imageContent = pickBodyValue(req.body, ["imageContent", "imageUri"]);
  const messageType = req.body.messageType;

  if (!content && !imageContent && Number(messageType) !== 1) {
    return fail(res, { status: 400, message: "Thiếu nội dung tin nhắn." });
  }

  const message = await messageService.sendBuyerMessage(req.currentUser, req.params.id, {
    content,
    messageType,
    imageContent,
  });

  return success(res, {
    message: "Đã gửi tin nhắn.",
    data: { message },
  });
};

exports.deleteMessage = async (req, res) => {
  const message = await messageService.deleteMessage(
    req.currentUser,
    req.params.id,
    req.params.messageId,
    { asSeller: false }
  );

  return success(res, {
    message: "Đã gỡ tin nhắn.",
    data: {
      message,
      lastMessage: message.conversationLastMessage || "",
    },
  });
};

exports.getConversationPeer = async (req, res) => {
  const peer = await messageService.getBuyerConversationPeer(req.currentUser, req.params.id);
  return success(res, { data: { peer } });
};

exports.listReviews = async (req, res) => {
  const reviews = await buyerReviewService.listBuyerReviews(req.currentUser);
  return success(res, { data: { reviews } });
};

exports.createReview = async (req, res) => {
  const rating = req.body.rating;
  if (rating === undefined || rating === null || rating === "") {
    return fail(res, { status: 400, message: "Vui lòng chọn số sao." });
  }

  const review = await buyerReviewService.createBuyerReview(req.currentUser, {
    productId: pickBodyValue(req.body, ["productId", "product_id"]),
    reservationId: pickBodyValue(req.body, [
      "reservationId",
      "reservation_id",
      "orderCode",
      "order_code",
    ]),
    shopId: pickBodyValue(req.body, ["shopId", "shop_id", "storeId", "store_id"]),
    rating,
    comment: pickBodyValue(req.body, ["comment", "message", "content"]),
    images: req.body?.images || req.body?.imageUrls || undefined,
    imageUrl: pickBodyValue(req.body, ["imageUrl", "image_url", "imageContent", "imageUri"]),
  });

  return success(res, {
    status: 201,
    message: "Đã gửi đánh giá.",
    data: { review },
  });
};

exports.updateReview = async (req, res) => {
  const review = await buyerReviewService.updateBuyerReview(req.currentUser, req.params.id, {
    rating: req.body.rating,
    comment: req.body.comment ?? req.body.content,
    images: req.body?.images || req.body?.imageUrls,
    imageUrl: pickBodyValue(req.body, ["imageUrl", "image_url", "imageContent", "imageUri"]),
  });
  return success(res, {
    message: "Đã cập nhật đánh giá.",
    data: { review },
  });
};

exports.deleteReview = async (req, res) => {
  await buyerReviewService.deleteBuyerReview(req.currentUser, req.params.id);
  return success(res, { message: "Đã xóa đánh giá." });
};

exports.listFavorites = async (req, res) => {
  const result = await favoriteProductService.listFavorites(req.currentUser, req.query);
  if (Array.isArray(result)) {
    return success(res, { data: { favorites: result } });
  }
  return success(res, { data: result });
};

exports.listFavoriteIds = async (req, res) => {
  const productIds = await favoriteProductService.listFavoriteProductIds(req.currentUser);
  return success(res, { data: { productIds } });
};

exports.addFavorite = async (req, res) => {
  const productId = pickBodyValue(req.body, ["productId", "product_id"]);
  if (!productId) {
    return fail(res, { status: 400, message: "Thiếu productId." });
  }

  const favorite = await favoriteProductService.addFavorite(req.currentUser, productId);
  return success(res, {
    status: 201,
    message: "Đã thêm vào yêu thích.",
    data: { favorite },
  });
};

exports.removeFavorite = async (req, res) => {
  const result = await favoriteProductService.removeFavorite(req.currentUser, req.params.productId);
  return success(res, {
    message: "Đã bỏ yêu thích.",
    data: result,
  });
};

exports.followShop = async (req, res) => {
  const result = await userFollowService.followUser(req.currentUser, {
    followedUserId: pickBodyValue(req.body, [
      "followedUserId",
      "userId",
      "sellerUserId",
      "targetId",
    ]),
    shopId: pickBodyValue(req.body, ["shopId", "shop_id"]),
  });
  return success(res, {
    status: 201,
    message: "Đã theo dõi.",
    data: result,
  });
};

exports.unfollowShop = async (req, res) => {
  const result = await userFollowService.unfollowUser(req.currentUser, {
    followedUserId:
      pickBodyValue(req.params, ["targetId"]) ||
      pickBodyValue(req.body, ["followedUserId", "userId", "sellerUserId", "targetId"]) ||
      pickBodyValue(req.query, ["followedUserId", "userId", "sellerUserId"]),
    shopId:
      pickBodyValue(req.params, ["targetId", "shopId"]) ||
      pickBodyValue(req.body, ["shopId", "shop_id"]) ||
      pickBodyValue(req.query, ["shopId", "shop_id"]),
    targetId: pickBodyValue(req.params, ["targetId"]),
  });
  return success(res, {
    message: "Đã bỏ theo dõi.",
    data: result,
  });
};

exports.getFollowStatus = async (req, res) => {
  const result = await userFollowService.getFollowStatus(req.currentUser, {
    followedUserId: pickBodyValue(req.query, [
      "followedUserId",
      "userId",
      "sellerUserId",
      "targetId",
    ]),
    shopId: pickBodyValue(req.query, ["shopId", "shop_id"]),
  });
  return success(res, { data: result });
};

exports.listFollowing = async (req, res) => {
  const result = await userFollowService.listFollowing(req.currentUser, req.query);
  return success(res, { data: result });
};

exports.listFollowers = async (req, res) => {
  const result = await userFollowService.listFollowers(req.currentUser, req.query);
  return success(res, { data: result });
};

exports.createReport = async (req, res) => {
  const title = pickBodyValue(req.body, ["title", "reason"]);
  const content = pickBodyValue(req.body, ["content", "message", "note"]);
  if (!title && !content) {
    return fail(res, { status: 400, message: "Vui lòng nhập nội dung tố cáo." });
  }

  const report = await reportService.createReport(req.currentUser, {
    reportType: req.body.reportType,
    shopId: pickBodyValue(req.body, ["shopId", "shop_id", "storeId", "store_id"]),
    shopName: pickBodyValue(req.body, ["shopName", "shop_name", "storeName", "store_name"]),
    productId: pickBodyValue(req.body, ["productId", "product_id"]),
    productName: pickBodyValue(req.body, ["productName", "product_name"]),
    reviewId: pickBodyValue(req.body, ["reviewId", "review_id"]),
    reviewerName: pickBodyValue(req.body, ["reviewerName", "userName", "user_name"]),
    targetUserId: pickBodyValue(req.body, ["targetUserId", "target_user_id"]),
    title,
    content,
    images: req.body.images || req.body.imageUrls || [],
  });

  return success(res, {
    message: "Đã gửi báo cáo vi phạm.",
    data: { report },
  });
};
