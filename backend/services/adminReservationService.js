const mongoose = require("mongoose");
const Reservation = require("../models/Reservation");
const ReservationAuditLog = require("../models/ReservationAuditLog");
const User = require("../models/User");
const ShopProfile = require("../models/ShopProfile");
const Product = require("../models/Product");
const {
  RESERVATION_STATUS,
  RESERVATION_STATUS_LABEL,
  RESERVATION_DISPUTE_REASON_LABEL,
  RESERVATION_AUDIT_ACTION,
  REPORT_STATUS,
  RESERVATION_REPORT_TYPES,
} = require("../constants");
const {
  toPublicReservation,
  refundDepositIfHeld,
  releaseDepositIfHeld,
  processReservationLifecycle,
  releaseVariantInventory,
} = require("./reservationService");
const reservationDisputeService = require("./reservationDisputeService");
const Report = require("../models/Report");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pickString(value) {
  return String(value || "").trim();
}

function toObjectId(value) {
  if (!mongoose.Types.ObjectId.isValid(String(value || ""))) {
    return null;
  }
  return new mongoose.Types.ObjectId(String(value));
}

function parsePagination({ page, limit }, defaultLimit = 20) {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || defaultLimit));
  return {
    page: pageNum,
    limit: limitNum,
    skip: (pageNum - 1) * limitNum,
  };
}

function parseDate(value, endOfDay = false) {
  const raw = pickString(value);
  if (!raw) {
    return null;
  }
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

function resolveTabStatusFilter(tab) {
  const normalized = pickString(tab).toLowerCase();
  switch (normalized) {
    case "disputes":
    case "dispute":
      return [RESERVATION_STATUS.DISPUTED];
    case "waiting":
    case "waiting_pickup":
      return [RESERVATION_STATUS.WAITING_PICKUP];
    case "completed":
      return [RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.AUTO_COMPLETED];
    case "auto":
    case "auto_completed":
      return [RESERVATION_STATUS.AUTO_COMPLETED];
    case "cancelled":
    case "canceled":
    case "cancelled_orders":
      return [
        RESERVATION_STATUS.REJECTED,
        RESERVATION_STATUS.REFUNDED,
        RESERVATION_STATUS.DISPUTE_RESOLVED,
      ];
    default:
      return null;
  }
}

async function resolveSellerShopIds(sellerId) {
  const objectId = toObjectId(sellerId);
  if (!objectId) {
    return [];
  }

  const shops = await ShopProfile.find({
    $or: [{ _id: objectId }, { userId: objectId }],
  })
    .select("_id")
    .lean();

  return shops.map((shop) => shop._id);
}

async function buildListFilter(query = {}) {
  const filter = {};
  const search = pickString(query.search);
  const buyerId = toObjectId(query.buyerId);
  const sellerId = pickString(query.sellerId);
  const dateFrom = parseDate(query.dateFrom);
  const dateTo = parseDate(query.dateTo, true);

  const tabStatuses = resolveTabStatusFilter(query.tab);
  const statusRaw = pickString(query.status);
  if (tabStatuses?.length) {
    filter.status = tabStatuses.length === 1 ? tabStatuses[0] : { $in: tabStatuses };
  } else if (statusRaw !== "" && Number.isFinite(Number(statusRaw))) {
    filter.status = Number(statusRaw);
  }

  if (buyerId) {
    filter.userId = buyerId;
  }

  if (sellerId) {
    const shopIds = await resolveSellerShopIds(sellerId);
    if (!shopIds.length) {
      filter.shopId = new mongoose.Types.ObjectId();
    } else {
      filter.shopId = { $in: shopIds };
    }
  }

  if (dateFrom || dateTo) {
    filter.CreatedAt = {};
    if (dateFrom) {
      filter.CreatedAt.$gte = dateFrom;
    }
    if (dateTo) {
      filter.CreatedAt.$lte = dateTo;
    }
  }

  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    const matchedUsers = await User.find({
      $or: [{ FullName: regex }, { UserName: regex }, { Email: regex }, { Phone: regex }],
    })
      .select("_id")
      .lean();

    const matchedUserIds = matchedUsers.map((item) => item._id);
    const shops = matchedUserIds.length
      ? await ShopProfile.find({ userId: { $in: matchedUserIds } }).select("_id").lean()
      : [];

    const orConditions = [
      { userId: { $in: matchedUserIds } },
      { shopId: { $in: shops.map((item) => item._id) } },
      { note: regex },
      { cancelReason: regex },
      { disputeReason: regex },
      { disputeDescription: regex },
    ];

    if (mongoose.Types.ObjectId.isValid(search)) {
      orConditions.push({ _id: new mongoose.Types.ObjectId(search) });
    }

    filter.$or = orConditions;
  }

  return filter;
}

async function getReservationStats(extraFilter = {}) {
  const base = { ...extraFilter };
  delete base.status;

  const [
    total,
    waitingPickup,
    completed,
    autoCompleted,
    disputed,
    refunded,
    pendingSellerConfirmation,
    rejected,
    disputeResolved,
  ] = await Promise.all([
    Reservation.countDocuments(base),
    Reservation.countDocuments({ ...base, status: RESERVATION_STATUS.WAITING_PICKUP }),
    Reservation.countDocuments({ ...base, status: RESERVATION_STATUS.COMPLETED }),
    Reservation.countDocuments({ ...base, status: RESERVATION_STATUS.AUTO_COMPLETED }),
    Reservation.countDocuments({ ...base, status: RESERVATION_STATUS.DISPUTED }),
    Reservation.countDocuments({ ...base, status: RESERVATION_STATUS.REFUNDED }),
    Reservation.countDocuments({
      ...base,
      status: RESERVATION_STATUS.PENDING_SELLER_CONFIRMATION,
    }),
    Reservation.countDocuments({ ...base, status: RESERVATION_STATUS.REJECTED }),
    Reservation.countDocuments({
      ...base,
      status: RESERVATION_STATUS.DISPUTE_RESOLVED,
    }),
  ]);

  const cancelled = rejected + refunded + disputeResolved;

  return {
    total,
    waitingPickup,
    completed,
    autoCompleted,
    completedAll: completed + autoCompleted,
    disputed,
    refunded,
    pendingSellerConfirmation,
    rejected,
    disputeResolved,
    cancelled,
  };
}

function mapListItem(reservation, { buyer, shop, shopOwner, product } = {}) {
  const shopName =
    shop?.shopName ||
    shopOwner?.FullName ||
    shopOwner?.UserName ||
    shop?.description ||
    "";

  return {
    id: String(reservation._id),
    code: String(reservation._id).slice(-8).toUpperCase(),
    status: reservation.status,
    statusLabel: RESERVATION_STATUS_LABEL[reservation.status] || "Không rõ",
    quantity: Number(reservation.quantity) || 0,
    reservedPrice: Number(reservation.reservedPrice) || 0,
    agreedPrice: Number(reservation.agreedPrice ?? reservation.reservedPrice) || 0,
    depositAmount: Number(reservation.depositAmount) || 0,
    pickupTime: reservation.pickupTime || null,
    note: reservation.note || "",
    cancelReason: reservation.cancelReason || "",
    disputeByBuyer: Boolean(reservation.disputeByBuyer),
    disputeBySeller: Boolean(reservation.disputeBySeller),
    disputedAt: reservation.disputedAt || null,
    disputeReason: reservation.disputeReason || "",
    disputeReasonLabel:
      RESERVATION_DISPUTE_REASON_LABEL[reservation.disputeReason] ||
      reservation.disputeReason ||
      "",
    disputeDescription: reservation.disputeDescription || "",
    createdAt: reservation.CreatedAt || null,
    buyer: buyer
      ? {
          id: String(buyer._id),
          fullName: buyer.FullName || "",
          userName: buyer.UserName || "",
          email: buyer.Email || "",
          phone: buyer.Phone || "",
          avatar: buyer.Avatar || "",
        }
      : null,
    shop: shop
      ? {
          id: String(shop._id),
          shopName,
          userId: shop.userId ? String(shop.userId) : "",
          address: shop.addressHeThong || shop.address || "",
          phone: shopOwner?.Phone || "",
        }
      : null,
    product: product
      ? {
          id: String(product._id),
          productName: product.ProductName || "",
          thumbnail: product.Thumbnail || "",
        }
      : null,
  };
}

async function hydrateReservations(reservations) {
  const userIds = [
    ...new Set(reservations.map((item) => String(item.userId || "")).filter(Boolean)),
  ];
  const shopIds = [
    ...new Set(reservations.map((item) => String(item.shopId || "")).filter(Boolean)),
  ];
  const productIds = [
    ...new Set(reservations.map((item) => String(item.productId || "")).filter(Boolean)),
  ];

  const [users, shops, products] = await Promise.all([
    userIds.length
      ? User.find({ _id: { $in: userIds } })
          .select("FullName UserName Email Phone Avatar")
          .lean()
      : [],
    shopIds.length
      ? ShopProfile.find({ _id: { $in: shopIds } })
          .select("userId description address shopName shopUsername")
          .lean()
      : [],
    productIds.length
      ? Product.find({ _id: { $in: productIds } }).select("ProductName Thumbnail").lean()
      : [],
  ]);

  const ownerIds = [
    ...new Set(shops.map((item) => String(item.userId || "")).filter(Boolean)),
  ];
  const owners = ownerIds.length
    ? await User.find({ _id: { $in: ownerIds } })
        .select("FullName UserName Phone Avatar")
        .lean()
    : [];

  const userMap = new Map(users.map((item) => [String(item._id), item]));
  const shopMap = new Map(shops.map((item) => [String(item._id), item]));
  const productMap = new Map(products.map((item) => [String(item._id), item]));
  const ownerMap = new Map(owners.map((item) => [String(item._id), item]));

  return reservations.map((item) => {
    const shop = shopMap.get(String(item.shopId || ""));
    return mapListItem(item, {
      buyer: userMap.get(String(item.userId || "")),
      shop,
      shopOwner: shop ? ownerMap.get(String(shop.userId || "")) : null,
      product: productMap.get(String(item.productId || "")),
    });
  });
}

async function listReservations(query = {}) {
  await processReservationLifecycle();

  const { page, limit, skip } = parsePagination(query);
  const filter = await buildListFilter(query);

  const [total, reservations, stats] = await Promise.all([
    Reservation.countDocuments(filter),
    Reservation.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(limit).lean(),
    getReservationStats(),
  ]);

  const items = await hydrateReservations(reservations);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    stats,
  };
}

async function listDisputes(query = {}) {
  return listReservations({
    ...query,
    tab: "disputes",
    status: String(RESERVATION_STATUS.DISPUTED),
  });
}

async function getBuyerStats(userId) {
  if (!userId) {
    return {
      totalReservations: 0,
      successfulReservations: 0,
      previousDisputes: 0,
    };
  }

  const [totalReservations, successfulReservations, previousDisputes] = await Promise.all([
    Reservation.countDocuments({ userId }),
    Reservation.countDocuments({
      userId,
      status: {
        $in: [RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.AUTO_COMPLETED],
      },
    }),
    Reservation.countDocuments({
      userId,
      $or: [
        { status: RESERVATION_STATUS.DISPUTED },
        { disputeByBuyer: true },
        { disputeBySeller: true },
      ],
    }),
  ]);

  return { totalReservations, successfulReservations, previousDisputes };
}

async function getShopStats(shopId) {
  if (!shopId) {
    return {
      totalReservations: 0,
      completedOrders: 0,
      previousDisputes: 0,
    };
  }

  const [totalReservations, completedOrders, previousDisputes] = await Promise.all([
    Reservation.countDocuments({ shopId }),
    Reservation.countDocuments({
      shopId,
      status: {
        $in: [RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.AUTO_COMPLETED],
      },
    }),
    Reservation.countDocuments({
      shopId,
      $or: [
        { status: RESERVATION_STATUS.DISPUTED },
        { disputeByBuyer: true },
        { disputeBySeller: true },
      ],
    }),
  ]);

  return { totalReservations, completedOrders, previousDisputes };
}

async function getReservationDetail(reservationId) {
  await processReservationLifecycle();

  const objectId = toObjectId(reservationId);
  if (!objectId) {
    throw createServiceError("ID đơn giữ hàng không hợp lệ.", 400);
  }

  const reservation = await Reservation.findById(objectId);
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng.", 404);
  }

  const [publicReservation, shop, buyerStats, shopStats, auditLogs, disputeReports] =
    await Promise.all([
      toPublicReservation(reservation),
      reservation.shopId ? ShopProfile.findById(reservation.shopId).lean() : null,
      getBuyerStats(reservation.userId),
      getShopStats(reservation.shopId),
      ReservationAuditLog.find({ reservationId: objectId }).sort({ CreatedAt: -1 }).lean(),
      reservationDisputeService
        .listReservationDisputeReports(null, objectId, { isAdmin: true })
        .catch(() => ({ reports: [] })),
    ]);

  let shopOwner = null;
  if (shop?.userId) {
    shopOwner = await User.findById(shop.userId)
      .select("FullName UserName Phone Avatar Email")
      .lean();
  }

  const shopName =
    shop?.shopName ||
    shopOwner?.FullName ||
    shopOwner?.UserName ||
    shop?.description ||
    publicReservation.storeName ||
    "";

  return {
    ...publicReservation,
    shopInfo: shop
      ? {
          id: String(shop._id),
          shopName,
          userId: shop.userId ? String(shop.userId) : "",
          fullName: shopOwner?.FullName || "",
          userName: shopOwner?.UserName || "",
          email: shopOwner?.Email || "",
          address: shop.addressHeThong || shop.address || "",
          phone: shopOwner?.Phone || "",
          avatar: shopOwner?.Avatar || "",
        }
      : null,
    seller: shopOwner
      ? {
          id: String(shopOwner._id),
          fullName: shopOwner.FullName || "",
          userName: shopOwner.UserName || "",
          email: shopOwner.Email || "",
          phone: shopOwner.Phone || "",
          avatar: shopOwner.Avatar || "",
        }
      : null,
    shopName,
    buyerStats,
    sellerStats: shopStats,
    shopStats,
    disputeReports: disputeReports?.reports || [],
    auditLogs: auditLogs.map((log) => ({
      id: String(log._id),
      adminId: log.adminId ? String(log.adminId) : "",
      reservationId: log.reservationId ? String(log.reservationId) : "",
      action: log.action || "",
      decision: log.decision || "",
      note: log.note || "",
      createdAt: log.CreatedAt || null,
    })),
  };
}

async function writeAuditLog(adminUser, reservationId, { action, decision, note }) {
  if (!adminUser?._id) {
    throw createServiceError("Không xác định được admin.", 401);
  }

  await ReservationAuditLog.create({
    adminId: adminUser._id,
    reservationId,
    action,
    decision: decision || "",
    note: pickString(note),
  });
}

function canRefundReservation(reservation) {
  const status = Number(reservation.status);
  if (status === RESERVATION_STATUS.DISPUTED) {
    return true;
  }
  return (
    status === RESERVATION_STATUS.WAITING_PICKUP &&
    (Boolean(reservation.disputeByBuyer) ||
      Boolean(reservation.disputeBySeller) ||
      Boolean(reservation.disputedAt))
  );
}

async function closePendingDisputeReports(adminUser, reservationId, decision, note) {
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
        processedBy: adminUser?._id || null,
        processedAt: now,
        adminDecision: decision,
        adminNote: pickString(note),
        UpdatedAt: now,
      },
    }
  );
}

async function refundToBuyer(adminUser, reservationId, { note } = {}) {
  const objectId = toObjectId(reservationId);
  if (!objectId) {
    throw createServiceError("ID đơn giữ hàng không hợp lệ.", 400);
  }

  const reservation = await Reservation.findById(objectId);
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng.", 404);
  }

  if (!canRefundReservation(reservation)) {
    throw createServiceError(
      "Chỉ có thể hoàn cọc cho đơn đang tranh chấp (hoặc chờ nhận hàng đã báo cáo).",
      400
    );
  }

  await refundDepositIfHeld(reservation);
  await releaseVariantInventory(reservation);

  reservation.status = RESERVATION_STATUS.REFUNDED;
  reservation.cancelledAt = reservation.cancelledAt || new Date();
  reservation.cancelReason = pickString(note) || "Admin hoàn cọc cho người mua.";
  reservation.UpdatedAt = new Date();
  await reservation.save();

  await closePendingDisputeReports(adminUser, reservation._id, "approve_buyer", note);

  await writeAuditLog(adminUser, reservation._id, {
    action: RESERVATION_AUDIT_ACTION.ADMIN_REFUND_BUYER,
    decision: "buyer_win",
    note,
  });

  return getReservationDetail(reservation._id);
}

async function releaseToSeller(adminUser, reservationId, { note } = {}) {
  const objectId = toObjectId(reservationId);
  if (!objectId) {
    throw createServiceError("ID đơn giữ hàng không hợp lệ.", 400);
  }

  const reservation = await Reservation.findById(objectId);
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng.", 404);
  }

  if (Number(reservation.status) !== RESERVATION_STATUS.DISPUTED) {
    throw createServiceError("Chỉ có thể giải phóng cọc cho đơn đang tranh chấp.", 400);
  }

  const shop = reservation.shopId ? await ShopProfile.findById(reservation.shopId) : null;
  if (!shop) {
    throw createServiceError("Không tìm thấy gian hàng của đơn giữ hàng.", 404);
  }

  const now = new Date();
  // Đền cọc cho seller nhưng KHÔNG tính là bán thành công: trả hàng về kho, đơn vào "Đã hủy".
  await releaseDepositIfHeld(reservation, shop);
  await releaseVariantInventory(reservation);

  reservation.status = RESERVATION_STATUS.DISPUTE_RESOLVED;
  reservation.cancelledAt = now;
  reservation.cancelReason =
    pickString(note) || "Admin xử lý tranh chấp: đền cọc cho người bán.";
  reservation.UpdatedAt = now;
  if (pickString(note)) {
    reservation.note = [reservation.note, pickString(note)].filter(Boolean).join(" | ");
  }
  await reservation.save();

  await closePendingDisputeReports(adminUser, reservation._id, "approve_seller", note);

  await writeAuditLog(adminUser, reservation._id, {
    action: RESERVATION_AUDIT_ACTION.ADMIN_RELEASE_SELLER,
    decision: "seller_win",
    note,
  });

  return getReservationDetail(reservation._id);
}

async function cancelReservation(adminUser, reservationId, reason = "") {
  const objectId = toObjectId(reservationId);
  if (!objectId) {
    throw createServiceError("ID đơn giữ hàng không hợp lệ.", 400);
  }

  const reservation = await Reservation.findById(objectId);
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng.", 404);
  }

  const status = Number(reservation.status);
  if (
    status === RESERVATION_STATUS.COMPLETED ||
    status === RESERVATION_STATUS.AUTO_COMPLETED
  ) {
    throw createServiceError("Không thể hủy đơn đã hoàn thành.", 400);
  }
  if (status === RESERVATION_STATUS.REFUNDED || status === RESERVATION_STATUS.REJECTED) {
    return getReservationDetail(reservationId);
  }

  await refundDepositIfHeld(reservation);
  await releaseVariantInventory(reservation);

  reservation.status = RESERVATION_STATUS.REFUNDED;
  reservation.cancelledAt = new Date();
  reservation.cancelReason = pickString(reason) || "Admin hủy đơn.";
  reservation.UpdatedAt = new Date();
  await reservation.save();

  if (adminUser?._id) {
    await writeAuditLog(adminUser, reservation._id, {
      action: RESERVATION_AUDIT_ACTION.ADMIN_REFUND_BUYER,
      decision: "buyer_win",
      note: reservation.cancelReason,
    });
  }

  return getReservationDetail(reservationId);
}

module.exports = {
  getReservationStats,
  listReservations,
  listDisputes,
  getReservationDetail,
  refundToBuyer,
  releaseToSeller,
  cancelReservation,
  createServiceError,
};
