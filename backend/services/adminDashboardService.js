const mongoose = require("mongoose");
const User = require("../models/User");
const ShopProfile = require("../models/ShopProfile");
const Product = require("../models/Product");
const ProductImage = require("../models/ProductImage");
const Reservation = require("../models/Reservation");
const FavoriteProduct = require("../models/FavoriteProduct");
const Follow = require("../models/Follow");
const SystemWallet = require("../models/SystemWallet");
const SellerSubscription = require("../models/SellerSubscription");
const SellerBannerPlan = require("../models/SellerBannerPlan");
const SellerVerification = require("../models/SellerVerification");
const Report = require("../models/Report");
const WithdrawRequest = require("../models/WithdrawRequest");
const WalletTransaction = require("../models/WalletTransaction");
const { USER_ROLE } = require("../constants");
const { USER_STATUS } = require("../constants");
const { SHOP_STATUS } = require("../constants");
const { PRODUCT_STATUS } = require("../constants");
const {
  RESERVATION_STATUS,
  SELLER_SUBSCRIPTION_STATUS,
  SELLER_VERIFICATION_STATUS,
  SELLER_BANNER_STATUS,
  REPORT_STATUS,
  CONTENT_REPORT_TYPES,
  WITHDRAW_STATUS,
  WALLET_TX_TYPE,
  WALLET_TX_STATUS,
} = require("../constants");
const { computeTotal } = require("./reservationService");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function addDays(date, days) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function toDateKey(date) {
  const value = new Date(date);
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function resolveDateRange(query = {}) {
  const now = new Date();
  const range = String(query.range || query.period || "today").toLowerCase();
  let from = null;
  let to = endOfDay(now);

  if (query.from || query.startDate) {
    from = startOfDay(new Date(query.from || query.startDate));
  }
  if (query.to || query.endDate) {
    to = endOfDay(new Date(query.to || query.endDate));
  }

  if (!from) {
    if (range === "day" || range === "today") {
      from = startOfDay(now);
    } else if (range === "week" || range === "7days") {
      from = startOfDay(addDays(now, -6));
    } else if (range === "15days") {
      from = startOfDay(addDays(now, -14));
    } else if (range === "month" || range === "30days") {
      from = startOfDay(addDays(now, -29));
    } else if (range === "custom") {
      throw createServiceError("Khoảng thời gian tùy chọn cần from và to.", 400);
    } else {
      from = startOfDay(now);
    }
  }

  if (!(from instanceof Date) || Number.isNaN(from.getTime())) {
    throw createServiceError("Ngày bắt đầu không hợp lệ.", 400);
  }
  if (!(to instanceof Date) || Number.isNaN(to.getTime())) {
    throw createServiceError("Ngày kết thúc không hợp lệ.", 400);
  }
  if (from > to) {
    throw createServiceError("from phải nhỏ hơn hoặc bằng to.", 400);
  }

  const maxSpanMs = 366 * 24 * 60 * 60 * 1000;
  if (to - from > maxSpanMs) {
    throw createServiceError("Khoảng thời gian tối đa là 366 ngày.", 400);
  }

  return {
    range: query.from || query.to ? "custom" : range === "custom" ? "custom" : range,
    from,
    to,
  };
}

function buildEmptySeries(from, to) {
  const series = [];
  let cursor = startOfDay(from);
  const last = startOfDay(to);
  while (cursor <= last) {
    series.push({ date: toDateKey(cursor), value: 0 });
    cursor = addDays(cursor, 1);
  }
  return series;
}

function fillSeries(emptySeries, rows, dateField = "_id", valueField = "count") {
  const map = new Map(emptySeries.map((item) => [item.date, 0]));
  for (const row of rows) {
    const key = String(row[dateField] || "");
    if (map.has(key)) {
      map.set(key, Number(row[valueField]) || 0);
    }
  }
  return emptySeries.map((item) => ({
    date: item.date,
    value: map.get(item.date) || 0,
  }));
}

async function aggregateDailyCount(Model, match, dateField = "CreatedAt") {
  return Model.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: `$${dateField}` },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}

/** Đếm theo ngày với mốc thời gian fallback (vd completedAt ?? UpdatedAt). */
async function aggregateDailyCountWithFallback(Model, match, dateField, fallbackField) {
  return Model.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: { $ifNull: [`$${dateField}`, `$${fallbackField}`] },
          },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}

/** Tổng một field số theo ngày. */
async function aggregateDailySum(Model, match, dateField, sumField) {
  return Model.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: `$${dateField}` },
        },
        count: { $sum: `$${sumField}` },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}

async function aggregatePackageSales(Model, from, to, extraMatch = {}) {
  const rows = await Model.aggregate([
    {
      $addFields: {
        purchaseDate: { $ifNull: ["$ngayMua", "$CreatedAt"] },
      },
    },
    {
      $match: {
        purchaseDate: { $gte: from, $lte: to },
        amount: { $gt: 0 },
        ...extraMatch,
      },
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        revenue: { $sum: "$amount" },
      },
    },
  ]);
  return {
    count: Number(rows[0]?.count) || 0,
    revenue: Number(rows[0]?.revenue) || 0,
  };
}

async function aggregateDailyPackageRevenue(Model, from, to, extraMatch = {}) {
  return Model.aggregate([
    {
      $addFields: {
        purchaseDate: { $ifNull: ["$ngayMua", "$CreatedAt"] },
      },
    },
    {
      $match: {
        purchaseDate: { $gte: from, $lte: to },
        amount: { $gt: 0 },
        ...extraMatch,
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$purchaseDate" },
        },
        count: { $sum: "$amount" },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}

async function aggregatePackageBreakdown(Model, from, to, extraMatch = {}) {
  return Model.aggregate([
    {
      $addFields: {
        purchaseDate: { $ifNull: ["$ngayMua", "$CreatedAt"] },
      },
    },
    {
      $match: {
        purchaseDate: { $gte: from, $lte: to },
        amount: { $gt: 0 },
        ...extraMatch,
      },
    },
    {
      $group: {
        _id: { $ifNull: ["$planName", "Gói không tên"] },
        count: { $sum: 1 },
        revenue: { $sum: "$amount" },
      },
    },
    { $sort: { revenue: -1, count: -1 } },
    { $limit: 10 },
  ]);
}

const CANCELLED_RESERVATION_STATUSES = [
  RESERVATION_STATUS.REJECTED,
  RESERVATION_STATUS.REFUNDED,
  RESERVATION_STATUS.DISPUTE_RESOLVED,
];

const COMPLETED_RESERVATION_STATUSES = [
  RESERVATION_STATUS.COMPLETED,
  RESERVATION_STATUS.AUTO_COMPLETED,
];

function completedInWindowMatch(from, to) {
  return {
    status: { $in: COMPLETED_RESERVATION_STATUSES },
    $or: [
      { completedAt: { $gte: from, $lte: to } },
      { completedAt: null, UpdatedAt: { $gte: from, $lte: to } },
    ],
  };
}

/** Đếm nhanh các chỉ số của một khoảng thời gian (dùng cho kỳ trước để so sánh). */
async function collectPeriodMetrics(from, to) {
  const createdInWindow = { CreatedAt: { $gte: from, $lte: to } };
  const [
    newUsers,
    newSellers,
    newProducts,
    newReservations,
    completedReservationDocs,
    cancelledReservations,
    disputedReservations,
    sellerPlanSales,
    bannerPlanSales,
    depositRows,
    topupRows,
    withdrawRows,
    sellerVerificationRequests,
    newReports,
    reportedShopIdsInWindow,
    newBanners,
    escrowRows,
  ] = await Promise.all([
    User.countDocuments({ ...createdInWindow, Role: { $ne: USER_ROLE.ADMIN } }),
    User.countDocuments({ ...createdInWindow, Role: USER_ROLE.SELLER }),
    Product.countDocuments({ ...createdInWindow, IsDeleted: { $ne: true } }),
    Reservation.countDocuments(createdInWindow),
    Reservation.find(completedInWindowMatch(from, to))
      .select("agreedPrice reservedPrice quantity")
      .lean(),
    Reservation.countDocuments({
      status: { $in: CANCELLED_RESERVATION_STATUSES },
      $or: [
        { cancelledAt: { $gte: from, $lte: to } },
        { cancelledAt: null, UpdatedAt: { $gte: from, $lte: to } },
      ],
    }),
    Reservation.countDocuments({ disputedAt: { $gte: from, $lte: to } }),
    aggregatePackageSales(SellerSubscription, from, to, {
      status: { $ne: SELLER_SUBSCRIPTION_STATUS.PENDING_PAYMENT },
    }),
    aggregatePackageSales(SellerBannerPlan, from, to),
    Reservation.aggregate([
      {
        $match: {
          depositPaidAt: { $gte: from, $lte: to },
          depositAmount: { $gt: 0 },
        },
      },
      { $group: { _id: null, amount: { $sum: "$depositAmount" }, count: { $sum: 1 } } },
    ]),
    WalletTransaction.aggregate([
      {
        $match: {
          type: WALLET_TX_TYPE.TOPUP,
          status: WALLET_TX_STATUS.SUCCESS,
          CreatedAt: { $gte: from, $lte: to },
        },
      },
      { $group: { _id: null, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    WithdrawRequest.aggregate([
      { $match: createdInWindow },
      { $group: { _id: null, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    SellerVerification.countDocuments(createdInWindow),
    Report.countDocuments(createdInWindow),
    Report.distinct("shopId", { ...createdInWindow, shopId: { $ne: null } }),
    SellerBannerPlan.countDocuments(createdInWindow),
    // Cọc phát sinh trong kỳ và vẫn đang treo (chưa quyết toán).
    Reservation.aggregate([
      {
        $match: {
          depositPaidAt: { $gte: from, $lte: to },
          depositSettleTo: 0,
          depositAmount: { $gt: 0 },
        },
      },
      { $group: { _id: null, amount: { $sum: "$depositAmount" }, count: { $sum: 1 } } },
    ]),
  ]);

  const orderRevenue = completedReservationDocs.reduce(
    (sum, doc) => sum + computeTotal(doc),
    0
  );

  return {
    newUsers,
    newSellers,
    newProducts,
    newReservations,
    completedReservations: completedReservationDocs.length,
    cancelledReservations,
    disputedReservations,
    sellerPlanRevenue: sellerPlanSales.revenue,
    sellerPlansSold: sellerPlanSales.count,
    bannerPlanRevenue: bannerPlanSales.revenue,
    bannerPlansSold: bannerPlanSales.count,
    depositAmount: Number(depositRows[0]?.amount) || 0,
    depositCount: Number(depositRows[0]?.count) || 0,
    topupAmount: Number(topupRows[0]?.amount) || 0,
    topupCount: Number(topupRows[0]?.count) || 0,
    withdrawAmount: Number(withdrawRows[0]?.amount) || 0,
    withdrawCount: Number(withdrawRows[0]?.count) || 0,
    sellerVerificationRequests,
    newReports,
    reportedShops: reportedShopIdsInWindow.length,
    newBanners,
    escrowAmount: Number(escrowRows[0]?.amount) || 0,
    escrowCount: Number(escrowRows[0]?.count) || 0,
    orderRevenue,
    revenue: sellerPlanSales.revenue + bannerPlanSales.revenue,
  };
}

async function getAdminDashboard(query = {}) {
  const { range, from, to } = resolveDateRange(query);
  const createdInRange = { CreatedAt: { $gte: from, $lte: to } };
  const emptySeries = buildEmptySeries(from, to);
  const now = new Date();

  // Kỳ trước có cùng độ dài để tính % tăng giảm.
  const periodDays = Math.max(
    1,
    Math.round((startOfDay(to) - startOfDay(from)) / (24 * 60 * 60 * 1000)) + 1
  );
  const prevFrom = startOfDay(addDays(from, -periodDays));
  const prevTo = endOfDay(addDays(from, -1));
  const monthFrom = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthTo = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const paidSellerSubscriptionMatch = {
    status: { $ne: SELLER_SUBSCRIPTION_STATUS.PENDING_PAYMENT },
  };

  const [
    totalUsers,
    totalBuyers,
    totalSellers,
    totalAdmins,
    totalShops,
    totalActiveShops,
    totalProducts,
    totalActiveProducts,
    totalReservations,
    reservationsByStatus,
    usersInRange,
    sellersInRange,
    shopsInRange,
    productsInRange,
    reservationsInRange,
    completedReservations,
    topFavoriteProducts,
    topShops,
    followInRange,
    favoriteProductsInRange,
    systemWallet,
    unsettledDeposits,
    sellerPlanSalesInRange,
    bannerPlanSalesInRange,
    sellerPlanSalesThisMonth,
    bannerPlanSalesThisMonth,
    sellerPlanBreakdown,
    bannerPlanBreakdown,
    currentPeriod,
    previousPeriod,
    pendingSellerVerifications,
    pendingReports,
    reportedShopIds,
    pendingBanners,
    pendingWithdrawRows,
    sellerPlanRevenueDaily,
    bannerPlanRevenueDaily,
    completedForRevenueSeries,
    completedDaily,
    cancelledDaily,
    disputedDaily,
    depositDaily,
    topupDaily,
    withdrawDaily,
    sellerVerificationDaily,
    reportDaily,
    reportedShopDaily,
    bannerDaily,
    escrowDaily,
  ] = await Promise.all([
    User.countDocuments({ Role: { $ne: USER_ROLE.ADMIN } }),
    User.countDocuments({ Role: USER_ROLE.BUYER }),
    User.countDocuments({ Role: USER_ROLE.SELLER }),
    User.countDocuments({ Role: USER_ROLE.ADMIN }),
    ShopProfile.countDocuments({}),
    ShopProfile.countDocuments({ status: SHOP_STATUS.ACTIVE }),
    Product.countDocuments({ IsDeleted: { $ne: true } }),
    Product.countDocuments({ IsDeleted: { $ne: true }, Status: PRODUCT_STATUS.ACTIVE }),
    Reservation.countDocuments({}),
    Reservation.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    aggregateDailyCount(User, {
      ...createdInRange,
      Role: { $ne: USER_ROLE.ADMIN },
    }),
    aggregateDailyCount(User, {
      ...createdInRange,
      Role: USER_ROLE.SELLER,
    }),
    aggregateDailyCount(ShopProfile, createdInRange),
    aggregateDailyCount(Product, {
      ...createdInRange,
      IsDeleted: { $ne: true },
    }),
    aggregateDailyCount(Reservation, createdInRange),
    Reservation.find({
      status: RESERVATION_STATUS.COMPLETED,
      $or: [
        { completedAt: { $gte: from, $lte: to } },
        { completedAt: null, UpdatedAt: { $gte: from, $lte: to } },
      ],
    })
      .select("shopId productId agreedPrice reservedPrice quantity completedAt UpdatedAt")
      .lean(),
    FavoriteProduct.aggregate([
      { $group: { _id: "$productId", likeCount: { $sum: 1 } } },
      { $sort: { likeCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "shopprofiles",
          localField: "product.ShopId",
          foreignField: "_id",
          as: "shop",
        },
      },
      { $unwind: { path: "$shop", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          productId: "$_id",
          name: { $ifNull: ["$product.ProductName", "Sản phẩm"] },
          thumbnail: { $ifNull: ["$product.Thumbnail", ""] },
          likeCount: 1,
          productLikeCount: { $ifNull: ["$product.LikeCount", 0] },
          shopId: "$shop._id",
          shopName: { $ifNull: ["$shop.shopName", "Gian hàng"] },
        },
      },
    ]),
    ShopProfile.find({ status: SHOP_STATUS.ACTIVE })
      .sort({ averageRating: -1, followersCount: -1, soldCount: -1, totalProducts: -1 })
      .limit(10)
      .select(
        "shopName averageRating followersCount totalProducts soldCount totalReviews DiaChiHeThong address isOpen userId"
      )
      .lean(),
    aggregateDailyCount(Follow, createdInRange),
    aggregateDailyCount(FavoriteProduct, createdInRange),
    SystemWallet.findOne({ key: "system" }).lean(),
    Reservation.aggregate([
      {
        $match: {
          depositPaidAt: { $ne: null },
          depositSettleTo: 0,
          depositAmount: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          amount: { $sum: "$depositAmount" },
          count: { $sum: 1 },
        },
      },
    ]),
    aggregatePackageSales(
      SellerSubscription,
      from,
      to,
      paidSellerSubscriptionMatch
    ),
    aggregatePackageSales(SellerBannerPlan, from, to),
    aggregatePackageSales(
      SellerSubscription,
      monthFrom,
      monthTo,
      paidSellerSubscriptionMatch
    ),
    aggregatePackageSales(SellerBannerPlan, monthFrom, monthTo),
    aggregatePackageBreakdown(
      SellerSubscription,
      monthFrom,
      monthTo,
      paidSellerSubscriptionMatch
    ),
    aggregatePackageBreakdown(SellerBannerPlan, monthFrom, monthTo),
    collectPeriodMetrics(from, to),
    collectPeriodMetrics(prevFrom, prevTo),
    SellerVerification.countDocuments({
      status: SELLER_VERIFICATION_STATUS.PENDING,
    }),
    Report.countDocuments({
      status: REPORT_STATUS.PENDING,
      reportType: { $in: CONTENT_REPORT_TYPES },
    }),
    Report.distinct("shopId", {
      status: REPORT_STATUS.PENDING,
      shopId: { $ne: null },
      reportType: { $in: CONTENT_REPORT_TYPES },
    }),
    SellerBannerPlan.countDocuments({
      status: SELLER_BANNER_STATUS.PENDING_REVIEW,
    }),
    WithdrawRequest.aggregate([
      { $match: { status: WITHDRAW_STATUS.PENDING } },
      { $group: { _id: null, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    aggregateDailyPackageRevenue(
      SellerSubscription,
      from,
      to,
      paidSellerSubscriptionMatch
    ),
    aggregateDailyPackageRevenue(SellerBannerPlan, from, to),
    Reservation.find(completedInWindowMatch(from, to))
      .select("agreedPrice reservedPrice quantity completedAt UpdatedAt")
      .lean(),
    aggregateDailyCountWithFallback(
      Reservation,
      completedInWindowMatch(from, to),
      "completedAt",
      "UpdatedAt"
    ),
    aggregateDailyCountWithFallback(
      Reservation,
      {
        status: { $in: CANCELLED_RESERVATION_STATUSES },
        $or: [
          { cancelledAt: { $gte: from, $lte: to } },
          { cancelledAt: null, UpdatedAt: { $gte: from, $lte: to } },
        ],
      },
      "cancelledAt",
      "UpdatedAt"
    ),
    aggregateDailyCount(
      Reservation,
      { disputedAt: { $gte: from, $lte: to } },
      "disputedAt"
    ),
    aggregateDailySum(
      Reservation,
      { depositPaidAt: { $gte: from, $lte: to }, depositAmount: { $gt: 0 } },
      "depositPaidAt",
      "depositAmount"
    ),
    aggregateDailySum(
      WalletTransaction,
      {
        type: WALLET_TX_TYPE.TOPUP,
        status: WALLET_TX_STATUS.SUCCESS,
        CreatedAt: { $gte: from, $lte: to },
      },
      "CreatedAt",
      "amount"
    ),
    aggregateDailySum(WithdrawRequest, createdInRange, "CreatedAt", "amount"),
    aggregateDailyCount(SellerVerification, createdInRange),
    aggregateDailyCount(Report, createdInRange),
    // Số shop bị báo cáo (không trùng) theo ngày.
    Report.aggregate([
      { $match: { ...createdInRange, shopId: { $ne: null } } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: "%Y-%m-%d", date: "$CreatedAt" } },
            shopId: "$shopId",
          },
        },
      },
      { $group: { _id: "$_id.day", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    aggregateDailyCount(SellerBannerPlan, createdInRange),
    aggregateDailySum(
      Reservation,
      {
        depositPaidAt: { $gte: from, $lte: to },
        depositSettleTo: 0,
        depositAmount: { $gt: 0 },
      },
      "depositPaidAt",
      "depositAmount"
    ),
  ]);

  const topShopOwnerIds = [
    ...new Set(topShops.map((shop) => String(shop.userId || "")).filter(Boolean)),
  ];
  const topShopOwners = topShopOwnerIds.length
    ? await User.find({ _id: { $in: topShopOwnerIds } }).select("Avatar FullName").lean()
    : [];
  const topShopOwnerById = new Map(topShopOwners.map((user) => [String(user._id), user]));

  const revenueByShopMap = new Map();
  let periodRevenue = 0;
  for (const reservation of completedReservations) {
    const amount = computeTotal(reservation);
    periodRevenue += amount;
    const shopKey = String(reservation.shopId || "");
    if (!shopKey) {
      continue;
    }
    const current = revenueByShopMap.get(shopKey) || { shopId: shopKey, revenue: 0, orders: 0 };
    current.revenue += amount;
    current.orders += 1;
    revenueByShopMap.set(shopKey, current);
  }

  const revenueShopIds = [...revenueByShopMap.keys()];
  const revenueShops = revenueShopIds.length
    ? await ShopProfile.find({ _id: { $in: revenueShopIds } })
        .select("shopName userId")
        .lean()
    : [];
  const revenueOwnerIds = [
    ...new Set(revenueShops.map((shop) => String(shop.userId || "")).filter(Boolean)),
  ];
  const revenueOwners = revenueOwnerIds.length
    ? await User.find({ _id: { $in: revenueOwnerIds } }).select("Avatar FullName").lean()
    : [];
  const revenueShopById = new Map(revenueShops.map((shop) => [String(shop._id), shop]));
  const revenueOwnerById = new Map(revenueOwners.map((user) => [String(user._id), user]));

  // Danh sách đầy đủ (frontend hiển thị top 10, nút "Xem tất cả" mở toàn bộ).
  const topSellingShops = [...revenueByShopMap.values()]
    .map((row) => {
      const shop = revenueShopById.get(row.shopId);
      const owner = shop ? revenueOwnerById.get(String(shop.userId || "")) : null;
      return {
        shopId: row.shopId,
        shopName: shop?.shopName || owner?.FullName || "Gian hàng",
        avatar: owner?.Avatar || "",
        revenue: row.revenue,
        orders: row.orders,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
  const revenueByShop = topSellingShops.slice(0, 10);

  // Sản phẩm bán chạy trong kỳ (theo số lượng bán từ đơn hoàn thành).
  const productSalesMap = new Map();
  for (const reservation of completedReservations) {
    const productKey = String(reservation.productId || "");
    if (!productKey) {
      continue;
    }
    const current = productSalesMap.get(productKey) || {
      productId: productKey,
      shopId: String(reservation.shopId || ""),
      revenue: 0,
      soldQuantity: 0,
      orders: 0,
    };
    current.revenue += computeTotal(reservation);
    current.soldQuantity += Number(reservation.quantity) || 0;
    current.orders += 1;
    productSalesMap.set(productKey, current);
  }
  const topProductRows = [...productSalesMap.values()].sort(
    (a, b) => b.soldQuantity - a.soldQuantity || b.revenue - a.revenue
  );
  const topProductIds = topProductRows.map((row) => row.productId);
  const [topProductDocs, topProductCovers] = topProductIds.length
    ? await Promise.all([
        Product.find({ _id: { $in: topProductIds } })
          .select("ProductName Thumbnail")
          .lean(),
        // Ảnh đại diện lấy từ ProductImage (Stt nhỏ nhất = cover).
        ProductImage.aggregate([
          {
            $match: {
              ProductId: {
                $in: topProductIds.map((id) => new mongoose.Types.ObjectId(id)),
              },
            },
          },
          { $sort: { Stt: 1, UploadedAt: 1 } },
          { $group: { _id: "$ProductId", url: { $first: "$ImageUrl" } } },
        ]),
      ])
    : [[], []];
  const topProductById = new Map(
    topProductDocs.map((product) => [String(product._id), product])
  );
  const coverByProductId = new Map(
    topProductCovers.map((row) => [String(row._id), row.url || ""])
  );
  const topSellingProducts = topProductRows.map((row) => {
    const product = topProductById.get(row.productId);
    const shop = revenueShopById.get(row.shopId);
    return {
      productId: row.productId,
      name: product?.ProductName || "Sản phẩm",
      thumbnail: coverByProductId.get(row.productId) || product?.Thumbnail || "",
      shopName: shop?.shopName || "",
      soldQuantity: row.soldQuantity,
      revenue: row.revenue,
      orders: row.orders,
    };
  });

  const statusLabel = {
    [RESERVATION_STATUS.PENDING_SELLER_CONFIRMATION]: "Chờ shop xác nhận",
    [RESERVATION_STATUS.REJECTED]: "Đã từ chối",
    [RESERVATION_STATUS.WAITING_PICKUP]: "Chờ nhận hàng",
    [RESERVATION_STATUS.COMPLETED]: "Hoàn thành",
    [RESERVATION_STATUS.DISPUTED]: "Tranh chấp",
    [RESERVATION_STATUS.AUTO_COMPLETED]: "Tự hoàn thành",
    [RESERVATION_STATUS.REFUNDED]: "Đã hủy",
    [RESERVATION_STATUS.DISPUTE_RESOLVED]: "Đã hủy",
  };

  const reservationStatusPie = [0, 1, 2, 3, 4, 5, 6, 7].map((status) => {
    const found = reservationsByStatus.find((row) => Number(row._id) === status);
    return {
      status,
      label: statusLabel[status] || `Trạng thái ${status}`,
      value: Number(found?.count) || 0,
    };
  });

  const rolePie = [
    { key: "buyers", label: "Người mua", value: totalBuyers },
    { key: "sellers", label: "Người bán", value: totalSellers },
    { key: "admins", label: "Admin", value: totalAdmins },
  ];

  const topShopsMapped = topShops.map((shop) => {
    const owner = topShopOwnerById.get(String(shop.userId || ""));
    return {
      shopId: String(shop._id),
      name: shop.shopName || owner?.FullName || "Gian hàng",
      logo: owner?.Avatar || "",
      rating: Number(shop.averageRating) || 0,
      followersCount: Number(shop.followersCount) || 0,
      totalProducts: Number(shop.totalProducts) || 0,
      soldCount: Number(shop.soldCount) || 0,
      totalReviews: Number(shop.totalReviews) || 0,
      address: shop.addressHeThong || shop.DiaChiHeThong || shop.address || "",
      isOpen: Number(shop.isOpen) === 1,
    };
  });

  const [activeUsers, blockedUsers] = await Promise.all([
    User.countDocuments({ Status: USER_STATUS.ACTIVE, Role: { $ne: USER_ROLE.ADMIN } }),
    User.countDocuments({ Status: USER_STATUS.BLOCKED }),
  ]);

  const newUsersInRange = usersInRange.reduce(
    (sum, row) => sum + (Number(row.count) || 0),
    0
  );
  const reservationsCountInRange = reservationsInRange.reduce(
    (sum, row) => sum + (Number(row.count) || 0),
    0
  );
  const escrowByReservations = unsettledDeposits[0] || {};

  // Chuỗi doanh thu theo ngày = gói seller + banner (tiền nền tảng thu).
  const sellerRevenueSeries = fillSeries(emptySeries, sellerPlanRevenueDaily);
  const bannerRevenueSeries = fillSeries(emptySeries, bannerPlanRevenueDaily);
  const orderRevenueByDay = new Map(emptySeries.map((item) => [item.date, 0]));
  for (const reservation of completedForRevenueSeries) {
    const key = toDateKey(reservation.completedAt || reservation.UpdatedAt);
    if (orderRevenueByDay.has(key)) {
      orderRevenueByDay.set(
        key,
        orderRevenueByDay.get(key) + computeTotal(reservation)
      );
    }
  }
  const revenueOverTime = emptySeries.map((item, index) => ({
    date: item.date,
    value:
      (sellerRevenueSeries[index]?.value || 0) +
      (bannerRevenueSeries[index]?.value || 0),
    orderValue: orderRevenueByDay.get(item.date) || 0,
  }));

  return {
    range,
    from,
    to,
    periodDays,
    previousPeriod: { from: prevFrom, to: prevTo, ...previousPeriod },
    metrics: currentPeriod,
    pending: {
      sellerVerifications: pendingSellerVerifications,
      reports: pendingReports,
      reportedShops: reportedShopIds.length,
      banners: pendingBanners,
      withdrawAmount: Number(pendingWithdrawRows[0]?.amount) || 0,
      withdrawCount: Number(pendingWithdrawRows[0]?.count) || 0,
    },
    cards: {
      totalUsers,
      totalBuyers,
      totalSellers,
      totalShops,
      totalActiveShops,
      totalProducts,
      totalActiveProducts,
      totalReservations,
      periodRevenue,
      activeUsers,
      blockedUsers,
      newUsersInRange,
      reservationsInRange: reservationsCountInRange,
      completedReservationsInRange: completedReservations.length,
      escrowBalance: Number(systemWallet?.balance) || 0,
      escrowReservationsAmount: Number(escrowByReservations.amount) || 0,
      escrowReservationsCount: Number(escrowByReservations.count) || 0,
      sellerPlansSoldInRange: sellerPlanSalesInRange.count,
      sellerPlanRevenueInRange: sellerPlanSalesInRange.revenue,
      bannerPlansSoldInRange: bannerPlanSalesInRange.count,
      bannerPlanRevenueInRange: bannerPlanSalesInRange.revenue,
      sellerPlansSoldThisMonth: sellerPlanSalesThisMonth.count,
      sellerPlanRevenueThisMonth: sellerPlanSalesThisMonth.revenue,
      bannerPlansSoldThisMonth: bannerPlanSalesThisMonth.count,
      bannerPlanRevenueThisMonth: bannerPlanSalesThisMonth.revenue,
    },
    charts: {
      usersOverTime: fillSeries(emptySeries, usersInRange),
      sellersOverTime: fillSeries(emptySeries, sellersInRange),
      shopsOverTime: fillSeries(emptySeries, shopsInRange),
      productsOverTime: fillSeries(emptySeries, productsInRange),
      reservationsOverTime: fillSeries(emptySeries, reservationsInRange),
      revenueOverTime,
      completedOverTime: fillSeries(emptySeries, completedDaily),
      cancelledOverTime: fillSeries(emptySeries, cancelledDaily),
      disputedOverTime: fillSeries(emptySeries, disputedDaily),
      depositOverTime: fillSeries(emptySeries, depositDaily),
      topupOverTime: fillSeries(emptySeries, topupDaily),
      withdrawOverTime: fillSeries(emptySeries, withdrawDaily),
      sellerVerificationsOverTime: fillSeries(emptySeries, sellerVerificationDaily),
      reportsOverTime: fillSeries(emptySeries, reportDaily),
      reportedShopsOverTime: fillSeries(emptySeries, reportedShopDaily),
      bannersOverTime: fillSeries(emptySeries, bannerDaily),
      escrowOverTime: fillSeries(emptySeries, escrowDaily),
      sellerPlanRevenueOverTime: sellerRevenueSeries,
      bannerPlanRevenueOverTime: bannerRevenueSeries,
      followsOverTime: fillSeries(emptySeries, followInRange),
      favoriteProductsOverTime: fillSeries(emptySeries, favoriteProductsInRange),
      reservationStatusPie,
      rolePie,
      revenueByShop,
    },
    rankings: {
      topFavoriteProducts: topFavoriteProducts.map((row) => ({
        productId: String(row.productId || ""),
        name: row.name || "Sản phẩm",
        thumbnail: row.thumbnail || "",
        likeCount: Number(row.likeCount) || 0,
        productLikeCount: Number(row.productLikeCount) || 0,
        shopId: row.shopId ? String(row.shopId) : "",
        shopName: row.shopName || "Gian hàng",
      })),
      topShops: topShopsMapped,
      topSellingShops,
      topSellingProducts,
      sellerPlansThisMonth: sellerPlanBreakdown.map((row) => ({
        planName: row._id || "Gói không tên",
        count: Number(row.count) || 0,
        revenue: Number(row.revenue) || 0,
      })),
      bannerPlansThisMonth: bannerPlanBreakdown.map((row) => ({
        planName: row._id || "Gói không tên",
        count: Number(row.count) || 0,
        revenue: Number(row.revenue) || 0,
      })),
    },
  };
}

module.exports = {
  getAdminDashboard,
};
