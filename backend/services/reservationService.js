const Reservation = require("../models/Reservation");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const User = require("../models/User");
const ShopProfile = require("../models/ShopProfile");
const Report = require("../models/Report");
const {
  RESERVATION_STATUS,
  RESERVATION_STATUS_LABEL,
  RESERVATION_DISPUTE_WINDOW_HOURS,
  RESERVATION_DISPUTE_REASON,
  RESERVATION_DISPUTE_REASON_LABEL,
  NOTIFICATION_AUDIENCE,
  DEPOSIT_SETTLE_TO,
  DEPOSIT_SETTLE_TO_LABEL,
  REPORT_STATUS,
} = require("../constants");
const { createNotification } = require("./notificationService");
const { getShopForSeller } = require("./shopSettingsService");
const {
  refundDepositFromSystem,
  releaseDepositFromSystem,
} = require("./walletService");

const SHOP_CANCEL_REASON = "Shop hủy";
const BUYER_CANCEL_REASON = "Người mua hủy đơn";
const SHOP_REJECT_REASON = "Shop từ chối giữ hàng";
const SHOP_UNCONFIRMED_CANCEL_REASON =
  "Quá giờ lấy hàng — người bán không xác nhận đơn";

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function resolveShopDisplayFields(shop, owner) {
  const fullName = String(owner?.FullName || "").trim();
  const userName = String(owner?.UserName || "").trim();
  const legacyName = String(shop?.shopName || "").trim();
  const description = String(shop?.description || "").trim();
  return {
    storeName: fullName || userName || legacyName || description || "",
    shopUsername: userName || String(shop?.shopUsername || "").trim() || "",
  };
}

/** Hỗ trợ doc cũ (Released/Refunded) lẫn schema mới (Settled). */
function resolveDepositSettleTo(doc) {
  const raw = Number(doc?.depositSettleTo);
  if (raw === DEPOSIT_SETTLE_TO.BUYER || raw === DEPOSIT_SETTLE_TO.SELLER) {
    return raw;
  }
  if (doc?.depositRefundedAt) return DEPOSIT_SETTLE_TO.BUYER;
  if (doc?.depositReleasedAt) return DEPOSIT_SETTLE_TO.SELLER;
  return DEPOSIT_SETTLE_TO.NONE;
}

function resolveDepositSettledAt(doc) {
  if (doc?.depositSettledAt) return doc.depositSettledAt;
  if (doc?.depositRefundedAt) return doc.depositRefundedAt;
  if (doc?.depositReleasedAt) return doc.depositReleasedAt;
  return null;
}

function isDepositSettled(doc) {
  return resolveDepositSettleTo(doc) !== DEPOSIT_SETTLE_TO.NONE;
}

function isDepositHeld(doc) {
  return (
    Boolean(doc?.depositPaidAt) &&
    !isDepositSettled(doc) &&
    Number(doc?.depositAmount) > 0
  );
}

function markDepositSettled(reservation, settleTo, at = new Date()) {
  reservation.depositSettledAt = at;
  reservation.depositSettleTo = settleTo;
}

function computeTotal(reservation) {
  const price = Number(reservation.agreedPrice ?? reservation.reservedPrice) || 0;
  const quantity = Number(reservation.quantity) || 0;
  return price * quantity;
}

function computeReviewDeadline(pickupTime, fromDate = new Date()) {
  const pickup = pickupTime ? new Date(pickupTime) : null;
  const base =
    pickup && Number.isFinite(pickup.getTime()) ? pickup : new Date(fromDate);
  return new Date(base.getTime() + RESERVATION_DISPUTE_WINDOW_HOURS * 60 * 60 * 1000);
}

/** Alias: thời điểm auto-release cọc = pickupTime + 24h. */
function computeAutoReleaseAt(pickupTime, fromDate = new Date()) {
  return computeReviewDeadline(pickupTime, fromDate);
}

function isBeforePickupTime(reservation, now = new Date()) {
  if (!reservation?.pickupTime) {
    return true;
  }
  const pickup = new Date(reservation.pickupTime);
  return !Number.isFinite(pickup.getTime()) || now.getTime() < pickup.getTime();
}

function isPastPickupTime(reservation, now = new Date()) {
  if (!reservation?.pickupTime) {
    return false;
  }
  const pickup = new Date(reservation.pickupTime);
  return Number.isFinite(pickup.getTime()) && now.getTime() >= pickup.getTime();
}

/** Hạn quyết định cọc sau quá giờ nhận = autoReleaseAt | reviewDeadlineAt | pickupTime+24h. */
function getDepositDecisionDeadline(reservation) {
  if (reservation?.autoReleaseAt) {
    const d = new Date(reservation.autoReleaseAt);
    if (Number.isFinite(d.getTime())) return d;
  }
  if (reservation?.reviewDeadlineAt) {
    const d = new Date(reservation.reviewDeadlineAt);
    if (Number.isFinite(d.getTime())) return d;
  }
  if (reservation?.pickupTime) {
    return computeReviewDeadline(reservation.pickupTime);
  }
  return null;
}

function isWithinDepositDecisionWindow(reservation, now = new Date()) {
  const deadline = getDepositDecisionDeadline(reservation);
  if (!deadline) {
    return false;
  }
  return now.getTime() < deadline.getTime();
}

function buildActionFlags(doc, now = new Date()) {
  const status = Number(doc.status);
  const beforePickup = isBeforePickupTime(doc, now);
  const pastPickup = isPastPickupTime(doc, now);
  const withinDecisionWindow = isWithinDepositDecisionWindow(doc, now);
  const depositHeld = isDepositHeld(doc);
  const waitingOrDisputed =
    status === RESERVATION_STATUS.WAITING_PICKUP || status === RESERVATION_STATUS.DISPUTED;

  // Quá giờ nhận + còn trong 24h (hoặc đang tranh chấp): khiếu nại / đồng ý mất cọc.
  const canPostPickupDepositActions =
    waitingOrDisputed && pastPickup && (withinDecisionWindow || status === RESERVATION_STATUS.DISPUTED);

  return {
    canCancel:
      status === RESERVATION_STATUS.PENDING_SELLER_CONFIRMATION && beforePickup,
    // Buyer quét QR cố định của shop (trước pickupTime).
    canScanShopQr: status === RESERVATION_STATUS.WAITING_PICKUP && beforePickup,
    canConfirmReceived: status === RESERVATION_STATUS.WAITING_PICKUP && beforePickup,
    // Khiếu nại shop (trong 24h sau quá giờ nhận) — vẫn cho nếu chưa báo cáo.
    canReportShop: canPostPickupDepositActions && !doc.disputeByBuyer,
    canComplaint: canPostPickupDepositActions && !doc.disputeByBuyer,
    // Đồng ý mất cọc → giải ngân cho seller (trong 24h, còn giữ cọc).
    canForfeitDeposit:
      canPostPickupDepositActions &&
      (depositHeld || !doc.depositPaidAt) &&
      !isDepositSettled(doc),
    // Seller báo buyer no-show sau pickupTime — vẫn cho nếu chưa báo cáo.
    canReportBuyer: canPostPickupDepositActions && !doc.disputeBySeller,
    canDispute: waitingOrDisputed && pastPickup,
    depositDecisionDeadline: getDepositDecisionDeadline(doc),
    withinDepositDecisionWindow: Boolean(
      waitingOrDisputed && pastPickup && withinDecisionWindow
    ),
  };
}

async function refundDepositIfHeld(reservation) {
  if (!reservation?.depositPaidAt || !(Number(reservation.depositAmount) > 0)) {
    return null;
  }
  if (isDepositSettled(reservation)) {
    return null;
  }
  if (!reservation.userId) {
    return null;
  }

  const result = await refundDepositFromSystem(
    reservation.userId,
    reservation.depositAmount,
    {
      description: `Hoàn cọc giữ hàng #${String(reservation._id).slice(-8).toUpperCase()}`,
      reservationId: reservation._id,
    }
  );
  markDepositSettled(reservation, DEPOSIT_SETTLE_TO.BUYER);
  return result;
}

async function releaseDepositIfHeld(reservation, shop) {
  if (!reservation?.depositPaidAt || !(Number(reservation.depositAmount) > 0)) {
    return null;
  }
  if (isDepositSettled(reservation)) {
    return null;
  }
  if (!shop?.userId) {
    throw createServiceError("Không tìm thấy chủ shop để nhận cọc.", 400);
  }

  const result = await releaseDepositFromSystem(shop.userId, reservation.depositAmount, {
    description: `Giải phóng cọc giữ hàng #${String(reservation._id).slice(-8).toUpperCase()}`,
    reservationId: reservation._id,
  });
  markDepositSettled(reservation, DEPOSIT_SETTLE_TO.SELLER);
  return result;
}

async function closePendingReservationReports(reservationId, decision, note, now = new Date()) {
  await Report.updateMany(
    {
      reservationId,
      status: REPORT_STATUS.PENDING,
    },
    {
      $set: {
        status: REPORT_STATUS.APPROVED,
        processedAt: now,
        adminDecision: decision,
        adminNote: note,
        UpdatedAt: now,
      },
    }
  );
}

async function toPublicReservation(doc) {
  const [buyer, product, variant, shop] = await Promise.all([
    User.findById(doc.userId),
    Product.findById(doc.productId),
    ProductVariant.findById(doc.variantId),
    doc.shopId ? ShopProfile.findById(doc.shopId) : null,
  ]);
  const shopOwner = shop?.userId
    ? await User.findById(shop.userId).select("FullName UserName")
    : null;
  const { storeName, shopUsername } = resolveShopDisplayFields(shop, shopOwner);

  const { loadProductImages, toPublicProductImages } = require("./productService");
  const imageDocs = product?._id ? await loadProductImages(product._id) : [];
  const thumbnails = toPublicProductImages(imageDocs).map((image) => image.imageUrl);
  const legacyThumbs = Array.isArray(product?.Thumbnail)
    ? product.Thumbnail.filter(Boolean)
    : product?.Thumbnail
      ? [product.Thumbnail]
      : [];
  const productThumbnails = thumbnails.length > 0 ? thumbnails : legacyThumbs;

  const now = new Date();
  const actions = buildActionFlags(doc, now);

  return {
    id: doc._id,
    orderCode: `ID: ${String(doc._id).slice(-8).toUpperCase()}`,
    status: doc.status,
    statusLabel: RESERVATION_STATUS_LABEL[doc.status] || "Không rõ",
    quantity: doc.quantity || 0,
    reservedPrice: doc.reservedPrice || 0,
    agreedPrice: doc.agreedPrice ?? doc.reservedPrice ?? 0,
    totalAmount: computeTotal(doc),
    pickupTime: doc.pickupTime || null,
    note: doc.note || "",
    sellerConfirmedAt: doc.sellerConfirmedAt || null,
    reviewDeadlineAt: doc.reviewDeadlineAt || doc.autoReleaseAt || null,
    autoReleaseAt: doc.autoReleaseAt || doc.reviewDeadlineAt || null,
    confirmedAt: doc.sellerConfirmedAt || null,
    completedAt: doc.completedAt || null,
    cancelledAt: doc.cancelledAt || null,
    cancelReason: doc.cancelReason || "",
    depositPercent: Number(doc.depositPercent) || 0,
    depositAmount: Number(doc.depositAmount) || 0,
    // Suy ra từ %/số tiền (không lưu field riêng).
    depositRequired:
      (Number(doc.depositPercent) || 0) > 0 || (Number(doc.depositAmount) || 0) > 0,
    depositPaidAt: doc.depositPaidAt || null,
    depositSettledAt: resolveDepositSettledAt(doc),
    depositSettleTo: resolveDepositSettleTo(doc),
    depositSettleToLabel:
      DEPOSIT_SETTLE_TO_LABEL[resolveDepositSettleTo(doc)] || "Không rõ",
    // Alias tương thích UI cũ.
    depositReleasedAt:
      resolveDepositSettleTo(doc) === DEPOSIT_SETTLE_TO.SELLER
        ? resolveDepositSettledAt(doc)
        : null,
    depositRefundedAt:
      resolveDepositSettleTo(doc) === DEPOSIT_SETTLE_TO.BUYER
        ? resolveDepositSettledAt(doc)
        : null,
    disputeByBuyer: Boolean(doc.disputeByBuyer),
    disputeBySeller: Boolean(doc.disputeBySeller),
    disputeReason: doc.disputeReason || "",
    disputeReasonLabel:
      RESERVATION_DISPUTE_REASON_LABEL[doc.disputeReason] || doc.disputeReason || "",
    disputeDescription: doc.disputeDescription || "",
    disputedAt: doc.disputedAt || null,
    depositDecisionDeadline: actions.depositDecisionDeadline || null,
    withinDepositDecisionWindow: Boolean(actions.withinDepositDecisionWindow),
    createdAt: doc.CreatedAt,
    updatedAt: doc.UpdatedAt,
    shopId: doc.shopId ? String(doc.shopId) : "",
    storeName,
    shopUsername,
    shop: shop
      ? {
          id: String(shop._id),
          shopName: storeName,
          shopUsername,
        }
      : null,
    ...actions,
    isPastPickup: isPastPickupTime(doc, now),
    buyer: buyer
      ? {
          id: buyer._id,
          fullName: buyer.FullName || "",
          phone: buyer.Phone || "",
          userName: buyer.UserName || "",
          avatar: buyer.Avatar || "",
          email: buyer.Email || "",
        }
      : null,
    product: product
      ? {
          id: product._id,
          productName: product.ProductName || "",
          thumbnail: productThumbnails[0] || "",
          thumbnails: productThumbnails,
        }
      : null,
    variant: variant
      ? {
          id: variant._id,
          variantName: variant.VariantName || "",
          price: variant.Price || 0,
          imageUrl: variant.ImageUrl || variant.Images?.[0]?.ImageUrl || "",
        }
      : null,
  };
}

async function getOwnedReservation(user, reservationId) {
  const shop = await getShopForSeller(user);
  const reservation = await Reservation.findOne({ _id: reservationId, shopId: shop._id });
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng.", 404);
  }
  return { shop, reservation };
}

async function reserveVariantInventory(variantId, quantity, session = null) {
  const normalizedQuantity = Number(quantity) || 1;
  const now = new Date();
  const query = ProductVariant.findOneAndUpdate(
    { _id: variantId, Quantity: { $gte: normalizedQuantity } },
    { $inc: { Quantity: -normalizedQuantity }, $set: { UpdatedAt: now } },
    { new: true }
  );

  const updatedVariant = session ? await query.session(session) : await query;
  if (!updatedVariant) {
    throw createServiceError("Số lượng vượt quá tồn kho.", 400);
  }

  return updatedVariant;
}

async function releaseVariantInventory(reservation, session = null) {
  if (!reservation?.inventoryHeld || !reservation.variantId) {
    return;
  }

  const quantity = Number(reservation.quantity) || 1;
  const now = new Date();
  const query = ProductVariant.findByIdAndUpdate(
    reservation.variantId,
    { $inc: { Quantity: quantity }, $set: { UpdatedAt: now } }
  );

  if (session) {
    await query.session(session);
  } else {
    await query;
  }

  reservation.inventoryHeld = false;
}

async function markReservationSold(reservation, session = null) {
  const soldQuantity = Number(reservation.quantity) || 1;
  const now = new Date();

  if (reservation.productId) {
    const productQuery = Product.findByIdAndUpdate(
      reservation.productId,
      { $inc: { SoldCount: soldQuantity }, $set: { UpdatedAt: now } }
    );
    if (session) {
      await productQuery.session(session);
    } else {
      await productQuery;
    }
  }

  if (reservation.variantId) {
    const variantQuery = ProductVariant.findByIdAndUpdate(
      reservation.variantId,
      { $inc: { SoldCount: soldQuantity }, $set: { UpdatedAt: now } }
    );
    if (session) {
      await variantQuery.session(session);
    } else {
      await variantQuery;
    }
  }

  reservation.inventoryHeld = false;
}

async function listSellerReservations(user, { tab = "holding" } = {}) {
  await processReservationLifecycle();
  const shop = await getShopForSeller(user);
  let statusFilter = [];

  switch (tab) {
    case "holding":
      statusFilter = [
        RESERVATION_STATUS.PENDING_SELLER_CONFIRMATION,
        RESERVATION_STATUS.WAITING_PICKUP,
        RESERVATION_STATUS.DISPUTED,
      ];
      break;
    case "cancelled":
      statusFilter = [
        RESERVATION_STATUS.REJECTED,
        RESERVATION_STATUS.REFUNDED,
        RESERVATION_STATUS.DISPUTE_RESOLVED,
      ];
      break;
    case "completed":
      statusFilter = [RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.AUTO_COMPLETED];
      break;
    default:
      statusFilter = [
        RESERVATION_STATUS.PENDING_SELLER_CONFIRMATION,
        RESERVATION_STATUS.WAITING_PICKUP,
      ];
  }

  const reservations = await Reservation.find({
    shopId: shop._id,
    status: { $in: statusFilter },
  })
    .sort({ UpdatedAt: -1 })
    .limit(100);

  return Promise.all(reservations.map((doc) => toPublicReservation(doc)));
}

async function getSellerReservationDetail(user, reservationId) {
  await processReservationLifecycle();
  const { reservation } = await getOwnedReservation(user, reservationId);
  return toPublicReservation(reservation);
}

/** Seller đồng ý giữ hàng → WaitingPickup. */
async function confirmReservation(user, reservationId) {
  const { reservation } = await getOwnedReservation(user, reservationId);

  if (reservation.status !== RESERVATION_STATUS.PENDING_SELLER_CONFIRMATION) {
    throw createServiceError("Chỉ có thể đồng ý đơn đang chờ xác nhận.");
  }

  const now = new Date();
  reservation.status = RESERVATION_STATUS.WAITING_PICKUP;
  reservation.sellerConfirmedAt = now;
  reservation.agreedPrice = reservation.agreedPrice ?? reservation.reservedPrice;
  const releaseAt = computeAutoReleaseAt(reservation.pickupTime, now);
  reservation.reviewDeadlineAt = releaseAt;
  reservation.autoReleaseAt = releaseAt;
  reservation.UpdatedAt = now;
  await reservation.save();

  if (reservation.userId) {
    await createNotification(reservation.userId, {
      title: "Shop đã đồng ý giữ hàng",
      content: "Đơn giữ hàng đã được xác nhận. Hãy đến nhận trước giờ lấy và bấm Đã nhận hàng.",
      audience: NOTIFICATION_AUDIENCE.BUYER,
    });
  }

  return toPublicReservation(reservation);
}

/** Seller từ chối → Rejected + hoàn cọc. */
async function rejectReservation(user, reservationId, { reason } = {}) {
  const { reservation } = await getOwnedReservation(user, reservationId);

  if (reservation.status === RESERVATION_STATUS.WAITING_PICKUP) {
    throw createServiceError(
      "Đơn đã được đồng ý giữ hàng. Shop không thể từ chối nữa.",
      403
    );
  }
  if (
    [
      RESERVATION_STATUS.COMPLETED,
      RESERVATION_STATUS.AUTO_COMPLETED,
      RESERVATION_STATUS.DISPUTED,
      RESERVATION_STATUS.REFUNDED,
      RESERVATION_STATUS.REJECTED,
    ].includes(reservation.status)
  ) {
    throw createServiceError("Không thể từ chối đơn này.");
  }
  if (reservation.status !== RESERVATION_STATUS.PENDING_SELLER_CONFIRMATION) {
    throw createServiceError("Chỉ có thể từ chối đơn đang chờ xác nhận.");
  }

  const now = new Date();
  reservation.status = RESERVATION_STATUS.REJECTED;
  reservation.cancelledAt = now;
  reservation.cancelReason = String(reason || "").trim() || SHOP_REJECT_REASON;
  await releaseVariantInventory(reservation);
  await refundDepositIfHeld(reservation);
  reservation.UpdatedAt = now;
  await reservation.save();

  if (reservation.userId) {
    await createNotification(reservation.userId, {
      title: "Shop từ chối giữ hàng",
      content: "Yêu cầu giữ hàng bị từ chối. Tiền cọc đã hoàn về ví của bạn.",
      audience: NOTIFICATION_AUDIENCE.BUYER,
    });
  }

  return toPublicReservation(reservation);
}

async function cancelReservationBySeller(user, reservationId, { reason } = {}) {
  return rejectReservation(user, reservationId, {
    reason: String(reason || "").trim() || SHOP_CANCEL_REASON,
  });
}

/** Seller không được hoàn tất / xác nhận nhận hàng. */
async function completeReservation() {
  throw createServiceError(
    "Shop không thể hoàn tất đơn. Buyer bấm Đã nhận hàng hoặc hệ thống tự hoàn tất sau hạn báo cáo.",
    403
  );
}

async function finalizeCompleted(reservation, shop, { status, now = new Date() } = {}) {
  reservation.status = status;
  reservation.completedAt = now;
  reservation.UpdatedAt = now;
  await releaseDepositIfHeld(reservation, shop);

  const soldQuantity = Number(reservation.quantity) || 1;
  shop.soldCount = (shop.soldCount || 0) + soldQuantity;
  shop.UpdatedAt = now;
  await shop.save();
  await markReservationSold(reservation);
  await reservation.save();
  return toPublicReservation(reservation);
}

/**
 * Job: (1) Pending quá pickupTime → Rejected + hoàn cọc
 *      (2) Hết hạn phản hồi (= pickupTime + 24h):
 *          - Chỉ buyer báo cáo → hoàn cọc cho buyer
 *          - Buyer không báo cáo → release cọc cho seller
 *          - Cả hai báo cáo → giữ cọc chờ admin
 */
async function processReservationLifecycle() {
  const now = new Date();
  let cancelledCount = 0;
  let autoCompletedCount = 0;
  let buyerRefundedCount = 0;
  let sellerReleasedCount = 0;

  // Sửa data cũ: đơn tranh chấp bị gắn nhầm COMPLETED/AUTO_COMPLETED.
  const mislabeledDisputes = await Reservation.find({
    status: {
      $in: [RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.AUTO_COMPLETED],
    },
    $or: [{ disputeByBuyer: true }, { disputeBySeller: true }],
  }).limit(200);

  for (const reservation of mislabeledDisputes) {
    try {
      const settleTo = resolveDepositSettleTo(reservation);
      reservation.status =
        settleTo === DEPOSIT_SETTLE_TO.BUYER
          ? RESERVATION_STATUS.REFUNDED
          : RESERVATION_STATUS.DISPUTE_RESOLVED;
      reservation.cancelledAt =
        reservation.cancelledAt || reservation.completedAt || now;
      reservation.completedAt = null;
      if (!reservation.cancelReason) {
        reservation.cancelReason =
          settleTo === DEPOSIT_SETTLE_TO.BUYER
            ? "Đã xử lý tranh chấp: hoàn cọc người mua."
            : "Đã xử lý tranh chấp: đền cọc người bán.";
      }
      reservation.UpdatedAt = now;
      await reservation.save();
    } catch (error) {
      console.error(
        "processReservationLifecycle repair disputed status failed:",
        reservation._id,
        error.message
      );
    }
  }

  const overduePending = await Reservation.find({
    status: RESERVATION_STATUS.PENDING_SELLER_CONFIRMATION,
    pickupTime: { $ne: null, $lte: now },
  }).limit(200);

  for (const reservation of overduePending) {
    try {
      const product = await Product.findById(reservation.productId);
      const shop = await ShopProfile.findById(reservation.shopId);
      const productName = product?.ProductName || "sản phẩm";

      reservation.status = RESERVATION_STATUS.REJECTED;
      reservation.cancelledAt = now;
      reservation.cancelReason = SHOP_UNCONFIRMED_CANCEL_REASON;
      await releaseVariantInventory(reservation);
      await refundDepositIfHeld(reservation);
      reservation.UpdatedAt = now;
      await reservation.save();
      cancelledCount += 1;

      if (reservation.userId) {
        await createNotification(reservation.userId, {
          title: "Đơn giữ hàng đã hủy",
          content: `Đơn giữ ${productName} bị hủy vì shop chưa xác nhận trước giờ lấy. Cọc đã hoàn về ví.`,
          audience: NOTIFICATION_AUDIENCE.BUYER,
        });
      }
      if (shop?.userId) {
        await createNotification(shop.userId, {
          title: "Đơn giữ hàng hết hạn",
          content: `Đơn giữ ${productName} tự hủy vì chưa xác nhận trước giờ lấy.`,
          audience: NOTIFICATION_AUDIENCE.SELLER,
        });
      }
    } catch (error) {
      console.error("processReservationLifecycle pending failed:", reservation._id, error.message);
    }
  }

  // Xử lý cọc khi hết 24 giờ phản hồi, gồm cả đơn đã có báo cáo một phía.
  const dueDepositDecision = await Reservation.find({
    status: {
      $in: [RESERVATION_STATUS.WAITING_PICKUP, RESERVATION_STATUS.DISPUTED],
    },
    $or: [
      { autoReleaseAt: { $ne: null, $lte: now } },
      { reviewDeadlineAt: { $ne: null, $lte: now } },
    ],
  }).limit(200);

  for (const reservation of dueDepositDecision) {
    try {
      // Hai bên cùng báo cáo: giữ nguyên cọc để admin xem chứng cứ và xử lý.
      if (reservation.disputeByBuyer && reservation.disputeBySeller) {
        continue;
      }

      // Buyer đã báo cáo nhưng seller không phản hồi trong 24 giờ: buyer thắng tự động.
      if (reservation.disputeByBuyer && !reservation.disputeBySeller) {
        if (
          isDepositSettled(reservation) &&
          resolveDepositSettleTo(reservation) !== DEPOSIT_SETTLE_TO.BUYER
        ) {
          continue;
        }
        await refundDepositIfHeld(reservation);
        await releaseVariantInventory(reservation);
        reservation.status = RESERVATION_STATUS.REFUNDED;
        reservation.cancelledAt = now;
        reservation.cancelReason =
          "Người bán không phản hồi báo cáo trong 24 giờ; cọc tự động hoàn người mua.";
        reservation.UpdatedAt = now;
        await reservation.save();
        await closePendingReservationReports(
          reservation._id,
          "auto_buyer_win",
          "Người bán không phản hồi trong thời hạn 24 giờ.",
          now
        );
        buyerRefundedCount += 1;

        if (reservation.userId) {
          await createNotification(reservation.userId, {
            title: "Đã hoàn cọc giữ hàng",
            content:
              "Shop không phản hồi báo cáo trong 24 giờ. Cọc đã được hoàn về ví của bạn.",
            audience: NOTIFICATION_AUDIENCE.BUYER,
          });
        }
        const reportedShop = await ShopProfile.findById(reservation.shopId);
        if (reportedShop?.userId) {
          await createNotification(reportedShop.userId, {
            title: "Đơn báo cáo đã tự động xử lý",
            content:
              "Bạn không phản hồi báo cáo của người mua trong 24 giờ. Cọc đã hoàn cho người mua.",
            audience: NOTIFICATION_AUDIENCE.SELLER,
          });
        }
        continue;
      }

      // Seller đã báo buyer không đến và buyer không phản hồi: seller nhận cọc, hàng về kho.
      if (reservation.disputeBySeller && !reservation.disputeByBuyer) {
        const shop = await ShopProfile.findById(reservation.shopId);
        if (!shop) {
          continue;
        }
        await releaseDepositIfHeld(reservation, shop);
        await releaseVariantInventory(reservation);
        reservation.status = RESERVATION_STATUS.DISPUTE_RESOLVED;
        reservation.cancelledAt = now;
        reservation.cancelReason =
          "Người mua không phản hồi báo cáo trong 24 giờ; cọc tự động chuyển người bán.";
        reservation.UpdatedAt = now;
        await reservation.save();
        await closePendingReservationReports(
          reservation._id,
          "auto_seller_win",
          "Người mua không phản hồi trong thời hạn 24 giờ.",
          now
        );
        sellerReleasedCount += 1;

        if (reservation.userId) {
          await createNotification(reservation.userId, {
            title: "Đã xử lý báo cáo giữ hàng",
            content:
              "Bạn không phản hồi báo cáo trong 24 giờ. Cọc đã được chuyển cho người bán.",
            audience: NOTIFICATION_AUDIENCE.BUYER,
          });
        }
        if (shop.userId) {
          await createNotification(shop.userId, {
            title: "Đã nhận cọc giữ hàng",
            content:
              "Người mua không phản hồi báo cáo trong 24 giờ. Cọc đã được chuyển vào ví của bạn.",
            audience: NOTIFICATION_AUDIENCE.SELLER,
          });
        }
        continue;
      }

      // Đã settle cọc rồi → đồng bộ trạng thái (idempotent).
      // Có tranh chấp thì không được gắn "Hoàn thành".
      if (isDepositSettled(reservation)) {
        if (
          Number(reservation.status) === RESERVATION_STATUS.COMPLETED ||
          Number(reservation.status) === RESERVATION_STATUS.AUTO_COMPLETED
        ) {
          if (reservation.disputeByBuyer || reservation.disputeBySeller) {
            const settleTo = resolveDepositSettleTo(reservation);
            reservation.status =
              settleTo === DEPOSIT_SETTLE_TO.BUYER
                ? RESERVATION_STATUS.REFUNDED
                : RESERVATION_STATUS.DISPUTE_RESOLVED;
            reservation.cancelledAt = reservation.cancelledAt || reservation.completedAt || now;
            reservation.completedAt = null;
            if (!reservation.cancelReason) {
              reservation.cancelReason =
                settleTo === DEPOSIT_SETTLE_TO.BUYER
                  ? "Đã xử lý tranh chấp: hoàn cọc người mua."
                  : "Đã xử lý tranh chấp: đền cọc người bán.";
            }
            reservation.UpdatedAt = now;
            await reservation.save();
          } else if (!reservation.completedAt) {
            reservation.completedAt = now;
            reservation.UpdatedAt = now;
            await reservation.save();
          }
        } else if (
          Number(reservation.status) === RESERVATION_STATUS.WAITING_PICKUP ||
          Number(reservation.status) === RESERVATION_STATUS.DISPUTED
        ) {
          if (reservation.disputeByBuyer || reservation.disputeBySeller) {
            const settleTo = resolveDepositSettleTo(reservation);
            reservation.status =
              settleTo === DEPOSIT_SETTLE_TO.BUYER
                ? RESERVATION_STATUS.REFUNDED
                : RESERVATION_STATUS.DISPUTE_RESOLVED;
            reservation.cancelledAt = reservation.cancelledAt || now;
            if (!reservation.cancelReason) {
              reservation.cancelReason =
                settleTo === DEPOSIT_SETTLE_TO.BUYER
                  ? "Đã xử lý tranh chấp: hoàn cọc người mua."
                  : "Đã xử lý tranh chấp: đền cọc người bán.";
            }
          } else {
            reservation.status = RESERVATION_STATUS.AUTO_COMPLETED;
            reservation.completedAt = now;
          }
          reservation.UpdatedAt = now;
          await reservation.save();
        }
        continue;
      }

      // Không bên nào báo cáo trong 24 giờ: tự hoàn thành và seller nhận cọc.
      const shop = await ShopProfile.findById(reservation.shopId);
      if (!shop) {
        continue;
      }
      await finalizeCompleted(reservation, shop, {
        status: RESERVATION_STATUS.AUTO_COMPLETED,
        now,
      });
      autoCompletedCount += 1;

      if (reservation.userId) {
        await createNotification(reservation.userId, {
          title: "Đơn giữ hàng tự hoàn thành",
          content:
            "Quá 24 giờ sau giờ nhận hàng, bạn không gửi báo cáo — hệ thống đã giải phóng cọc cho shop.",
          audience: NOTIFICATION_AUDIENCE.BUYER,
        });
      }
      if (shop.userId) {
        await createNotification(shop.userId, {
          title: "Nhận cọc giữ hàng (Auto Release)",
          content: "Đơn giữ hàng tự hoàn thành. Cọc đã vào ví của bạn.",
          audience: NOTIFICATION_AUDIENCE.SELLER,
        });
      }
    } catch (error) {
      console.error(
        "processReservationLifecycle deposit-decision failed:",
        reservation._id,
        error.message
      );
    }
  }

  return {
    cancelledCount,
    autoCompletedCount,
    buyerRefundedCount,
    sellerReleasedCount,
    checkedAt: now,
  };
}

/** Alias cho job cũ. */
async function expireOverdueReservations() {
  return processReservationLifecycle();
}

module.exports = {
  listSellerReservations,
  getSellerReservationDetail,
  confirmReservation,
  rejectReservation,
  cancelReservationBySeller,
  completeReservation,
  toPublicReservation,
  computeTotal,
  computeReviewDeadline,
  computeAutoReleaseAt,
  buildActionFlags,
  getDepositDecisionDeadline,
  isWithinDepositDecisionWindow,
  isBeforePickupTime,
  isPastPickupTime,
  reserveVariantInventory,
  releaseVariantInventory,
  markReservationSold,
  refundDepositIfHeld,
  releaseDepositIfHeld,
  isDepositSettled,
  isDepositHeld,
  resolveDepositSettleTo,
  resolveDepositSettledAt,
  finalizeCompleted,
  processReservationLifecycle,
  expireOverdueReservations,
  SHOP_CANCEL_REASON,
  BUYER_CANCEL_REASON,
  SHOP_REJECT_REASON,
  SHOP_UNCONFIRMED_CANCEL_REASON,
  RESERVATION_DISPUTE_REASON,
  RESERVATION_DISPUTE_REASON_LABEL,
};
