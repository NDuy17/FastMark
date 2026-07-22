const crypto = require("crypto");
const Report = require("../models/Report");
const ReportImage = require("../models/ReportImage");
const Reservation = require("../models/Reservation");
const ShopProfile = require("../models/ShopProfile");
const User = require("../models/User");
const {
  RESERVATION_STATUS,
  REPORT_TYPE,
  REPORT_STATUS,
  REPORT_TYPE_LABELS,
  REPORT_STATUS_LABELS,
  RESERVATION_REPORT_TYPES,
  MAX_RESERVATION_REPORT_IMAGES,
  RESERVATION_DISPUTE_REASON,
  RESERVATION_DISPUTE_REASON_LABEL,
  normalizeBuyerDisputeReason,
  RESERVATION_AUDIT_ACTION,
  NOTIFICATION_AUDIENCE,
  REPORT_REPORTER_ROLE,
  REPORT_REPORTER_ROLE_LABELS,
} = require("../constants");
const { createNotification } = require("./notificationService");
const { uploadImageToSupabase, resolveFileExtension } = require("./uploadService");
const { reverseGeocode } = require("../utils/geocoding");
const {
  toPublicReservation,
  isPastPickupTime,
  isWithinDepositDecisionWindow,
  processReservationLifecycle,
  refundDepositIfHeld,
  releaseDepositIfHeld,
  releaseVariantInventory,
} = require("./reservationService");
const { getShopForSeller } = require("./shopSettingsService");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickString(value) {
  return String(value || "").trim();
}

function parseCoordinate(value, label) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw createServiceError(`${label} không hợp lệ.`);
  }
  return num;
}

async function resolveEvidenceImageUrl(imageInput) {
  if (imageInput && typeof imageInput === "object") {
    const existing = pickString(imageInput.imageUrl || imageInput.ImageUrl || imageInput.url);
    if (existing && /^https?:\/\//i.test(existing)) {
      return existing;
    }
    const base64 = imageInput.imageBase64 || imageInput.ImageBase64 || imageInput.base64;
    if (base64) {
      return resolveEvidenceImageUrl(
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
    throw createServiceError("Định dạng ảnh chứng cứ không hợp lệ.", 400);
  }

  const mimeType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) {
    throw createServiceError("Ảnh chứng cứ trống.", 400);
  }

  const uploaded = await uploadImageToSupabase({
    buffer,
    mimeType,
    folder: "report-images",
    fileName: `report-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${resolveFileExtension(mimeType)}`,
  });
  return uploaded.publicUrl;
}

async function normalizeImageUrls(images = []) {
  const list = Array.isArray(images) ? images : [];
  if (list.length > MAX_RESERVATION_REPORT_IMAGES) {
    throw createServiceError(
      `Mỗi báo cáo tối đa ${MAX_RESERVATION_REPORT_IMAGES} ảnh chứng cứ.`,
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

function toPublicDisputeReport(report, extras = {}) {
  const reportType = Number(report.reportType);
  // Ưu tiên trường reporterRole đã lưu; fallback suy ra từ reportType cho dữ liệu cũ.
  const storedRole = Number(report.reporterRole);
  const isSellerReport =
    storedRole === REPORT_REPORTER_ROLE.SELLER ||
    (!storedRole && reportType === REPORT_TYPE.BUYER_NO_SHOW);
  const reporterRole = isSellerReport
    ? REPORT_REPORTER_ROLE.SELLER
    : REPORT_REPORTER_ROLE.BUYER;
  return {
    id: String(report._id),
    reservationId: report.reservationId ? String(report.reservationId) : "",
    userId: report.userId ? String(report.userId) : "",
    targetUserId: report.targetUserId ? String(report.targetUserId) : "",
    shopId: report.shopId ? String(report.shopId) : "",
    productId: report.productId ? String(report.productId) : "",
    reportType,
    reportTypeLabel: REPORT_TYPE_LABELS[reportType] || "Không rõ",
    reporterRole,
    reporterRoleLabel: REPORT_REPORTER_ROLE_LABELS[reporterRole] || "Không rõ",
    reporterSide: isSellerReport ? "seller" : "buyer",
    title: report.title || "",
    content: report.content || "",
    description: report.content || report.description || "",
    reason: extras.reason || "",
    reasonLabel: extras.reasonLabel || "",
    latitude: report.latitude == null ? null : Number(report.latitude),
    longitude: report.longitude == null ? null : Number(report.longitude),
    address: report.address || "",
    sellerTitle: report.sellerTitle || "",
    sellerContent: report.sellerContent || "",
    sellerLatitude: report.sellerLatitude == null ? null : Number(report.sellerLatitude),
    sellerLongitude: report.sellerLongitude == null ? null : Number(report.sellerLongitude),
    sellerAddress: report.sellerAddress || "",
    status: Number(report.status),
    statusLabel: REPORT_STATUS_LABELS[Number(report.status)] || "Không rõ",
    adminDecision: report.adminDecision || "",
    adminNote: report.adminNote || "",
    processedAt: report.processedAt || null,
    createdAt: report.CreatedAt,
    updatedAt: report.UpdatedAt,
    images: extras.images || [],
    reservation: extras.reservation || null,
  };
}

/** Có Report tranh chấp gắn đơn (bất kỳ trạng thái trừ rejected thuần tuý vẫn chặn auto-release). */
async function hasReservationDisputeReport(reservationId) {
  if (!reservationId) {
    return false;
  }
  const count = await Report.countDocuments({
    reservationId,
    reportType: { $in: RESERVATION_REPORT_TYPES },
  });
  return count > 0;
}

async function assertNoDuplicateReport({ reservationId, userId, reportType }) {
  const existing = await Report.findOne({
    reservationId,
    userId,
    reportType,
    status: { $ne: REPORT_STATUS.REJECTED },
  }).lean();
  if (existing) {
    throw createServiceError(
      "Bạn đã gửi báo cáo loại này cho đơn giữ hàng này rồi.",
      409
    );
  }
}

function assertReservationNotCompleted(reservation) {
  const status = Number(reservation.status);
  if (
    status === RESERVATION_STATUS.COMPLETED ||
    status === RESERVATION_STATUS.AUTO_COMPLETED
  ) {
    throw createServiceError("Không thể báo cáo đơn đã hoàn thành.", 400);
  }
  if (status === RESERVATION_STATUS.REJECTED || status === RESERVATION_STATUS.REFUNDED) {
    throw createServiceError("Không thể báo cáo đơn đã hủy / hoàn cọc.", 400);
  }
}

/**
 * Buyer báo seller không bán / không mở cửa sau PickupTime.
 * POST /reports/buyer-report-seller
 */
async function buyerReportSeller(user, payload = {}) {
  await processReservationLifecycle();

  const reservationId = pickString(payload.reservationId || payload.id);
  if (!reservationId) {
    throw createServiceError("Thiếu reservationId.");
  }

  const reason = normalizeBuyerDisputeReason(payload.reason);
  if (!reason) {
    throw createServiceError(
      "Vui lòng chọn lý do báo cáo (người bán không có mặt / shop đóng cửa / không giao hàng / khác)."
    );
  }

  const content = pickString(payload.description || payload.content || payload.note);
  if (reason === RESERVATION_DISPUTE_REASON.OTHER && !content) {
    throw createServiceError("Vui lòng nhập giải thích khi chọn lý do Khác.");
  }
  const reasonLabel = RESERVATION_DISPUTE_REASON_LABEL[reason] || reason;
  const resolvedContent = content || reasonLabel;

  const latitude = parseCoordinate(payload.latitude ?? payload.lat, "latitude");
  const longitude = parseCoordinate(payload.longitude ?? payload.lng ?? payload.lon, "longitude");
  if (latitude == null || longitude == null) {
    throw createServiceError("Thiếu tọa độ GPS (latitude, longitude).");
  }

  let address = pickString(payload.address);
  if (!address) {
    address = await reverseGeocode(latitude, longitude);
  }

  const imageUrls = await normalizeImageUrls(payload.images || payload.imageUrls || []);

  const reservation = await Reservation.findOne({
    _id: reservationId,
    userId: user._id,
  });
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng.", 404);
  }

  assertReservationNotCompleted(reservation);

  const status = Number(reservation.status);
  if (
    status !== RESERVATION_STATUS.WAITING_PICKUP &&
    status !== RESERVATION_STATUS.DISPUTED
  ) {
    throw createServiceError("Chỉ báo cáo được khi đơn đang chờ nhận hàng hoặc tranh chấp.");
  }
  if (!isPastPickupTime(reservation)) {
    throw createServiceError("Chỉ báo cáo sau giờ nhận hàng đã chọn.", 403);
  }
  if (!isWithinDepositDecisionWindow(reservation) && status !== RESERVATION_STATUS.DISPUTED) {
    throw createServiceError("Đã hết thời gian báo cáo tranh chấp (24 giờ sau giờ nhận).", 403);
  }

  await assertNoDuplicateReport({
    reservationId: reservation._id,
    userId: user._id,
    reportType: REPORT_TYPE.SELLER_NO_SHOW,
  });

  const shop = await ShopProfile.findById(reservation.shopId);
  const now = new Date();
  const title = reasonLabel;

  const report = await Report.create({
    userId: user._id,
    targetUserId: shop?.userId || null,
    shopId: reservation.shopId,
    productId: reservation.productId,
    reservationId: reservation._id,
    reportType: REPORT_TYPE.SELLER_NO_SHOW,
    reporterRole: REPORT_REPORTER_ROLE.BUYER,
    title,
    content: resolvedContent,
    latitude,
    longitude,
    address,
    status: REPORT_STATUS.PENDING,
    CreatedAt: now,
    UpdatedAt: now,
  });

  const images = await saveReportImages(report._id, imageUrls);

  reservation.status = RESERVATION_STATUS.DISPUTED;
  reservation.disputeByBuyer = true;
  reservation.disputeReason = reason;
  reservation.disputeDescription = resolvedContent;
  reservation.disputedAt = reservation.disputedAt || now;
  reservation.UpdatedAt = now;
  await reservation.save();

  if (shop?.userId) {
    await createNotification(shop.userId, {
      title: "Khách đã tố cáo bạn không có mặt",
      content: `${user.FullName || user.UserName || "Người mua"} báo cáo: ${reasonLabel}. Cọc đang giữ chờ admin xử lý.`,
      audience: NOTIFICATION_AUDIENCE.SELLER,
    });
  }

  await createNotification(user._id, {
    title: "Đã gửi báo cáo tranh chấp",
    content: `Báo cáo về shop đã được ghi nhận (${reasonLabel}). Cọc đang giữ chờ admin xử lý.`,
    audience: NOTIFICATION_AUDIENCE.BUYER,
  });

  return {
    report: toPublicDisputeReport(report, {
      images,
      reason,
      reasonLabel,
    }),
    reservation: await toPublicReservation(reservation),
  };
}

/**
 * Seller báo buyer không đến nhận hàng sau PickupTime.
 * POST /reports/seller-report-buyer
 */
async function sellerReportBuyer(user, payload = {}) {
  await processReservationLifecycle();

  const reservationId = pickString(payload.reservationId || payload.id);
  if (!reservationId) {
    throw createServiceError("Thiếu reservationId.");
  }

  const content = pickString(payload.description || payload.content || payload.note);
  if (!content) {
    throw createServiceError("Vui lòng nhập nội dung mô tả.");
  }

  const latitude = parseCoordinate(payload.latitude ?? payload.lat, "latitude");
  const longitude = parseCoordinate(payload.longitude ?? payload.lng ?? payload.lon, "longitude");
  if (latitude == null || longitude == null) {
    throw createServiceError("Thiếu tọa độ GPS (latitude, longitude).");
  }

  let sellerAddress = pickString(payload.address || payload.sellerAddress);
  if (!sellerAddress) {
    sellerAddress = await reverseGeocode(latitude, longitude);
  }

  const imageUrls = await normalizeImageUrls(payload.images || payload.imageUrls || []);

  const shop = await getShopForSeller(user);
  const reservation = await Reservation.findOne({
    _id: reservationId,
    shopId: shop._id,
  });
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng của gian hàng.", 404);
  }

  assertReservationNotCompleted(reservation);

  const status = Number(reservation.status);
  if (
    status !== RESERVATION_STATUS.WAITING_PICKUP &&
    status !== RESERVATION_STATUS.DISPUTED
  ) {
    throw createServiceError("Chỉ báo cáo được khi đơn đang chờ nhận hàng hoặc tranh chấp.");
  }
  if (!isPastPickupTime(reservation)) {
    throw createServiceError("Chỉ báo cáo sau giờ nhận hàng đã chọn.", 403);
  }
  if (!isWithinDepositDecisionWindow(reservation) && status !== RESERVATION_STATUS.DISPUTED) {
    throw createServiceError("Đã hết thời gian báo cáo tranh chấp (24 giờ sau giờ nhận).", 403);
  }

  await assertNoDuplicateReport({
    reservationId: reservation._id,
    userId: user._id,
    reportType: REPORT_TYPE.BUYER_NO_SHOW,
  });

  const now = new Date();
  const title =
    pickString(payload.title) ||
    REPORT_TYPE_LABELS[REPORT_TYPE.BUYER_NO_SHOW] ||
    "Người mua không đến nhận hàng";

  // Seller báo buyer: chỉ ghi vào nhóm trường của seller, không đụng field chung của buyer.
  const report = await Report.create({
    userId: user._id,
    targetUserId: reservation.userId,
    shopId: reservation.shopId,
    productId: reservation.productId,
    reservationId: reservation._id,
    reportType: REPORT_TYPE.BUYER_NO_SHOW,
    reporterRole: REPORT_REPORTER_ROLE.SELLER,
    sellerTitle: title,
    sellerContent: content,
    sellerLatitude: latitude,
    sellerLongitude: longitude,
    sellerAddress,
    status: REPORT_STATUS.PENDING,
    CreatedAt: now,
    UpdatedAt: now,
  });

  const images = await saveReportImages(report._id, imageUrls);

  reservation.status = RESERVATION_STATUS.DISPUTED;
  reservation.disputeBySeller = true;
  // Không ghi đè lý do/mô tả cấp đơn nếu buyer đã báo cáo trước (giữ nguyên phía buyer).
  if (!reservation.disputeByBuyer) {
    reservation.disputeReason = RESERVATION_DISPUTE_REASON.BUYER_NO_SHOW;
    reservation.disputeDescription = content;
  }
  reservation.disputedAt = reservation.disputedAt || now;
  reservation.UpdatedAt = now;
  await reservation.save();

  if (reservation.userId) {
    await createNotification(reservation.userId, {
      title: "Shop báo cáo bạn không đến nhận hàng",
      content: "Người bán đã tố cáo bạn không đến lấy hàng. Cọc đang giữ chờ admin xử lý.",
      audience: NOTIFICATION_AUDIENCE.BUYER,
    });
  }

  return {
    report: toPublicDisputeReport(report, {
      images,
      reason: RESERVATION_DISPUTE_REASON.BUYER_NO_SHOW,
      reasonLabel: RESERVATION_DISPUTE_REASON_LABEL[RESERVATION_DISPUTE_REASON.BUYER_NO_SHOW],
    }),
    reservation: await toPublicReservation(reservation),
  };
}

async function loadReportImagesMap(reportIds = []) {
  if (!reportIds.length) {
    return new Map();
  }
  const rows = await ReportImage.find({ reportId: { $in: reportIds } })
    .sort({ CreatedAt: 1 })
    .lean();
  return rows.reduce((map, row) => {
    const key = String(row.reportId);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push({
      id: String(row._id),
      imageUrl: row.imageUrl,
    });
    return map;
  }, new Map());
}

/**
 * Danh sách báo cáo tranh chấp của 1 đơn — buyer/seller participant hoặc admin.
 */
async function listReservationDisputeReports(user, reservationId, { isAdmin = false } = {}) {
  const id = pickString(reservationId);
  if (!id) {
    throw createServiceError("Thiếu reservationId.");
  }

  const reservation = await Reservation.findById(id);
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng.", 404);
  }

  if (!isAdmin) {
    const isBuyer = String(reservation.userId) === String(user._id);
    let isSeller = false;
    if (!isBuyer && reservation.shopId) {
      const shop = await ShopProfile.findById(reservation.shopId).select("userId").lean();
      isSeller = shop && String(shop.userId) === String(user._id);
    }
    if (!isBuyer && !isSeller) {
      throw createServiceError("Bạn không có quyền xem báo cáo của đơn này.", 403);
    }
  }

  const reports = await Report.find({
    reservationId: reservation._id,
    reportType: { $in: RESERVATION_REPORT_TYPES },
  })
    .sort({ CreatedAt: 1 })
    .lean();

  const imagesByReport = await loadReportImagesMap(reports.map((row) => row._id));

  return {
    reservationId: String(reservation._id),
    reports: reports.map((report) => {
      let reason = "";
      if (Number(report.reportType) === REPORT_TYPE.BUYER_NO_SHOW) {
        reason = RESERVATION_DISPUTE_REASON.BUYER_NO_SHOW;
      } else {
        const title = pickString(report.title);
        const matched = Object.entries(RESERVATION_DISPUTE_REASON_LABEL).find(
          ([, label]) => label === title
        );
        reason = matched ? matched[0] : "";
      }
      return toPublicDisputeReport(report, {
        images: imagesByReport.get(String(report._id)) || [],
        reason,
        reasonLabel: RESERVATION_DISPUTE_REASON_LABEL[reason] || reason || report.title || "",
      });
    }),
  };
}

async function loadReservationReportOrThrow(reportId) {
  const report = await Report.findById(reportId);
  if (!report) {
    throw createServiceError("Không tìm thấy báo cáo.", 404);
  }
  if (!RESERVATION_REPORT_TYPES.includes(Number(report.reportType))) {
    throw createServiceError(
      "API này chỉ dùng cho báo cáo tranh chấp giữ hàng.",
      400
    );
  }
  if (!report.reservationId) {
    throw createServiceError("Báo cáo không gắn đơn giữ hàng.", 400);
  }
  return report;
}

async function closeRelatedPendingReports(reservationId, adminUser, decision, note) {
  const now = new Date();
  await Report.updateMany(
    {
      reservationId,
      reportType: { $in: RESERVATION_REPORT_TYPES },
      status: REPORT_STATUS.PENDING,
    },
    {
      $set: {
        status: REPORT_STATUS.APPROVED,
        processedBy: adminUser._id,
        processedAt: now,
        adminDecision: decision,
        adminNote: pickString(note),
        UpdatedAt: now,
      },
    }
  );
}

/**
 * Admin duyệt về phía buyer → hoàn cọc + đóng dispute.
 * POST /admin/reports/:id/approve-buyer
 */
async function adminApproveBuyer(adminUser, reportId, { note } = {}) {
  const report = await loadReservationReportOrThrow(reportId);
  if (Number(report.status) !== REPORT_STATUS.PENDING) {
    throw createServiceError("Báo cáo đã được xử lý trước đó.", 400);
  }

  const reservation = await Reservation.findById(report.reservationId);
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng liên quan.", 404);
  }

  const status = Number(reservation.status);
  if (
    status === RESERVATION_STATUS.COMPLETED ||
    status === RESERVATION_STATUS.AUTO_COMPLETED ||
    status === RESERVATION_STATUS.REFUNDED ||
    status === RESERVATION_STATUS.REJECTED
  ) {
    throw createServiceError("Đơn giữ hàng đã kết thúc, không thể hoàn cọc lại.", 400);
  }

  await refundDepositIfHeld(reservation);
  await releaseVariantInventory(reservation);

  const now = new Date();
  reservation.status = RESERVATION_STATUS.REFUNDED;
  reservation.cancelledAt = reservation.cancelledAt || now;
  reservation.cancelReason = pickString(note) || "Admin hoàn cọc cho người mua.";
  reservation.UpdatedAt = now;
  await reservation.save();

  report.status = REPORT_STATUS.APPROVED;
  report.processedBy = adminUser._id;
  report.processedAt = now;
  report.adminDecision = "approve_buyer";
  report.adminNote = pickString(note);
  report.UpdatedAt = now;
  await report.save();

  await closeRelatedPendingReports(
    reservation._id,
    adminUser,
    "approve_buyer",
    note
  );

  try {
    const ReservationAuditLog = require("../models/ReservationAuditLog");
    await ReservationAuditLog.create({
      adminId: adminUser._id,
      reservationId: reservation._id,
      action: RESERVATION_AUDIT_ACTION.ADMIN_REFUND_BUYER,
      decision: "buyer_win",
      note: pickString(note),
      CreatedAt: now,
    });
  } catch {
    // audit optional
  }

  if (reservation.userId) {
    await createNotification(reservation.userId, {
      title: "Admin đã xử lý tranh chấp",
      content: "Bạn thắng tranh chấp. Tiền cọc đã được hoàn về ví.",
      audience: NOTIFICATION_AUDIENCE.BUYER,
    });
  }

  const images = await ReportImage.find({ reportId: report._id }).lean();
  return {
    report: toPublicDisputeReport(report, {
      images: images.map((img) => ({ id: String(img._id), imageUrl: img.imageUrl })),
    }),
    reservation: await toPublicReservation(reservation),
  };
}

/**
 * Admin duyệt về phía seller → giải ngân cọc + đóng dispute.
 * POST /admin/reports/:id/approve-seller
 */
async function adminApproveSeller(adminUser, reportId, { note } = {}) {
  const report = await loadReservationReportOrThrow(reportId);
  if (Number(report.status) !== REPORT_STATUS.PENDING) {
    throw createServiceError("Báo cáo đã được xử lý trước đó.", 400);
  }

  const reservation = await Reservation.findById(report.reservationId);
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng liên quan.", 404);
  }

  if (Number(reservation.status) !== RESERVATION_STATUS.DISPUTED) {
    throw createServiceError("Chỉ giải phóng cọc cho đơn đang tranh chấp.", 400);
  }

  const shop = reservation.shopId ? await ShopProfile.findById(reservation.shopId) : null;
  if (!shop) {
    throw createServiceError("Không tìm thấy gian hàng của đơn giữ hàng.", 404);
  }

  const now = new Date();
  // Đền cọc seller nhưng không tính bán thành công: trả hàng kho, đơn = đã hủy.
  await releaseDepositIfHeld(reservation, shop);
  await releaseVariantInventory(reservation);

  reservation.status = RESERVATION_STATUS.DISPUTE_RESOLVED;
  reservation.cancelledAt = now;
  reservation.cancelReason =
    pickString(note) || "Admin xử lý tranh chấp: đền cọc cho người bán.";
  reservation.UpdatedAt = now;
  await reservation.save();

  report.status = REPORT_STATUS.APPROVED;
  report.processedBy = adminUser._id;
  report.processedAt = now;
  report.adminDecision = "approve_seller";
  report.adminNote = pickString(note);
  report.UpdatedAt = now;
  await report.save();

  await closeRelatedPendingReports(
    reservation._id,
    adminUser,
    "approve_seller",
    note
  );

  try {
    const ReservationAuditLog = require("../models/ReservationAuditLog");
    await ReservationAuditLog.create({
      adminId: adminUser._id,
      reservationId: reservation._id,
      action: RESERVATION_AUDIT_ACTION.ADMIN_RELEASE_SELLER,
      decision: "seller_win",
      note: pickString(note),
      CreatedAt: now,
    });
  } catch {
    // audit optional
  }

  if (shop.userId) {
    await createNotification(shop.userId, {
      title: "Admin đã xử lý tranh chấp",
      content:
        "Bạn thắng tranh chấp. Tiền cọc đã vào ví. Đơn được ghi nhận là đã hủy (không tính bán thành công).",
      audience: NOTIFICATION_AUDIENCE.SELLER,
    });
  }

  const images = await ReportImage.find({ reportId: report._id }).lean();
  return {
    report: toPublicDisputeReport(report, {
      images: images.map((img) => ({ id: String(img._id), imageUrl: img.imageUrl })),
    }),
    reservation: await toPublicReservation(reservation),
  };
}

/**
 * Admin bác bỏ báo cáo — ghi log, không tự động giải ngân.
 * POST /admin/reports/:id/reject
 */
async function adminRejectReport(adminUser, reportId, { note } = {}) {
  const report = await loadReservationReportOrThrow(reportId);
  if (Number(report.status) !== REPORT_STATUS.PENDING) {
    throw createServiceError("Báo cáo đã được xử lý trước đó.", 400);
  }

  const now = new Date();
  report.status = REPORT_STATUS.REJECTED;
  report.processedBy = adminUser._id;
  report.processedAt = now;
  report.adminDecision = "reject";
  report.adminNote = pickString(note);
  report.UpdatedAt = now;
  await report.save();

  try {
    const ReservationAuditLog = require("../models/ReservationAuditLog");
    await ReservationAuditLog.create({
      adminId: adminUser._id,
      reservationId: report.reservationId,
      action: "ADMIN_REJECT_REPORT",
      decision: "reject",
      note: pickString(note) || `Reject report ${report._id}`,
      CreatedAt: now,
    });
  } catch {
    // audit optional
  }

  const images = await ReportImage.find({ reportId: report._id }).lean();
  let reservation = null;
  if (report.reservationId) {
    const doc = await Reservation.findById(report.reservationId);
    if (doc) {
      reservation = await toPublicReservation(doc);
    }
  }

  return {
    report: toPublicDisputeReport(report, {
      images: images.map((img) => ({ id: String(img._id), imageUrl: img.imageUrl })),
    }),
    reservation,
  };
}

module.exports = {
  buyerReportSeller,
  sellerReportBuyer,
  listReservationDisputeReports,
  adminApproveBuyer,
  adminApproveSeller,
  adminRejectReport,
  hasReservationDisputeReport,
  toPublicDisputeReport,
  MAX_RESERVATION_REPORT_IMAGES,
};
