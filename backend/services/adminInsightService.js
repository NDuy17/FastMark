const User = require("../models/User");
const ShopProfile = require("../models/ShopProfile");
const Product = require("../models/Product");
const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");
const WithdrawRequest = require("../models/WithdrawRequest");
const SystemWallet = require("../models/SystemWallet");
const Reservation = require("../models/Reservation");
const ReservationAuditLog = require("../models/ReservationAuditLog");
const Report = require("../models/Report");
const Review = require("../models/Review");
const {
  USER_ROLE,
  RESERVATION_STATUS_LABEL,
  REPORT_TYPE_LABELS,
  REPORT_STATUS_LABELS,
  REPORT_REPORTER_ROLE_LABELS,
  WALLET_TX_TYPE,
  WALLET_TX_STATUS,
  WALLET_TX_TYPE_LABEL,
  WALLET_TX_STATUS_LABEL,
  WITHDRAW_STATUS,
  WITHDRAW_STATUS_LABEL,
} = require("../constants");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parsePagination(query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

function buildPagination(page, limit, total) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

function toWalletTxItem(tx) {
  return {
    id: String(tx._id),
    type: tx.type,
    typeLabel: WALLET_TX_TYPE_LABEL[tx.type] || "Không rõ",
    amount: tx.amount,
    status: tx.status,
    statusLabel: WALLET_TX_STATUS_LABEL[tx.status] || "Không rõ",
    description: tx.description || "",
    balanceBefore: tx.balanceBefore,
    balanceAfter: tx.balanceAfter,
    orderCode: tx.orderCode,
    referenceType: tx.referenceType || "",
    referenceId: tx.referenceId ? String(tx.referenceId) : null,
    reservationId: tx.reservationId ? String(tx.reservationId) : null,
    createdAt: tx.CreatedAt || null,
  };
}

function toWithdrawItem(item) {
  return {
    id: String(item._id),
    amount: item.amount,
    status: item.status,
    statusLabel: WITHDRAW_STATUS_LABEL[item.status] || "Không rõ",
    bankName: item.bankName || "",
    bankCode: item.bankCode || "",
    accountNumber: item.accountNumber || "",
    accountName: item.accountName || "",
    adminNote: item.adminNote || "",
    processedAt: item.processedAt || null,
    createdAt: item.CreatedAt || null,
  };
}

function toReservationItem(reservation) {
  const product = reservation.productId || null;
  const shop = reservation.shopId || null;
  const buyer = reservation.userId || null;
  const shopOwner = shop?.userId && typeof shop.userId === "object" ? shop.userId : null;
  const totalPrice =
    (Number(reservation.reservedPrice) || 0) * (Number(reservation.quantity) || 0);

  return {
    id: String(reservation._id),
    status: reservation.status,
    statusLabel: RESERVATION_STATUS_LABEL[reservation.status] || "Không rõ",
    quantity: reservation.quantity || 0,
    reservedPrice: reservation.reservedPrice || 0,
    totalPrice,
    depositAmount: reservation.depositAmount || 0,
    depositSettleTo: reservation.depositSettleTo,
    pickupTime: reservation.pickupTime || null,
    disputeByBuyer: Boolean(reservation.disputeByBuyer),
    disputeBySeller: Boolean(reservation.disputeBySeller),
    createdAt: reservation.CreatedAt || null,
    completedAt: reservation.completedAt || null,
    product: product
      ? {
          id: String(product._id),
          name: product.ProductName || product.Name || product.name || "",
        }
      : null,
    shop: shop
      ? {
          id: String(shop._id),
          shopName:
            shopOwner?.FullName ||
            shopOwner?.UserName ||
            shop.shopName ||
            "",
          shopUsername: shopOwner?.UserName || shop.shopUsername || "",
        }
      : null,
    buyer: buyer
      ? {
          id: String(buyer._id),
          userName: buyer.UserName || "",
          fullName: buyer.FullName || "",
          email: buyer.Email || "",
        }
      : null,
  };
}

function toReportItem(report) {
  return {
    id: String(report._id),
    reportType: report.reportType,
    reportTypeLabel: REPORT_TYPE_LABELS[report.reportType] || "Không rõ",
    status: report.status,
    statusLabel: REPORT_STATUS_LABELS[report.status] || "Không rõ",
    reporterRole: report.reporterRole || null,
    reporterRoleLabel: REPORT_REPORTER_ROLE_LABELS[report.reporterRole] || "",
    title: report.title || report.sellerTitle || "",
    content: report.content || report.sellerContent || "",
    reservationId: report.reservationId ? String(report.reservationId) : null,
    createdAt: report.CreatedAt || null,
    processedAt: report.processedAt || null,
  };
}

function toReviewItem(review) {
  const product = review.productId || null;
  const shop = review.shopId || null;
  const shopOwner = shop?.userId && typeof shop.userId === "object" ? shop.userId : null;
  return {
    id: String(review._id),
    rating: review.rating || 0,
    comment: review.comment || "",
    isHidden: Boolean(review.isHidden),
    isDeleted: Boolean(review.isDeleted),
    createdAt: review.CreatedAt || null,
    product: product
      ? {
          id: String(product._id),
          name: product.ProductName || product.Name || product.name || "",
        }
      : null,
    shop: shop
      ? {
          id: String(shop._id),
          shopName:
            shopOwner?.FullName ||
            shopOwner?.UserName ||
            shop.shopName ||
            "",
        }
      : null,
  };
}

/**
 * Lịch sử hoạt động của một tài khoản theo tab (phục vụ trang chi tiết user).
 * tab: wallet | withdrawals | reservations | shop-reservations |
 *      reports-filed | reports-received | reviews
 */
async function getAccountHistory(userId, query = {}) {
  const user = await User.findById(userId).select("_id Role").lean();
  if (!user) {
    throw createServiceError("Không tìm thấy tài khoản.", 404);
  }

  const tab = String(query.tab || "wallet");
  const { page, limit, skip } = parsePagination(query);

  if (tab === "wallet") {
    const filter = { userId: user._id };
    const [total, rows] = await Promise.all([
      WalletTransaction.countDocuments(filter),
      WalletTransaction.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(limit).lean(),
    ]);
    return { tab, items: rows.map(toWalletTxItem), pagination: buildPagination(page, limit, total) };
  }

  if (tab === "withdrawals") {
    const filter = { userId: user._id };
    const [total, rows] = await Promise.all([
      WithdrawRequest.countDocuments(filter),
      WithdrawRequest.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(limit).lean(),
    ]);
    return { tab, items: rows.map(toWithdrawItem), pagination: buildPagination(page, limit, total) };
  }

  if (tab === "reservations") {
    const filter = { userId: user._id };
    const [total, rows] = await Promise.all([
      Reservation.countDocuments(filter),
      Reservation.find(filter)
        .sort({ CreatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("productId", "ProductName")
        .populate({
          path: "shopId",
          select: "userId",
          populate: { path: "userId", select: "FullName UserName" },
        })
        .lean(),
    ]);
    return { tab, items: rows.map(toReservationItem), pagination: buildPagination(page, limit, total) };
  }

  if (tab === "shop-reservations") {
    const shop = await ShopProfile.findOne({ userId: user._id }).select("_id").lean();
    if (!shop) {
      return { tab, items: [], pagination: buildPagination(page, limit, 0) };
    }
    const filter = { shopId: shop._id };
    const [total, rows] = await Promise.all([
      Reservation.countDocuments(filter),
      Reservation.find(filter)
        .sort({ CreatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("productId", "ProductName")
        .populate("userId", "UserName FullName Email")
        .lean(),
    ]);
    return { tab, items: rows.map(toReservationItem), pagination: buildPagination(page, limit, total) };
  }

  if (tab === "reports-filed" || tab === "reports-received") {
    const filter =
      tab === "reports-filed" ? { userId: user._id } : { targetUserId: user._id };
    const [total, rows] = await Promise.all([
      Report.countDocuments(filter),
      Report.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(limit).lean(),
    ]);
    return { tab, items: rows.map(toReportItem), pagination: buildPagination(page, limit, total) };
  }

  if (tab === "reviews") {
    const filter = { userId: user._id };
    const [total, rows] = await Promise.all([
      Review.countDocuments(filter),
      Review.find(filter)
        .sort({ CreatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("productId", "ProductName")
        .populate({
          path: "shopId",
          select: "userId",
          populate: { path: "userId", select: "FullName UserName" },
        })
        .lean(),
    ]);
    return { tab, items: rows.map(toReviewItem), pagination: buildPagination(page, limit, total) };
  }

  if (tab === "products") {
    const shop = await ShopProfile.findOne({ userId: user._id }).select("_id").lean();
    if (!shop) {
      return { tab, items: [], pagination: buildPagination(page, limit, 0) };
    }

    const filter = { ShopId: shop._id };
    const [total, rows] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter)
        .sort({ CreatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("CategoryId", "name categoryName")
        .lean(),
    ]);

    const { loadProductImagesByProductIds, toPublicProductImages } = require("./productService");
    const imagesByProduct = await loadProductImagesByProductIds(rows.map((item) => item._id));

    const items = rows.map((product) => {
      const category = product.CategoryId || null;
      const thumbs = toPublicProductImages(imagesByProduct.get(String(product._id)) || []).map(
        (image) => image.imageUrl
      );
      const legacy = Array.isArray(product.Thumbnail)
        ? product.Thumbnail.filter(Boolean)
        : product.Thumbnail
          ? [String(product.Thumbnail)]
          : [];
      const minPrice = Number(product.MinPrice) || 0;
      const maxPrice = Number(product.MaxPrice) || 0;
      return {
        id: String(product._id),
        productName: product.ProductName || "",
        thumbnail: thumbs[0] || legacy[0] || "",
        categoryName: category?.name || category?.categoryName || "",
        donVi: product.DonVi || "",
        minPrice,
        maxPrice,
        priceLabel:
          minPrice === maxPrice
            ? `${minPrice.toLocaleString("vi-VN")} đ`
            : `${minPrice.toLocaleString("vi-VN")} đ - ${maxPrice.toLocaleString("vi-VN")} đ`,
        status: product.Status,
        statusLabel: product.Status === 1 ? "Đang hiện" : "Đã ẩn",
        soldCount: Number(product.SoldCount) || 0,
        viewCount: Number(product.ViewCount) || 0,
        likeCount: Number(product.LikeCount) || 0,
        shopId: String(shop._id),
        createdAt: product.CreatedAt || null,
      };
    });

    return { tab, items, pagination: buildPagination(page, limit, total) };
  }

  throw createServiceError(`Tab lịch sử không hợp lệ: ${tab}`);
}

async function sumTransactions(userId, type) {
  const rows = await WalletTransaction.aggregate([
    {
      $match: {
        userId,
        type,
        status: WALLET_TX_STATUS.SUCCESS,
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);
  return { total: rows[0]?.total || 0, count: rows[0]?.count || 0 };
}

/**
 * Tổng hợp tài chính một tài khoản: số dư ví, tổng nạp / rút / cọc / hoàn.
 */
async function getAccountFinanceSummary(userId) {
  const user = await User.findById(userId).select("_id Role").lean();
  if (!user) {
    throw createServiceError("Không tìm thấy tài khoản.", 404);
  }

  const [
    wallet,
    topup,
    payment,
    refund,
    withdrawal,
    depositHold,
    depositRefund,
    depositRelease,
    pendingWithdraws,
  ] = await Promise.all([
    Wallet.findOne({ userId: user._id }).lean(),
    sumTransactions(user._id, WALLET_TX_TYPE.TOPUP),
    sumTransactions(user._id, WALLET_TX_TYPE.PAYMENT),
    sumTransactions(user._id, WALLET_TX_TYPE.REFUND),
    sumTransactions(user._id, WALLET_TX_TYPE.WITHDRAWAL),
    sumTransactions(user._id, WALLET_TX_TYPE.DEPOSIT_HOLD),
    sumTransactions(user._id, WALLET_TX_TYPE.DEPOSIT_REFUND),
    sumTransactions(user._id, WALLET_TX_TYPE.DEPOSIT_RELEASE),
    WithdrawRequest.countDocuments({ userId: user._id, status: WITHDRAW_STATUS.PENDING }),
  ]);

  return {
    walletBalance: wallet?.balance || 0,
    totalTopup: topup.total,
    topupCount: topup.count,
    totalPayment: payment.total,
    paymentCount: payment.count,
    totalRefund: refund.total,
    refundCount: refund.count,
    totalWithdrawal: withdrawal.total,
    withdrawalCount: withdrawal.count,
    totalDepositHold: depositHold.total,
    depositHoldCount: depositHold.count,
    totalDepositRefund: depositRefund.total,
    depositRefundCount: depositRefund.count,
    totalDepositRelease: depositRelease.total,
    depositReleaseCount: depositRelease.count,
    pendingWithdrawCount: pendingWithdraws,
  };
}

function resolveRange(query = {}) {
  const now = new Date();
  let to = query.to ? new Date(`${query.to}T23:59:59.999`) : now;
  let from;
  if (query.from) {
    from = new Date(`${query.from}T00:00:00.000`);
  } else {
    from = new Date(to);
    from.setDate(from.getDate() - 29);
    from.setHours(0, 0, 0, 0);
  }
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    throw createServiceError("Khoảng thời gian không hợp lệ.");
  }
  return { from, to };
}

async function sumTxInRange(type, from, to) {
  const rows = await WalletTransaction.aggregate([
    {
      $match: {
        type,
        status: WALLET_TX_STATUS.SUCCESS,
        CreatedAt: { $gte: from, $lte: to },
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);
  return { total: rows[0]?.total || 0, count: rows[0]?.count || 0 };
}

async function dailyTxSeries(type, from, to) {
  const rows = await WalletTransaction.aggregate([
    {
      $match: {
        type,
        status: WALLET_TX_STATUS.SUCCESS,
        CreatedAt: { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$CreatedAt" } },
        total: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((row) => ({ date: row._id, total: row.total, count: row.count }));
}

async function sumWalletBalanceByRole(role) {
  const rows = await Wallet.aggregate([
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    { $match: { "user.Role": role } },
    { $group: { _id: null, total: { $sum: "$balance" }, count: { $sum: 1 } } },
  ]);
  return { total: rows[0]?.total || 0, count: rows[0]?.count || 0 };
}

const DETAIL_LIMIT = 40;

async function listWalletsByRole(role = null) {
  const wallets = await Wallet.find({})
    .sort({ balance: -1 })
    .populate("userId", "FullName UserName Email Phone Role")
    .lean();

  const allowedRoles =
    role != null ? [role] : [USER_ROLE.BUYER, USER_ROLE.SELLER];

  return wallets
    .filter((row) => {
      const userRole = Number(row.userId?.Role);
      return allowedRoles.includes(userRole);
    })
    .slice(0, DETAIL_LIMIT)
    .map((row) => {
      const user = row.userId || {};
      const userRole = Number(user.Role);
      return {
        id: String(user._id || row.userId || ""),
        fullName: user.FullName || "",
        userName: user.UserName || "",
        email: user.Email || "",
        phone: user.Phone || "",
        role: userRole,
        roleLabel: userRole === USER_ROLE.SELLER ? "Người bán" : "Người mua",
        balance: Number(row.balance) || 0,
      };
    });
}

async function listEscrowReservations() {
  const rows = await Reservation.find({
    depositPaidAt: { $ne: null },
    depositSettleTo: 0,
    depositAmount: { $gt: 0 },
  })
    .sort({ depositPaidAt: -1 })
    .limit(DETAIL_LIMIT)
    .populate("userId", "FullName UserName Phone Email")
    .populate({
      path: "shopId",
      select: "userId shopName",
      populate: { path: "userId", select: "FullName UserName" },
    })
    .populate("productId", "ProductName")
    .select(
      "depositAmount depositPaidAt pickupTime status userId shopId productId quantity reservedPrice"
    )
    .lean();

  return rows.map((row) => {
    const shop = row.shopId || null;
    const shopOwner = shop?.userId && typeof shop.userId === "object" ? shop.userId : null;
    return {
      id: String(row._id),
      productName: row.productId?.ProductName || "Sản phẩm",
      depositAmount: Number(row.depositAmount) || 0,
      depositPaidAt: row.depositPaidAt || null,
      pickupTime: row.pickupTime || null,
      status: Number(row.status),
      statusLabel: RESERVATION_STATUS_LABEL[row.status] || String(row.status),
      buyerName: row.userId?.FullName || row.userId?.UserName || "—",
      buyerPhone: row.userId?.Phone || "",
      shopName:
        shopOwner?.FullName || shopOwner?.UserName || shop?.shopName || "—",
      quantity: Number(row.quantity) || 0,
      reservedPrice: Number(row.reservedPrice) || 0,
    };
  });
}

async function listPendingWithdraws() {
  const rows = await WithdrawRequest.find({ status: WITHDRAW_STATUS.PENDING })
    .sort({ CreatedAt: -1 })
    .limit(DETAIL_LIMIT)
    .lean();
  const userIds = rows.map((row) => row.userId).filter(Boolean);
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } })
        .select("FullName UserName Phone Email")
        .lean()
    : [];
  const userMap = new Map(users.map((user) => [String(user._id), user]));

  return rows.map((row) => {
    const user = userMap.get(String(row.userId));
    return {
      id: String(row._id),
      amount: Number(row.amount) || 0,
      bankName: row.bankName || "",
      bankCode: row.bankCode || "",
      accountNumber: row.accountNumber || "",
      accountName: row.accountName || "",
      createdAt: row.CreatedAt || null,
      statusLabel: WITHDRAW_STATUS_LABEL[row.status] || "Chờ duyệt",
      userName: user?.FullName || user?.UserName || "",
      userPhone: user?.Phone || "",
      userEmail: user?.Email || "",
    };
  });
}

async function listTxInRange(type, from, to) {
  const rows = await WalletTransaction.find({
    type,
    status: WALLET_TX_STATUS.SUCCESS,
    CreatedAt: { $gte: from, $lte: to },
  })
    .sort({ CreatedAt: -1 })
    .limit(DETAIL_LIMIT)
    .lean();
  const userIds = rows.map((row) => row.userId).filter(Boolean);
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } })
        .select("FullName UserName Phone Email Role")
        .lean()
    : [];
  const userMap = new Map(users.map((user) => [String(user._id), user]));

  return rows.map((row) => {
    const user = userMap.get(String(row.userId));
    return {
      id: String(row._id),
      amount: Number(row.amount) || 0,
      description: row.description || "",
      orderCode: row.orderCode || "",
      reservationId: row.reservationId ? String(row.reservationId) : "",
      createdAt: row.CreatedAt || null,
      typeLabel: WALLET_TX_TYPE_LABEL[row.type] || "",
      userName: user?.FullName || user?.UserName || "",
      userPhone: user?.Phone || "",
      userEmail: user?.Email || "",
      roleLabel:
        Number(user?.Role) === USER_ROLE.SELLER
          ? "Người bán"
          : Number(user?.Role) === USER_ROLE.BUYER
            ? "Người mua"
            : "",
    };
  });
}

/**
 * Tổng quan tài chính hệ thống (trang Tài chính admin).
 */
async function getFinanceOverview(query = {}) {
  const { from, to } = resolveRange(query);

  const [
    buyerWallets,
    sellerWallets,
    systemWallet,
    topupInRange,
    withdrawInRange,
    paymentInRange,
    depositHoldInRange,
    depositRefundInRange,
    depositReleaseInRange,
    pendingWithdrawAgg,
    topupSeries,
    withdrawSeries,
    paymentSeries,
    depositReleaseSeries,
    buyerWalletList,
    sellerWalletList,
    allWalletList,
    escrowList,
    pendingWithdrawList,
    topupList,
    withdrawalList,
    paymentList,
    depositHoldList,
    depositRefundList,
    depositReleaseList,
  ] = await Promise.all([
    sumWalletBalanceByRole(USER_ROLE.BUYER),
    sumWalletBalanceByRole(USER_ROLE.SELLER),
    SystemWallet.findOne({ key: "system" }).lean(),
    sumTxInRange(WALLET_TX_TYPE.TOPUP, from, to),
    sumTxInRange(WALLET_TX_TYPE.WITHDRAWAL, from, to),
    sumTxInRange(WALLET_TX_TYPE.PAYMENT, from, to),
    sumTxInRange(WALLET_TX_TYPE.DEPOSIT_HOLD, from, to),
    sumTxInRange(WALLET_TX_TYPE.DEPOSIT_REFUND, from, to),
    sumTxInRange(WALLET_TX_TYPE.DEPOSIT_RELEASE, from, to),
    WithdrawRequest.aggregate([
      { $match: { status: WITHDRAW_STATUS.PENDING } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    dailyTxSeries(WALLET_TX_TYPE.TOPUP, from, to),
    dailyTxSeries(WALLET_TX_TYPE.WITHDRAWAL, from, to),
    dailyTxSeries(WALLET_TX_TYPE.PAYMENT, from, to),
    dailyTxSeries(WALLET_TX_TYPE.DEPOSIT_RELEASE, from, to),
    listWalletsByRole(USER_ROLE.BUYER),
    listWalletsByRole(USER_ROLE.SELLER),
    listWalletsByRole(null),
    listEscrowReservations(),
    listPendingWithdraws(),
    listTxInRange(WALLET_TX_TYPE.TOPUP, from, to),
    listTxInRange(WALLET_TX_TYPE.WITHDRAWAL, from, to),
    listTxInRange(WALLET_TX_TYPE.PAYMENT, from, to),
    listTxInRange(WALLET_TX_TYPE.DEPOSIT_HOLD, from, to),
    listTxInRange(WALLET_TX_TYPE.DEPOSIT_REFUND, from, to),
    listTxInRange(WALLET_TX_TYPE.DEPOSIT_RELEASE, from, to),
  ]);

  return {
    range: { from, to },
    balances: {
      buyerWalletTotal: buyerWallets.total,
      buyerWalletCount: buyerWallets.count,
      sellerWalletTotal: sellerWallets.total,
      sellerWalletCount: sellerWallets.count,
      escrowBalance: systemWallet?.balance || 0,
    },
    inRange: {
      topup: topupInRange,
      withdrawal: withdrawInRange,
      // PAYMENT = thanh toán gói seller/banner từ ví → doanh thu nền tảng.
      platformRevenue: paymentInRange,
      depositHold: depositHoldInRange,
      depositRefund: depositRefundInRange,
      depositRelease: depositReleaseInRange,
    },
    pendingWithdraw: {
      total: pendingWithdrawAgg[0]?.total || 0,
      count: pendingWithdrawAgg[0]?.count || 0,
    },
    series: {
      topup: topupSeries,
      withdrawal: withdrawSeries,
      platformRevenue: paymentSeries,
      depositRelease: depositReleaseSeries,
    },
    details: {
      allWallets: allWalletList,
      buyerWallets: buyerWalletList,
      sellerWallets: sellerWalletList,
      escrow: escrowList,
      pendingWithdraw: pendingWithdrawList,
      topup: topupList,
      withdrawal: withdrawalList,
      platformRevenue: paymentList,
      depositHold: depositHoldList,
      depositRefund: depositRefundList,
      depositRelease: depositReleaseList,
    },
  };
}

/**
 * Nhật ký thao tác admin trên đơn giữ hàng (tranh chấp).
 */
async function listAuditLogs(query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};

  if (query.action) {
    filter.action = String(query.action);
  }
  if (query.reservationId) {
    filter.reservationId = query.reservationId;
  }

  const [total, rows] = await Promise.all([
    ReservationAuditLog.countDocuments(filter),
    ReservationAuditLog.find(filter)
      .sort({ CreatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("adminId", "UserName FullName Email")
      .lean(),
  ]);

  const items = rows.map((log) => ({
    id: String(log._id),
    action: log.action,
    decision: log.decision || "",
    note: log.note || "",
    reservationId: log.reservationId ? String(log.reservationId) : null,
    createdAt: log.CreatedAt || null,
    admin: log.adminId
      ? {
          id: String(log.adminId._id),
          userName: log.adminId.UserName || "",
          fullName: log.adminId.FullName || "",
          email: log.adminId.Email || "",
        }
      : null,
  }));

  return { items, pagination: buildPagination(page, limit, total) };
}

module.exports = {
  getAccountHistory,
  getAccountFinanceSummary,
  getFinanceOverview,
  listAuditLogs,
};
