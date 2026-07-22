const Report = require("../models/Report");
const ReportImage = require("../models/ReportImage");
const Product = require("../models/Product");
const ShopProfile = require("../models/ShopProfile");
const User = require("../models/User");
const crypto = require("crypto");
const {
  REPORT_STATUS,
  REPORT_TYPE,
  REPORT_TYPE_LABELS,
  ACCOUNT_REPORT_TYPES,
  MAX_ACCOUNT_REPORT_IMAGES,
} = require("../constants");
const { uploadImageToSupabase, resolveFileExtension } = require("./uploadService");

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

function pickShopDisplayName(shop, owner = null) {
  if (!shop && !owner) {
    return "";
  }
  // description là bio — không dùng làm tên gian hàng.
  return (
    pickString(owner?.FullName) ||
    pickString(owner?.UserName) ||
    pickString(shop?.shopName) ||
    ""
  );
}

async function findShopByObjectId(id) {
  if (!isStrictMongoObjectId(id)) {
    return null;
  }
  return ShopProfile.findById(id).lean();
}

async function resolveShopByStoreId(storeId) {
  const rawId = pickString(storeId);
  if (!rawId) {
    throw createServiceError("Thiếu mã gian hàng.", 400);
  }

  const shopByObjectId = await findShopByObjectId(rawId);
  if (shopByObjectId) {
    return shopByObjectId;
  }

  throw createServiceError("Không tìm thấy gian hàng để báo cáo.", 404);
}

async function resolveProductById(productId) {
  const rawId = pickString(productId);
  if (!isStrictMongoObjectId(rawId)) {
    throw createServiceError("Mã sản phẩm không hợp lệ.", 400);
  }

  const product = await Product.findById(rawId).lean();
  if (!product) {
    throw createServiceError("Không tìm thấy sản phẩm để báo cáo.", 404);
  }

  return product;
}

function inferReportType(payload = {}) {
  const CONTENT_TYPES = [
    REPORT_TYPE.REVIEW,
    REPORT_TYPE.USER,
    REPORT_TYPE.SHOP,
    REPORT_TYPE.PRODUCT,
    REPORT_TYPE.SYSTEM,
    REPORT_TYPE.OTHER,
  ];
  const explicitType = Number(payload.reportType);
  if (CONTENT_TYPES.includes(explicitType)) {
    return explicitType;
  }

  if (pickString(payload.reviewId || payload.review_id)) {
    return REPORT_TYPE.REVIEW;
  }

  if (pickString(payload.productId || payload.product_id)) {
    return REPORT_TYPE.PRODUCT;
  }

  if (pickString(payload.shopId || payload.shop_id || payload.storeId || payload.store_id)) {
    return REPORT_TYPE.SHOP;
  }

  return REPORT_TYPE.USER;
}

async function resolveReviewById(reviewId) {
  const rawId = pickString(reviewId);
  if (!isStrictMongoObjectId(rawId)) {
    throw createServiceError("Mã đánh giá không hợp lệ.", 400);
  }

  const Review = require("../models/Review");
  const review = await Review.findOne({
    _id: rawId,
    isDeleted: { $ne: true },
  }).lean();
  if (!review) {
    throw createServiceError("Không tìm thấy đánh giá để báo cáo.", 404);
  }

  return review;
}

async function resolveEvidenceImageUrl(imageInput) {
  if (!imageInput) {
    return "";
  }
  if (typeof imageInput === "string") {
    const raw = imageInput.trim();
    if (!raw) {
      return "";
    }
    if (/^https?:\/\//i.test(raw)) {
      return raw;
    }
    if (/^(file|content|ph):\/\//i.test(raw)) {
      throw createServiceError(
        "Ảnh đính kèm chưa được mã hóa. Vui lòng chọn lại ảnh và gửi lại.",
        400
      );
    }
    if (raw.startsWith("data:image/")) {
      return uploadDataUri(raw);
    }
    // Raw base64 without data-uri prefix
    if (/^[A-Za-z0-9+/=\s]+$/.test(raw) && raw.replace(/\s/g, "").length > 100) {
      return uploadDataUri(`data:image/jpeg;base64,${raw.replace(/\s/g, "")}`);
    }
    return "";
  }

  if (typeof imageInput === "object") {
    const directUrl = pickString(
      imageInput.imageUrl || imageInput.ImageUrl || imageInput.url || imageInput.uri
    );
    if (/^https?:\/\//i.test(directUrl)) {
      return directUrl;
    }
    if (/^(file|content|ph):\/\//i.test(directUrl)) {
      throw createServiceError(
        "Ảnh đính kèm chưa được mã hóa. Vui lòng chọn lại ảnh và gửi lại.",
        400
      );
    }
    const base64 = imageInput.imageBase64 || imageInput.ImageBase64 || imageInput.base64;
    if (base64) {
      const dataUri = String(base64).startsWith("data:")
        ? base64
        : `data:${imageInput.mimeType || "image/jpeg"};base64,${String(base64).replace(/\s/g, "")}`;
      return uploadDataUri(dataUri);
    }
    if (directUrl.startsWith("data:image/")) {
      return uploadDataUri(directUrl);
    }
  }

  return "";
}

async function uploadDataUri(dataUri) {
  const match = String(dataUri || "").match(
    /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/
  );
  if (!match) {
    throw createServiceError("Định dạng ảnh bằng chứng không hợp lệ.", 400);
  }
  const mimeType = match[1];
  const buffer = Buffer.from(String(match[2]).replace(/\s/g, ""), "base64");
  if (!buffer.length) {
    throw createServiceError("Ảnh bằng chứng trống.", 400);
  }
  const extension = resolveFileExtension(mimeType, "jpg");
  const uploaded = await uploadImageToSupabase({
    buffer,
    mimeType,
    folder: "report-images",
    fileName: `report-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${extension}`,
  });
  if (!uploaded?.publicUrl) {
    throw createServiceError("Không lưu được ảnh bằng chứng.", 502);
  }
  return uploaded.publicUrl;
}

async function normalizeImageUrls(images = []) {
  const list = Array.isArray(images) ? images : [];
  if (list.length > MAX_ACCOUNT_REPORT_IMAGES) {
    throw createServiceError(
      `Mỗi báo cáo tối đa ${MAX_ACCOUNT_REPORT_IMAGES} ảnh.`,
      400
    );
  }

  const urls = [];
  for (const item of list) {
    const url = await resolveEvidenceImageUrl(item);
    if (url) {
      urls.push(url);
    }
  }

  if (list.length > 0 && urls.length === 0) {
    throw createServiceError(
      "Không xử lý được ảnh bằng chứng. Vui lòng chọn lại ảnh và gửi lại.",
      400
    );
  }

  return urls;
}

async function saveReportImages(reportId, imageUrls = []) {
  if (!imageUrls.length) {
    return [];
  }
  const docs = await ReportImage.insertMany(
    imageUrls.map((imageUrl) => ({
      reportId,
      imageUrl,
      CreatedAt: new Date(),
    }))
  );
  return docs.map((doc) => ({
    id: String(doc._id),
    imageUrl: doc.imageUrl,
  }));
}

async function createReport(user, payload = {}) {
  const title = pickString(payload.title || payload.reason);
  const note = pickString(payload.content || payload.message || payload.note);
  const reportType = inferReportType(payload);
  const isAccountStyle = ACCOUNT_REPORT_TYPES.includes(reportType);

  if (!title && !note) {
    throw createServiceError("Vui lòng nhập nội dung hoặc chọn loại tố cáo.", 400);
  }

  if (isAccountStyle && !note) {
    throw createServiceError("Vui lòng nhập nội dung tố cáo.", 400);
  }

  const now = new Date();
  const typeLabel = REPORT_TYPE_LABELS[reportType] || "Tố cáo";
  const resolvedTitle = title || typeLabel;

  const reportData = {
    userId: user._id,
    reportType,
    title: resolvedTitle,
    status: REPORT_STATUS.PENDING,
    CreatedAt: now,
    UpdatedAt: now,
  };

  if (reportType === REPORT_TYPE.REVIEW) {
    const review = await resolveReviewById(payload.reviewId || payload.review_id);
    if (String(review.userId) === String(user._id)) {
      throw createServiceError("Bạn không thể báo cáo đánh giá của chính mình.", 400);
    }

    const reviewerName = pickString(payload.reviewerName || payload.userName) || "khách hàng";
    const snippet = pickString(review.comment).slice(0, 120);

    reportData.reviewId = String(review._id);
    reportData.shopId = review.shopId || null;
    reportData.productId = review.productId || null;
    reportData.targetUserId = review.userId || null;
    reportData.content =
      note ||
      `Báo cáo đánh giá của ${reviewerName}${snippet ? `: "${snippet}"` : ""} — ${resolvedTitle}`;
  } else if (reportType === REPORT_TYPE.PRODUCT) {
    const productId = pickString(payload.productId || payload.product_id);
    const product = await resolveProductById(productId);
    const productName = pickString(payload.productName || payload.product_name) || product.ProductName;
    let shop = null;

    if (product.ShopId) {
      shop = await findShopByObjectId(String(product.ShopId));
    }

    const shopOwner = shop?.userId
      ? await User.findById(shop.userId).select("FullName UserName").lean()
      : null;
    const shopDisplayName = pickShopDisplayName(shop, shopOwner);

    reportData.productId = product._id;
    reportData.shopId = shop?._id || product.ShopId || null;
    reportData.targetUserId = shop?.userId || null;
    reportData.content =
      note ||
      `Báo cáo sản phẩm "${productName}"${shopDisplayName ? ` thuộc gian hàng "${shopDisplayName}"` : ""}: ${resolvedTitle}`;
  } else if (reportType === REPORT_TYPE.SHOP) {
    const storeId = pickString(
      payload.shopId || payload.shop_id || payload.storeId || payload.store_id
    );
    const storeName = pickString(
      payload.shopName || payload.shop_name || payload.storeName || payload.store_name
    );

    if (!storeId) {
      throw createServiceError(
        "Thiếu gian hàng bị tố cáo. Hãy báo cáo từ trang gian hàng.",
        400
      );
    }

    const shop = await resolveShopByStoreId(storeId);
    const shopOwner = shop?.userId
      ? await User.findById(shop.userId).select("FullName UserName").lean()
      : null;
    const shopName = storeName || pickShopDisplayName(shop, shopOwner);
    reportData.shopId = shop._id;
    reportData.targetUserId = shop.userId || null;
    reportData.content = note || `Báo cáo gian hàng "${shopName}": ${resolvedTitle}`;
  } else if (reportType === REPORT_TYPE.SYSTEM) {
    reportData.content = note || `Báo cáo lỗi hệ thống: ${resolvedTitle}`;
  } else if (reportType === REPORT_TYPE.OTHER) {
    reportData.content = note || `Tố cáo khác: ${resolvedTitle}`;
  } else if (reportType === REPORT_TYPE.USER) {
    const targetUserId = pickString(payload.targetUserId || payload.target_user_id);
    if (!isStrictMongoObjectId(targetUserId)) {
      throw createServiceError(
        "Thiếu người dùng bị tố cáo. Hãy báo cáo từ hồ sơ / cuộc trò chuyện tương ứng.",
        400
      );
    }
    reportData.targetUserId = targetUserId;
    reportData.content = note || `Tố cáo người dùng: ${resolvedTitle}`;
  } else {
    reportData.content = note || resolvedTitle;
  }

  const imageUrls = await normalizeImageUrls(payload.images || payload.imageUrls || []);
  const report = await Report.create(reportData);
  const images = await saveReportImages(report._id, imageUrls);

  return {
    id: String(report._id),
    reportType: report.reportType,
    reportTypeLabel: REPORT_TYPE_LABELS[report.reportType] || "Không rõ",
    title: report.title,
    content: report.content,
    status: report.status,
    images,
    createdAt: report.CreatedAt,
  };
}

module.exports = {
  createReport,
  MAX_ACCOUNT_REPORT_IMAGES,
};
