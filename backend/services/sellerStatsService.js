const Reservation = require("../models/Reservation");
const Product = require("../models/Product");
const User = require("../models/User");
const { RESERVATION_STATUS } = require("../constants");
const { PRODUCT_STATUS } = require("../constants");
const { getShopForSeller } = require("./shopSettingsService");
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

function startOfMonth(date) {
  const value = new Date(date);
  value.setDate(1);
  value.setHours(0, 0, 0, 0);
  return value;
}

function resolveStatsDateRange(query = {}) {
  const now = new Date();
  const range = String(query.range || query.period || "7d").toLowerCase();
  let from = null;
  let to = endOfDay(now);

  if (query.from || query.startDate) {
    from = startOfDay(new Date(query.from || query.startDate));
  }
  if (query.to || query.endDate) {
    to = endOfDay(new Date(query.to || query.endDate));
  }

  if (!from) {
    if (range === "1d" || range === "day" || range === "today") {
      from = startOfDay(now);
    } else if (range === "2d") {
      from = startOfDay(addDays(now, -1));
    } else if (range === "7d" || range === "week") {
      from = startOfDay(addDays(now, -6));
    } else if (range === "30d" || range === "1m" || range === "month") {
      from = startOfDay(addDays(now, -29));
    } else if (range === "custom") {
      throw createServiceError("Khoảng thời gian tùy chọn cần from và to.", 400);
    } else {
      from = startOfDay(addDays(now, -6));
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
    range: query.from || query.to || query.startDate || query.endDate ? "custom" : range,
    from,
    to,
  };
}

async function getSellerStats(user, query = {}) {
  const shop = await getShopForSeller(user);
  const freshUser = await User.findById(user._id);
  const now = new Date();
  const dayStart = startOfDay(now);
  const monthStart = startOfMonth(now);
  const { range, from, to } = resolveStatsDateRange(query);

  const completedReservations = await Reservation.find({
    shopId: shop._id,
    status: {
      $in: [RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.AUTO_COMPLETED],
    },
  });

  let dailyRevenue = 0;
  let monthlyRevenue = 0;
  let totalRevenue = 0;
  let periodRevenue = 0;
  let periodSoldCount = 0;

  for (const reservation of completedReservations) {
    const amount = computeTotal(reservation);
    const qty = Number(reservation.quantity) || 0;
    totalRevenue += amount;
    const completedAt = reservation.completedAt || reservation.UpdatedAt;
    if (completedAt && completedAt >= dayStart) {
      dailyRevenue += amount;
    }
    if (completedAt && completedAt >= monthStart) {
      monthlyRevenue += amount;
    }
    if (completedAt && completedAt >= from && completedAt <= to) {
      periodRevenue += amount;
      periodSoldCount += qty;
    }
  }

  const createdInRange = {
    shopId: shop._id,
    CreatedAt: { $gte: from, $lte: to },
  };

  const [
    pendingCount,
    confirmedCount,
    cancelledCount,
    completedCount,
    periodPending,
    periodConfirmed,
    periodCancelled,
    periodCompleted,
    productLikeAgg,
  ] = await Promise.all([
    Reservation.countDocuments({
      shopId: shop._id,
      status: RESERVATION_STATUS.PENDING_SELLER_CONFIRMATION,
    }),
    Reservation.countDocuments({
      shopId: shop._id,
      status: RESERVATION_STATUS.WAITING_PICKUP,
    }),
    Reservation.countDocuments({
      shopId: shop._id,
      status: { $in: [RESERVATION_STATUS.REJECTED, RESERVATION_STATUS.REFUNDED] },
    }),
    Reservation.countDocuments({
      shopId: shop._id,
      status: { $in: [RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.AUTO_COMPLETED] },
    }),
    Reservation.countDocuments({
      ...createdInRange,
      status: RESERVATION_STATUS.PENDING_SELLER_CONFIRMATION,
    }),
    Reservation.countDocuments({
      ...createdInRange,
      status: RESERVATION_STATUS.WAITING_PICKUP,
    }),
    Reservation.countDocuments({
      ...createdInRange,
      status: { $in: [RESERVATION_STATUS.REJECTED, RESERVATION_STATUS.REFUNDED] },
    }),
    Reservation.countDocuments({
      ...createdInRange,
      status: { $in: [RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.AUTO_COMPLETED] },
    }),
    Product.aggregate([
      {
        $match: {
          ShopId: shop._id,
          IsDeleted: { $ne: true },
          Status: PRODUCT_STATUS.ACTIVE,
        },
      },
      { $group: { _id: null, total: { $sum: { $ifNull: ["$LikeCount", 0] } } } },
    ]),
  ]);

  return {
    range,
    from: from.toISOString(),
    to: to.toISOString(),
    periodRevenue,
    periodSoldCount,
    dailyRevenue,
    monthlyRevenue,
    totalRevenue,
    reservations: {
      pending: pendingCount,
      confirmed: confirmedCount,
      cancelled: cancelledCount,
      completed: completedCount,
      total: pendingCount + confirmedCount + cancelledCount + completedCount,
    },
    periodReservations: {
      pending: periodPending,
      confirmed: periodConfirmed,
      cancelled: periodCancelled,
      completed: periodCompleted,
      total: periodPending + periodConfirmed + periodCancelled + periodCompleted,
    },
    followersCount: Number(shop.followersCount) || 0,
    followingCount: freshUser?.FollowingCount || 0,
    productLikes: Number(productLikeAgg?.[0]?.total) || 0,
    totalProducts: shop.totalProducts || 0,
    soldCount: shop.soldCount || 0,
    averageRating: shop.averageRating || 0,
    totalReviews: shop.totalReviews || 0,
  };
}

module.exports = {
  getSellerStats,
  resolveStatsDateRange,
};
