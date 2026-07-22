const mongoose = require("mongoose");
const Reservation = require("../models/Reservation");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const ShopProfile = require("../models/ShopProfile");
const User = require("../models/User");
const {
  RESERVATION_STATUS,
  PRODUCT_STATUS,
  SHOP_STATUS,
  SHOP_OPEN,
  NOTIFICATION_AUDIENCE,
} = require("../constants");
const {
  toPublicReservation,
  reserveVariantInventory,
  releaseVariantInventory,
  processReservationLifecycle,
  refundDepositIfHeld,
  finalizeCompleted,
  isBeforePickupTime,
  isPastPickupTime,
  isWithinDepositDecisionWindow,
  BUYER_CANCEL_REASON,
} = require("./reservationService");
const { holdDepositToSystem } = require("./walletService");
const { createNotification } = require("./notificationService");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function assertPhoneVerifiedForTrade(user) {
  const phone = String(user?.Phone || "").trim();
  if (!/^\d{10}$/.test(phone)) {
    throw createServiceError(
      "Vui lòng thêm và xác minh số điện thoại trước khi giữ hàng.",
      403
    );
  }
  if (!User.isPhoneVerified(user)) {
    throw createServiceError(
      "Vui lòng xác minh số điện thoại trước khi giữ hàng.",
      403
    );
  }
}

function pickNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function pickString(value) {
  return String(value || "").trim();
}

async function validateProductAndShop(productId, variantId) {
  const product = await Product.findById(productId);
  if (!product || product.Status !== PRODUCT_STATUS.ACTIVE) {
    throw createServiceError("Sản phẩm không khả dụng.", 404);
  }

  const variant = await ProductVariant.findById(variantId);
  if (!variant || variant.ProductId?.toString() !== product._id.toString()) {
    throw createServiceError("Biến thể sản phẩm không hợp lệ.", 400);
  }
  if (variant.Status !== undefined && variant.Status !== 1) {
    throw createServiceError("Biến thể sản phẩm không khả dụng.", 400);
  }

  const shop = await ShopProfile.findById(product.ShopId);
  if (!shop) {
    throw createServiceError("Không tìm thấy cửa hàng.", 404);
  }
  if (shop.status !== SHOP_STATUS.ACTIVE) {
    throw createServiceError("Cửa hàng không hoạt động.", 400);
  }
  const { isSubscriptionActive } = require("../constants");
  if (!isSubscriptionActive(shop)) {
    throw createServiceError("Cửa hàng chưa có gói bán hàng còn hiệu lực.", 400);
  }
  if (shop.isOpen !== SHOP_OPEN.OPEN) {
    throw createServiceError("Cửa hàng đang đóng cửa.", 400);
  }

  return { product, variant, shop };
}

async function notifyShopOwner(shop, { title, content }) {
  if (!shop?.userId) {
    return;
  }
  await createNotification(shop.userId, {
    title,
    content,
    audience: NOTIFICATION_AUDIENCE.SELLER,
  });
}

async function createReservation(user, payload) {
  assertPhoneVerifiedForTrade(user);

  const productId = pickString(payload.productId);
  const variantId = pickString(payload.variantId);
  const quantity = pickNumber(payload.quantity) || 1;
  const note = pickString(payload.note);
  const pickupTimeRaw = payload.pickupTime ?? payload.pickup_time;

  if (!productId || !variantId) {
    throw createServiceError("Thiếu sản phẩm hoặc biến thể.");
  }
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
    throw createServiceError("Số lượng không hợp lệ.");
  }

  let pickupTime = null;
  if (pickupTimeRaw) {
    pickupTime = new Date(pickupTimeRaw);
    if (Number.isNaN(pickupTime.getTime())) {
      throw createServiceError("Thời gian nhận hàng không hợp lệ.");
    }
    if (pickupTime.getTime() <= Date.now()) {
      throw createServiceError("Thời gian nhận hàng phải ở tương lai.");
    }
  } else {
    throw createServiceError("Vui lòng chọn thời gian nhận hàng.");
  }

  const { product, variant, shop } = await validateProductAndShop(productId, variantId);

  if ((variant.Quantity ?? 0) < quantity) {
    throw createServiceError("Số lượng vượt quá tồn kho.", 400);
  }

  const { getPromotionalUnitPrice } = require("./productPromotionService");
  const agreedPrice = getPromotionalUnitPrice(product, variant.Price);
  const depositPercent = Math.max(0, Math.min(100, Number(shop.cocTien ?? shop.depositPercent) || 0));
  const depositAmount =
    depositPercent > 0 ? Math.round((agreedPrice * quantity * depositPercent) / 100) : 0;
  const now = new Date();
  const session = await mongoose.startSession();

  try {
    let reservation;
    await session.withTransaction(async () => {
      await reserveVariantInventory(variant._id, quantity, session);

      reservation = await Reservation.create(
        [
          {
            variantId: variant._id,
            shopId: shop._id,
            productId: product._id,
            userId: user._id,
            quantity,
            reservedPrice: agreedPrice,
            agreedPrice,
            pickupTime,
            note,
            status: RESERVATION_STATUS.PENDING_SELLER_CONFIRMATION,
            inventoryHeld: true,
            depositPercent,
            depositAmount,
            depositPaidAt: null,
            depositSettledAt: null,
            depositSettleTo: 0,
            CreatedAt: now,
            UpdatedAt: now,
          },
        ],
        { session }
      );
      reservation = reservation[0];

      if (depositAmount > 0) {
        await holdDepositToSystem(user._id, depositAmount, {
          description: `Cọc giữ hàng ${product.ProductName || ""}`.trim(),
          reservationId: reservation._id,
          session,
        });
        reservation.depositPaidAt = now;
        await reservation.save({ session });
      }
    });

    const depositNote =
      depositAmount > 0
        ? ` Đã cọc ${depositAmount.toLocaleString("vi-VN")}đ (${depositPercent}%) vào ví hệ thống.`
        : "";

    await notifyShopOwner(shop, {
      title: "Yêu cầu giữ hàng mới",
      content: `${user.FullName || user.UserName} yêu cầu giữ ${quantity} ${product.ProductName} — nhận lúc ${pickupTime.toLocaleString("vi-VN")}.${depositNote}`,
    });

    await createNotification(user._id, {
      title: "Đã gửi yêu cầu giữ hàng",
      content: `Yêu cầu giữ ${quantity} ${product.ProductName} đã gửi tới shop. Chờ shop xác nhận trước giờ lấy.${depositNote}`,
      audience: NOTIFICATION_AUDIENCE.BUYER,
    });

    return toPublicReservation(reservation);
  } finally {
    session.endSession();
  }
}

async function listBuyerReservations(user, { tab = "holding", search } = {}) {
  await processReservationLifecycle();
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
    userId: user._id,
    status: { $in: statusFilter },
  })
    .sort({ UpdatedAt: -1 })
    .limit(100);

  let mapped = await Promise.all(
    reservations.map(async (doc) => {
      const publicReservation = await toPublicReservation(doc);
      return {
        ...publicReservation,
        shopId: doc.shopId ? String(doc.shopId) : publicReservation.shopId || "",
      };
    })
  );

  const keyword = pickString(search).toLowerCase();
  if (keyword) {
    mapped = mapped.filter(
      (item) =>
        (item.product?.productName || "").toLowerCase().includes(keyword) ||
        (item.variant?.variantName || "").toLowerCase().includes(keyword) ||
        (item.storeName || "").toLowerCase().includes(keyword)
    );
  }

  return mapped;
}

async function listBuyerOrders(user, { tab = "holding", search } = {}) {
  const reservations = await listBuyerReservations(user, { tab, search });
  return { tab, reservations };
}

async function getBuyerReservation(user, reservationId) {
  await processReservationLifecycle();
  const reservation = await Reservation.findOne({ _id: reservationId, userId: user._id });
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng.", 404);
  }
  const publicReservation = await toPublicReservation(reservation);
  return {
    ...publicReservation,
    shopId: reservation.shopId ? String(reservation.shopId) : publicReservation.shopId || "",
  };
}

async function cancelReservationByBuyer(user, reservationId) {
  await processReservationLifecycle();
  const reservation = await Reservation.findOne({ _id: reservationId, userId: user._id });
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng.", 404);
  }

  if (reservation.status === RESERVATION_STATUS.WAITING_PICKUP) {
    throw createServiceError(
      "Shop đã đồng ý giữ hàng. Bạn không thể hủy — hãy đến nhận hàng và bấm Đã nhận hàng.",
      403
    );
  }
  if (reservation.status !== RESERVATION_STATUS.PENDING_SELLER_CONFIRMATION) {
    throw createServiceError("Không thể hủy đơn ở trạng thái này.");
  }

  const now = new Date();
  reservation.status = RESERVATION_STATUS.REFUNDED;
  reservation.cancelledAt = now;
  reservation.cancelReason = BUYER_CANCEL_REASON;
  await releaseVariantInventory(reservation);
  await refundDepositIfHeld(reservation);
  reservation.UpdatedAt = now;
  await reservation.save();

  const shop = await ShopProfile.findById(reservation.shopId);
  await notifyShopOwner(shop, {
    title: "Khách hủy giữ hàng",
    content: `${user.FullName || user.UserName} đã hủy yêu cầu giữ hàng.`,
  });

  return toPublicReservation(reservation);
}

/** Buyer xác nhận đã nhận hàng sau khi quét QR cố định của shop. */
async function confirmReceivedByBuyer(user, reservationId, { scannedShopId } = {}) {
  await processReservationLifecycle();
  const reservation = await Reservation.findOne({ _id: reservationId, userId: user._id });
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng.", 404);
  }

  if (reservation.status !== RESERVATION_STATUS.WAITING_PICKUP) {
    throw createServiceError("Chỉ xác nhận nhận hàng khi đơn đang chờ nhận.");
  }
  if (!isBeforePickupTime(reservation)) {
    throw createServiceError(
      "Đã quá giờ nhận hàng. Bạn không thể quét mã — hãy dùng Báo cáo shop nếu cần.",
      403
    );
  }

  const scanned = pickString(scannedShopId);
  if (!scanned) {
    throw createServiceError("Thiếu mã shop đã quét (scannedShopId).");
  }

  const shop = await ShopProfile.findById(reservation.shopId);
  if (!shop) {
    throw createServiceError("Không tìm thấy cửa hàng.", 404);
  }

  const shopId = String(shop._id);
  const qrValue = pickString(shop.qrCodeValue) || shopId;
  const scannedMatches =
    scanned === shopId ||
    scanned === qrValue ||
    scanned.toLowerCase() === shopId.toLowerCase() ||
    scanned.toLowerCase() === qrValue.toLowerCase();

  if (!scannedMatches) {
    throw createServiceError("QR không thuộc cửa hàng này", 400);
  }

  const now = new Date();
  const result = await finalizeCompleted(reservation, shop, {
    status: RESERVATION_STATUS.COMPLETED,
    now,
  });

  if (shop.userId) {
    await createNotification(shop.userId, {
      title: "Khách đã nhận hàng",
      content: `${user.FullName || user.UserName} đã quét QR shop và xác nhận nhận hàng. Cọc đã vào ví của bạn.`,
      audience: NOTIFICATION_AUDIENCE.SELLER,
    });
  }

  const product = await Product.findById(reservation.productId).select("ProductName").lean();
  const productName = product?.ProductName || "sản phẩm";
  await createNotification(user._id, {
    title: "Đơn hoàn thành",
    content: `Bạn đã nhận ${productName} thành công. Cảm ơn bạn đã mua hàng!`,
    audience: NOTIFICATION_AUDIENCE.BUYER,
  });

  return result;
}

/** Chỉ kiểm tra QR shop khớp đơn (trước popup xác nhận phía app). */
async function validateShopQrScan(user, reservationId, scannedShopId) {
  await processReservationLifecycle();
  const reservation = await Reservation.findOne({ _id: reservationId, userId: user._id });
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng.", 404);
  }
  if (reservation.status !== RESERVATION_STATUS.WAITING_PICKUP) {
    throw createServiceError("Đơn không ở trạng thái chờ nhận hàng.");
  }
  if (!isBeforePickupTime(reservation)) {
    throw createServiceError("Đã quá giờ nhận hàng.", 403);
  }

  const scanned = pickString(scannedShopId);
  if (!scanned) {
    throw createServiceError("Thiếu mã shop đã quét.");
  }

  const shop = await ShopProfile.findById(reservation.shopId);
  if (!shop) {
    throw createServiceError("Không tìm thấy cửa hàng.", 404);
  }

  const shopId = String(shop._id);
  const qrValue = pickString(shop.qrCodeValue) || shopId;
  const scannedMatches =
    scanned === shopId ||
    scanned === qrValue ||
    scanned.toLowerCase() === shopId.toLowerCase() ||
    scanned.toLowerCase() === qrValue.toLowerCase();

  if (!scannedMatches) {
    throw createServiceError("QR không thuộc cửa hàng này", 400);
  }

  return {
    ok: true,
    reservationId: String(reservation._id),
    shopId,
    message: "QR hợp lệ. Vui lòng xác nhận đã nhận hàng.",
  };
}

/** Buyer báo cáo shop sau pickupTime — luôn qua luồng evidence (GPS + ảnh). */
async function reportReservationByBuyer(user, reservationId, payload = {}) {
  const { reason, description, latitude, longitude, images } = payload || {};
  const { buyerReportSeller } = require("./reservationDisputeService");
  return buyerReportSeller(user, {
    reservationId,
    description: description || reason,
    reason,
    latitude,
    longitude,
    images,
  });
}

/**
 * Buyer đồng ý mất cọc sau quá giờ nhận (trong 24h).
 * Giải ngân SystemWallet → Seller, đơn COMPLETED.
 */
async function forfeitDepositByBuyer(user, reservationId) {
  await processReservationLifecycle();
  const reservation = await Reservation.findOne({ _id: reservationId, userId: user._id });
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng.", 404);
  }

  const status = Number(reservation.status);
  if (
    status !== RESERVATION_STATUS.WAITING_PICKUP &&
    status !== RESERVATION_STATUS.DISPUTED
  ) {
    throw createServiceError(
      "Chỉ đồng ý mất cọc khi đơn đang chờ nhận hàng / tranh chấp và đã quá giờ."
    );
  }
  if (!isPastPickupTime(reservation)) {
    throw createServiceError("Chưa tới giờ nhận hàng — không thể mất cọc.", 403);
  }
  if (
    !isWithinDepositDecisionWindow(reservation) &&
    status !== RESERVATION_STATUS.DISPUTED
  ) {
    throw createServiceError(
      "Đã quá 24 giờ sau giờ nhận hàng. Cọc đã (hoặc sẽ) chuyển cho người bán theo mặc định.",
      403
    );
  }
  if (
    Number(reservation.depositSettleTo) === 1 ||
    Number(reservation.depositSettleTo) === 2 ||
    reservation.depositSettledAt ||
    reservation.depositReleasedAt ||
    reservation.depositRefundedAt
  ) {
    throw createServiceError("Cọc đã được xử lý trước đó.", 400);
  }

  const shop = await ShopProfile.findById(reservation.shopId);
  if (!shop) {
    throw createServiceError("Không tìm thấy cửa hàng.", 404);
  }

  const now = new Date();
  const result = await finalizeCompleted(reservation, shop, {
    status: RESERVATION_STATUS.COMPLETED,
    now,
  });

  try {
    const Report = require("../models/Report");
    const { REPORT_STATUS, RESERVATION_REPORT_TYPES } = require("../constants");
    await Report.updateMany(
      {
        reservationId: reservation._id,
        reportType: { $in: RESERVATION_REPORT_TYPES },
        status: REPORT_STATUS.PENDING,
      },
      {
        $set: {
          status: REPORT_STATUS.APPROVED,
          processedAt: now,
          adminDecision: "buyer_forfeit",
          adminNote: "Buyer đồng ý mất cọc.",
          UpdatedAt: now,
        },
      }
    );
  } catch (error) {
    console.warn("forfeitDepositByBuyer close reports:", error.message);
  }

  if (shop.userId) {
    await createNotification(shop.userId, {
      title: "Nhận cọc giữ hàng",
      content: `${user.FullName || user.UserName} đã đồng ý mất cọc sau giờ nhận hàng. Cọc đã vào ví của bạn.`,
      audience: NOTIFICATION_AUDIENCE.SELLER,
    });
  }

  return result;
}

module.exports = {
  createReservation,
  listBuyerReservations,
  listBuyerOrders,
  getBuyerReservation,
  cancelReservationByBuyer,
  confirmReceivedByBuyer,
  validateShopQrScan,
  reportReservationByBuyer,
  forfeitDepositByBuyer,
};
