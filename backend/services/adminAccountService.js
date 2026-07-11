const mongoose = require("mongoose");
const User = require("../models/User");
const ShopProfile = require("../models/ShopProfile");
const SellerVerification = require("../models/SellerVerification");
const Product = require("../models/Product");
const Reservation = require("../models/Reservation");
const Report = require("../models/Report");
const Review = require("../models/Review");
const { USER_ROLE, SELLER_VERIFICATION_STATUS } = require("../constants/sellerVerification");
const { USER_STATUS } = require("../constants/userStatus");
const { SHOP_STATUS } = require("../constants/shopStatus");
const { PRODUCT_STATUS } = require("../constants/productStatus");

const ROLE_LABELS = {
  [USER_ROLE.BUYER]: "Người mua",
  [USER_ROLE.SELLER]: "Người bán",
  [USER_ROLE.ADMIN]: "Quản trị viên",
};

const STATUS_LABELS = {
  [USER_STATUS.ACTIVE]: "Hoạt động",
  [USER_STATUS.BLOCKED]: "Đã khóa",
};

const VERIFICATION_LABELS = {
  [SELLER_VERIFICATION_STATUS.PENDING]: "Chờ duyệt",
  [SELLER_VERIFICATION_STATUS.APPROVED]: "Đã duyệt",
  [SELLER_VERIFICATION_STATUS.REJECTED]: "Đã từ chối",
};

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

function activeProductFilter(extra = {}) {
  return {
    ...extra,
    $or: [
      { Status: PRODUCT_STATUS.ACTIVE },
      { Status: { $exists: false }, IsDeleted: { $ne: true } },
    ],
  };
}

function toAdminUserBase(user) {
  return {
    id: String(user._id),
    userId: String(user._id),
    avatar: user.Avatar || "",
    userName: user.UserName || "",
    fullName: user.FullName || "",
    email: user.Email || "",
    phone: user.Phone || "",
    role: user.Role,
    roleLabel: ROLE_LABELS[user.Role] || "Không rõ",
    status: user.Status,
    statusLabel: STATUS_LABELS[user.Status] || "Không rõ",
    bio: "",
    createdAt: user.CreatedAt || null,
    updatedAt: user.UpdatedAt || null,
    lastActiveAt: user.LanHoatDongCuoi || null,
    followersCount: user.FollowersCount || 0,
    followingCount: user.FollowingCount || 0,
    verifyAccount: Boolean(user.VerifyAccount),
    sellerPhoneVerified: Boolean(user.SellerPhoneVerified),
  };
}

function toAdminShopSummary(shop) {
  if (!shop) {
    return null;
  }

  return {
    id: String(shop._id),
    shopName: shop.shopName || "",
    shopUsername: shop.shopUsername || "",
    status: shop.status,
    statusLabel: shop.status === SHOP_STATUS.ACTIVE ? "Hoạt động" : "Đã khóa",
    averageRating: Number(shop.averageRating) || 0,
    totalProducts: Number(shop.totalProducts) || 0,
    totalReviews: Number(shop.totalReviews) || 0,
    totalLikes: Number(shop.totalLikes) || 0,
    soldCount: Number(shop.soldCount) || 0,
    address: shop.address || "",
    phone: shop.phone || "",
    openTime: shop.openTime || "",
    closeTime: shop.closeTime || "",
    description: shop.description || "",
  };
}

function toAdminVerificationSummary(verification) {
  if (!verification) {
    return null;
  }

  return {
    id: String(verification._id),
    status: verification.status,
    statusLabel: VERIFICATION_LABELS[verification.status] || "Không rõ",
    shopName: verification.shopName || "",
    shopUsername: verification.shopUsername || "",
    cccdFrontImage: verification.cccdFrontImage || "",
    cccdBackImage: verification.cccdBackImage || "",
    selfieImage: verification.selfieImage || "",
    address: verification.address || "",
    systemAddress: verification.DiaChiHeThong || "",
    submittedAt: verification.submittedAt || verification.CreatedAt || null,
    approvedAt: verification.approvedAt || null,
    rejectedAt: verification.rejectedAt || null,
    rejectionReason: verification.LyDoTuChoi || "",
  };
}

function toAdminAccountListItem(user, shop, verification) {
  const base = toAdminUserBase(user);
  const shopSummary = toAdminShopSummary(shop);
  const verificationSummary = toAdminVerificationSummary(verification);

  return {
    ...base,
    shop: shopSummary,
    verification: verificationSummary,
    productCount: shopSummary?.totalProducts || 0,
    averageRating: shopSummary?.averageRating || 0,
  };
}

function sortAccountItems(items, sortKey) {
  const sorted = [...items];

  switch (sortKey) {
    case "oldest":
      sorted.sort(
        (left, right) => new Date(left.createdAt || 0) - new Date(right.createdAt || 0)
      );
      break;
    case "last_active":
      sorted.sort((left, right) => {
        const rightTime = new Date(right.lastActiveAt || 0).getTime();
        const leftTime = new Date(left.lastActiveAt || 0).getTime();
        return rightTime - leftTime;
      });
      break;
    case "most_products":
      sorted.sort((left, right) => {
        const diff = (right.productCount || 0) - (left.productCount || 0);
        if (diff !== 0) {
          return diff;
        }
        return (left.fullName || "").localeCompare(right.fullName || "", "vi");
      });
      break;
    case "newest":
    default:
      sorted.sort(
        (left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0)
      );
      break;
  }

  return sorted;
}

async function buildUserMatchFilter({ search, role, status, verificationStatus }) {
  const andConditions = [];
  const normalizedRole = pickString(role);
  const normalizedStatus = pickString(status);
  const normalizedVerificationStatus = pickString(verificationStatus);
  const keyword = pickString(search);

  if (
    normalizedRole &&
    [USER_ROLE.BUYER, USER_ROLE.SELLER].includes(Number(normalizedRole))
  ) {
    andConditions.push({ Role: Number(normalizedRole) });
  } else {
    andConditions.push({ Role: { $in: [USER_ROLE.BUYER, USER_ROLE.SELLER] } });
  }

  if (normalizedStatus !== "") {
    andConditions.push({ Status: Number(normalizedStatus) });
  }

  if (keyword) {
    const escaped = escapeRegex(keyword);
    const shopMatches = await ShopProfile.find({
      $or: [
        { shopName: { $regex: escaped, $options: "i" } },
        { shopUsername: { $regex: escaped, $options: "i" } },
      ],
    })
      .select("userId")
      .lean();

    const shopUserIds = shopMatches.map((shop) => shop.userId).filter(Boolean);
    const searchOr = [
      { UserName: { $regex: escaped, $options: "i" } },
      { FullName: { $regex: escaped, $options: "i" } },
      { Email: { $regex: escaped, $options: "i" } },
      { Phone: { $regex: escaped, $options: "i" } },
    ];

    if (shopUserIds.length > 0) {
      searchOr.push({ _id: { $in: shopUserIds } });
    }

    andConditions.push({ $or: searchOr });
  }

  if (normalizedVerificationStatus !== "") {
    const verificationUserIds = await SellerVerification.find({
      status: Number(normalizedVerificationStatus),
    })
      .distinct("userId")
      .lean();

    andConditions.push({ _id: { $in: verificationUserIds } });
  }

  if (!andConditions.length) {
    return {};
  }

  if (andConditions.length === 1) {
    return andConditions[0];
  }

  return { $and: andConditions };
}

async function listAccounts({
  search = "",
  role = "",
  status = "",
  verificationStatus = "",
  sort = "newest",
  page = 1,
  limit = 20,
} = {}) {
  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (currentPage - 1) * pageSize;
  const match = await buildUserMatchFilter({ search, role, status, verificationStatus });

  const users = await User.find(match).lean();
  const userIds = users.map((user) => user._id);

  const [shops, verifications] = await Promise.all([
    ShopProfile.find({ userId: { $in: userIds } }).lean(),
    SellerVerification.find({ userId: { $in: userIds } })
      .sort({ submittedAt: -1, CreatedAt: -1 })
      .lean(),
  ]);

  const shopByUserId = new Map(shops.map((shop) => [String(shop.userId), shop]));
  const verificationByUserId = new Map();

  verifications.forEach((verification) => {
    const key = String(verification.userId);
    if (!verificationByUserId.has(key)) {
      verificationByUserId.set(key, verification);
    }
  });

  const items = sortAccountItems(
    users.map((user) =>
      toAdminAccountListItem(
        user,
        shopByUserId.get(String(user._id)),
        verificationByUserId.get(String(user._id))
      )
    ),
    sort
  );

  const total = items.length;
  const pagedItems = items.slice(skip, skip + pageSize);

  return {
    items: pagedItems,
    pagination: {
      page: currentPage,
      limit: pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

async function getAccountStats(user, shop) {
  const userId = user._id;
  const shopId = shop?._id;

  const [productCount, reservationCount, reportCount, reviewCount] = await Promise.all([
    shopId
      ? Product.countDocuments(activeProductFilter({ ShopId: shopId }))
      : Promise.resolve(0),
    shopId ? Reservation.countDocuments({ shopId }) : Promise.resolve(0),
    Report.countDocuments({ targetUserId: userId }),
    shopId ? Review.countDocuments({ store_id: String(shopId) }) : Promise.resolve(0),
  ]);

  return {
    totalProducts: productCount,
    totalReservations: reservationCount,
    totalReportsReceived: reportCount,
    totalReviews: reviewCount,
    totalFollowers: user.FollowersCount || 0,
  };
}

async function getRecentReports(targetUserId, limit = 5) {
  const reports = await Report.find({ targetUserId })
    .sort({ CreatedAt: -1 })
    .limit(limit)
    .lean();

  return reports.map((report) => ({
    id: String(report._id),
    title: report.title || "",
    content: report.content || "",
    reportType: report.reportType,
    status: report.status,
    createdAt: report.CreatedAt || null,
    processedAt: report.processedAt || null,
  }));
}

async function getAccountDetail(userId) {
  const user = await User.findById(userId).lean();
  if (!user) {
    throw createServiceError("Không tìm thấy tài khoản.", 404);
  }

  if (user.Role === USER_ROLE.ADMIN) {
    throw createServiceError("Không thể xem tài khoản quản trị trong mục quản lý người dùng.", 403);
  }

  const shop = await ShopProfile.findOne({ userId: user._id }).lean();
  const [verification, stats, recentReports] = await Promise.all([
    SellerVerification.findOne({ userId: user._id })
      .sort({ submittedAt: -1, CreatedAt: -1 })
      .lean(),
    getAccountStats(user, shop),
    getRecentReports(user._id),
  ]);

  return {
    user: toAdminUserBase(user),
    shop: toAdminShopSummary(shop),
    verification: toAdminVerificationSummary(verification),
    stats,
    recentReports,
  };
}

async function setAccountStatus(adminUser, targetUserId, nextStatus) {
  const session = await mongoose.startSession();

  try {
    let updatedDetail = null;

    await session.withTransaction(async () => {
      const targetUser = await User.findById(targetUserId).session(session);
      if (!targetUser) {
        throw createServiceError("Không tìm thấy tài khoản.", 404);
      }

      if (String(targetUser._id) === String(adminUser._id)) {
        throw createServiceError("Không thể khóa hoặc mở khóa chính tài khoản quản trị.", 403);
      }

      if (targetUser.Role === USER_ROLE.ADMIN) {
        throw createServiceError("Không thể khóa tài khoản quản trị.", 403);
      }

      if (targetUser.Status === nextStatus) {
        throw createServiceError(
          nextStatus === USER_STATUS.BLOCKED
            ? "Tài khoản đã bị khóa."
            : "Tài khoản đang hoạt động."
        );
      }

      const now = new Date();
      targetUser.Status = nextStatus;
      targetUser.UpdatedAt = now;
      await targetUser.save({ session });

      const shop = await ShopProfile.findOne({ userId: targetUser._id }).session(session);
      if (shop) {
        shop.status =
          nextStatus === USER_STATUS.ACTIVE ? SHOP_STATUS.ACTIVE : SHOP_STATUS.BLOCKED;
        shop.UpdatedAt = now;
        await shop.save({ session });
      }
    });

    updatedDetail = await getAccountDetail(targetUserId);
    return updatedDetail;
  } finally {
    session.endSession();
  }
}

async function blockAccount(adminUser, targetUserId) {
  return setAccountStatus(adminUser, targetUserId, USER_STATUS.BLOCKED);
}

async function unblockAccount(adminUser, targetUserId) {
  return setAccountStatus(adminUser, targetUserId, USER_STATUS.ACTIVE);
}

function assertUserIsActive(user) {
  if (!user) {
    return;
  }

  if (user.Status === USER_STATUS.BLOCKED) {
    throw createServiceError(
      "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.",
      403
    );
  }
}

module.exports = {
  listAccounts,
  getAccountDetail,
  blockAccount,
  unblockAccount,
  assertUserIsActive,
  ROLE_LABELS,
  STATUS_LABELS,
  VERIFICATION_LABELS,
};
