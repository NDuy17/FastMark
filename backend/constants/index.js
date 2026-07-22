/** All backend domain constants in one place. */

// ── Roles & verification ─────────────────────────────────────────────
const SELLER_VERIFICATION_STATUS = {
  PENDING: 0,
  APPROVED: 1,
  REJECTED: 2,
};

const USER_ROLE = {
  BUYER: 1,
  SELLER: 2,
  ADMIN: 3,
};

const USER_STATUS = {
  BLOCKED: 0,
  ACTIVE: 1,
};

// ── Shop & product ───────────────────────────────────────────────────
const SHOP_STATUS = {
  BLOCKED: 0,
  ACTIVE: 1,
};

const SHOP_OPEN = {
  CLOSED: 0,
  OPEN: 1,
};

const PRODUCT_STATUS = {
  HIDDEN: 0,
  ACTIVE: 1,
};

// ── Reservations ─────────────────────────────────────────────────────
/**
 * Trạng thái đơn giữ hàng (escrow System Wallet).
 * Giữ nguyên mã số DB hiện có để không phá data / client cũ.
 *
 * Alias nghiệp vụ (cùng giá trị):
 * PENDING ≈ PENDING_SELLER_CONFIRMATION (0)
 * ACCEPTED / READY ≈ WAITING_PICKUP (2)
 * COMPLETED (3) | CANCELLED ≈ REJECTED (1) | DISPUTED (4)
 *
 * 0 PendingSellerConfirmation — chờ shop đồng ý
 * 1 Rejected — shop từ chối (đã hoàn cọc)
 * 2 WaitingPickup — đã đồng ý, chờ nhận hàng
 * 3 Completed — buyer xác nhận nhận hàng
 * 4 Disputed — có báo cáo sau giờ lấy
 * 5 AutoCompleted — hết hạn báo cáo, tự hoàn tất + release cọc
 * 6 Refunded — hoàn cọc (buyer hủy / admin buyer thắng)
 */
const RESERVATION_STATUS = {
  PENDING_SELLER_CONFIRMATION: 0,
  REJECTED: 1,
  WAITING_PICKUP: 2,
  COMPLETED: 3,
  DISPUTED: 4,
  AUTO_COMPLETED: 5,
  REFUNDED: 6,
  // Tranh chấp đã xử lý (đền cọc cho seller): đơn hủy, không phải bán thành công.
  DISPUTE_RESOLVED: 7,
  // Alias đọc spec / code mới (không đổi DB).
  PENDING: 0,
  ACCEPTED: 2,
  READY: 2,
  CANCELLED: 1,
};

const RESERVATION_STATUS_LABEL = {
  [RESERVATION_STATUS.PENDING_SELLER_CONFIRMATION]: "Chờ shop xác nhận",
  [RESERVATION_STATUS.REJECTED]: "Đã từ chối",
  [RESERVATION_STATUS.WAITING_PICKUP]: "Chờ nhận hàng",
  [RESERVATION_STATUS.COMPLETED]: "Hoàn thành",
  [RESERVATION_STATUS.DISPUTED]: "Tranh chấp",
  [RESERVATION_STATUS.AUTO_COMPLETED]: "Tự hoàn thành",
  [RESERVATION_STATUS.REFUNDED]: "Đã hủy",
  [RESERVATION_STATUS.DISPUTE_RESOLVED]: "Đã hủy",
};

/** Giờ sau pickupTime được báo cáo trước khi auto-release cọc cho seller. */
const RESERVATION_DISPUTE_WINDOW_HOURS = 24;

/** Số ảnh chứng cứ tối đa mỗi báo cáo giữ hàng. */
const MAX_RESERVATION_REPORT_IMAGES = 5;

const RESERVATION_DISPUTE_REASON = {
  /** Người bán không có mặt tại điểm nhận. */
  SELLER_ABSENT: "seller_absent",
  SHOP_CLOSED: "shop_closed",
  /** Người bán không giao / không bán hàng. */
  SELLER_NO_DELIVERY: "seller_no_delivery",
  /** Legacy alias — map về seller_no_delivery khi đọc. */
  SHOP_NO_DELIVERY: "shop_no_delivery",
  /** Legacy. */
  SHOP_OUT_OF_STOCK: "shop_out_of_stock",
  OTHER: "other",
  /** Seller báo buyer không đến. */
  BUYER_NO_SHOW: "buyer_no_show",
};

const RESERVATION_DISPUTE_REASON_LABEL = {
  [RESERVATION_DISPUTE_REASON.SELLER_ABSENT]: "Người bán không có mặt",
  [RESERVATION_DISPUTE_REASON.SHOP_CLOSED]: "Shop đóng cửa",
  [RESERVATION_DISPUTE_REASON.SELLER_NO_DELIVERY]: "Người bán không giao hàng",
  [RESERVATION_DISPUTE_REASON.SHOP_NO_DELIVERY]: "Người bán không giao hàng",
  [RESERVATION_DISPUTE_REASON.SHOP_OUT_OF_STOCK]: "Shop hết hàng",
  [RESERVATION_DISPUTE_REASON.OTHER]: "Khác",
  [RESERVATION_DISPUTE_REASON.BUYER_NO_SHOW]: "Người mua không đến nhận hàng",
};

/** Lý do buyer được chọn trên form báo cáo (không gồm legacy). */
const BUYER_DISPUTE_REASON_OPTIONS = [
  RESERVATION_DISPUTE_REASON.SELLER_ABSENT,
  RESERVATION_DISPUTE_REASON.SHOP_CLOSED,
  RESERVATION_DISPUTE_REASON.SELLER_NO_DELIVERY,
  RESERVATION_DISPUTE_REASON.OTHER,
];

function normalizeBuyerDisputeReason(reason) {
  const raw = String(reason || "").trim();
  if (raw === RESERVATION_DISPUTE_REASON.SHOP_NO_DELIVERY) {
    return RESERVATION_DISPUTE_REASON.SELLER_NO_DELIVERY;
  }
  if (BUYER_DISPUTE_REASON_OPTIONS.includes(raw)) {
    return raw;
  }
  return "";
}

const RESERVATION_AUDIT_ACTION = {
  ADMIN_REFUND_BUYER: "ADMIN_REFUND_BUYER",
  ADMIN_RELEASE_SELLER: "ADMIN_RELEASE_SELLER",
};

// ── Messaging ────────────────────────────────────────────────────────
const MESSAGE_TYPE = {
  TEXT: 0,
  IMAGE: 1,
  OFFER: 2,
};

const MESSAGE_STATUS = {
  SENT: 0,
  DELIVERED: 1,
  SEEN: 2,
};

const MESSAGE_READ = {
  UNREAD: 0,
  READ: 1,
};

const SENDER_TYPE = {
  USER: 0,
  SHOP: 1,
};

// ── Reports ──────────────────────────────────────────────────────────
/**
 * Loại báo cáo.
 * 1–4: báo cáo nội dung (giữ nguyên).
 * 5–7: báo cáo giữ hàng / tranh chấp.
 * 8: lỗi hệ thống (tố cáo từ tài khoản).
 * 9: khác (tố cáo chung / giữ hàng “khác”).
 */
const REPORT_TYPE = {
  REVIEW: 1,
  USER: 2,
  SHOP: 3,
  PRODUCT: 4,
  /** Seller báo buyer không đến nhận hàng. */
  BUYER_NO_SHOW: 5,
  /** Buyer báo seller không bán / không mở cửa. */
  SELLER_NO_SHOW: 6,
  /** Sự cố sản phẩm liên quan đơn giữ hàng. */
  PRODUCT_ISSUE: 7,
  /** Báo cáo lỗi hệ thống / app. */
  SYSTEM: 8,
  /** Khác (tố cáo chung hoặc giữ hàng). */
  OTHER: 9,
};

const REPORT_TYPE_LABELS = {
  [REPORT_TYPE.REVIEW]: "Đánh giá",
  [REPORT_TYPE.USER]: "Người dùng",
  [REPORT_TYPE.SHOP]: "Gian hàng",
  [REPORT_TYPE.PRODUCT]: "Sản phẩm",
  [REPORT_TYPE.BUYER_NO_SHOW]: "Buyer không đến nhận",
  [REPORT_TYPE.SELLER_NO_SHOW]: "Seller không bán / không mở cửa",
  [REPORT_TYPE.PRODUCT_ISSUE]: "Sự cố sản phẩm (giữ hàng)",
  [REPORT_TYPE.SYSTEM]: "Hệ thống lỗi",
  [REPORT_TYPE.OTHER]: "Khác",
};

/** Các loại report gắn Reservation (tranh chấp cọc). */
const RESERVATION_REPORT_TYPES = [
  REPORT_TYPE.BUYER_NO_SHOW,
  REPORT_TYPE.SELLER_NO_SHOW,
  REPORT_TYPE.PRODUCT_ISSUE,
  REPORT_TYPE.OTHER,
];

/** Báo cáo nội dung (admin tab Báo cáo) — không gồm tranh chấp đơn. */
const CONTENT_REPORT_TYPES = [
  REPORT_TYPE.REVIEW,
  REPORT_TYPE.USER,
  REPORT_TYPE.SHOP,
  REPORT_TYPE.PRODUCT,
  REPORT_TYPE.SYSTEM,
  REPORT_TYPE.OTHER,
];

/** Loại tố cáo từ màn Tài khoản (combobox). */
const ACCOUNT_REPORT_TYPES = [
  REPORT_TYPE.USER,
  REPORT_TYPE.SHOP,
  REPORT_TYPE.SYSTEM,
  REPORT_TYPE.OTHER,
];

const MAX_ACCOUNT_REPORT_IMAGES = 5;

const REPORT_STATUS = {
  PENDING: 0,
  PROCESSED: 1,
  /** Alias nghiệp vụ = PROCESSED. */
  APPROVED: 1,
  REJECTED: 2,
};

const REPORT_STATUS_LABELS = {
  [REPORT_STATUS.PENDING]: "Chờ xử lý",
  [REPORT_STATUS.PROCESSED]: "Đã xử lý",
  [REPORT_STATUS.REJECTED]: "Đã bác bỏ",
};

/** Vai trò người gửi báo cáo tranh chấp giữ hàng. */
const REPORT_REPORTER_ROLE = {
  BUYER: 1,
  SELLER: 2,
};

const REPORT_REPORTER_ROLE_LABELS = {
  [REPORT_REPORTER_ROLE.BUYER]: "Người mua",
  [REPORT_REPORTER_ROLE.SELLER]: "Người bán",
};

// ── Notifications ────────────────────────────────────────────────────
const NOTIFICATION_AUDIENCE = {
  BUYER: "buyer",
  SELLER: "seller",
  /** Hiện ở cả chế độ buyer và seller (thông báo hệ thống/tài khoản). */
  SYSTEM: "system",
};

function normalizeNotificationAudience(value, fallback = NOTIFICATION_AUDIENCE.SYSTEM) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (Object.values(NOTIFICATION_AUDIENCE).includes(raw)) {
    return raw;
  }
  return fallback;
}

// ── Banner (SellerBannerPlan creative) ───────────────────────────────
const BANNER_TARGET_TYPE = {
  PRODUCT: 1,
  SHOP: 2,
};

const BANNER_TARGET_TYPE_LABEL = {
  [BANNER_TARGET_TYPE.PRODUCT]: "Sản phẩm",
  [BANNER_TARGET_TYPE.SHOP]: "Gian hàng",
};

/**
 * Luồng: mua gói (PURCHASED) → gửi yêu cầu treo (PENDING_REVIEW)
 * → admin duyệt (ACTIVE, set start/end) hoặc từ chối + hoàn tiền (REJECTED).
 */
const SELLER_BANNER_STATUS = {
  PURCHASED: 0,
  ACTIVE: 1,
  CANCELLED: 2,
  REJECTED: 3,
  PENDING_REVIEW: 4,
};

const SELLER_BANNER_STATUS_LABEL = {
  [SELLER_BANNER_STATUS.PURCHASED]: "Chưa yêu cầu treo",
  [SELLER_BANNER_STATUS.PENDING_REVIEW]: "Chờ duyệt treo",
  [SELLER_BANNER_STATUS.ACTIVE]: "Đang treo",
  [SELLER_BANNER_STATUS.CANCELLED]: "Đã hủy / gỡ",
  [SELLER_BANNER_STATUS.REJECTED]: "Bị từ chối — có thể sửa gửi lại",
};

// ── Wallet ───────────────────────────────────────────────────────────
const WALLET_TX_TYPE = {
  TOPUP: 1,
  PAYMENT: 2,
  REFUND: 3,
  WITHDRAWAL: 4,
  // Buyer → System Wallet (đặt cọc giữ hàng).
  DEPOSIT_HOLD: 5,
  // System → Buyer (hoàn cọc).
  DEPOSIT_REFUND: 6,
  // System → Seller (giải phóng cọc).
  DEPOSIT_RELEASE: 7,
};

/** Kết thúc cọc trên Reservation: 0 chưa settle, 1 hoàn buyer, 2 giải ngân seller. */
const DEPOSIT_SETTLE_TO = {
  NONE: 0,
  BUYER: 1,
  SELLER: 2,
};

const DEPOSIT_SETTLE_TO_LABEL = {
  [DEPOSIT_SETTLE_TO.NONE]: "Đang giữ (escrow)",
  [DEPOSIT_SETTLE_TO.BUYER]: "Hoàn cho người mua",
  [DEPOSIT_SETTLE_TO.SELLER]: "Giải ngân cho người bán",
};

const WALLET_TX_STATUS = {
  PENDING: 0,
  SUCCESS: 1,
  FAILED: 2,
  CANCELLED: 3,
};

const WALLET_TX_STATUS_LABEL = {
  [WALLET_TX_STATUS.PENDING]: "Đang chờ",
  [WALLET_TX_STATUS.SUCCESS]: "Thành công",
  [WALLET_TX_STATUS.FAILED]: "Thất bại",
  [WALLET_TX_STATUS.CANCELLED]: "Đã hủy",
};

const WALLET_TX_TYPE_LABEL = {
  [WALLET_TX_TYPE.TOPUP]: "Nạp tiền",
  [WALLET_TX_TYPE.PAYMENT]: "Thanh toán",
  [WALLET_TX_TYPE.REFUND]: "Hoàn tiền",
  [WALLET_TX_TYPE.WITHDRAWAL]: "Rút tiền",
  [WALLET_TX_TYPE.DEPOSIT_HOLD]: "Đặt cọc giữ hàng",
  [WALLET_TX_TYPE.DEPOSIT_REFUND]: "Hoàn cọc giữ hàng",
  [WALLET_TX_TYPE.DEPOSIT_RELEASE]: "Giải phóng cọc cho shop",
};

/** Loại tham chiếu giao dịch ví (WalletTransaction.referenceType). */
const WALLET_REFERENCE_TYPE = {
  RESERVATION: "Reservation",
  REPORT: "Report",
  WITHDRAW: "WithdrawRequest",
  TOPUP: "Topup",
};

const MIN_TOPUP_AMOUNT = 10000;
const MAX_TOPUP_AMOUNT = 20000000;
const MIN_WITHDRAW_AMOUNT = 50000;
const MAX_WITHDRAW_AMOUNT = 20000000;

const WITHDRAW_STATUS = {
  PENDING: 0,
  APPROVED: 1,
  REJECTED: 2,
};

const WITHDRAW_STATUS_LABEL = {
  [WITHDRAW_STATUS.PENDING]: "Chờ duyệt",
  [WITHDRAW_STATUS.APPROVED]: "Đã duyệt",
  [WITHDRAW_STATUS.REJECTED]: "Từ chối",
};

// ── Seller subscription plans ────────────────────────────────────────
const SELLER_SUBSCRIPTION_STATUS = {
  PENDING_PAYMENT: 0,
  ACTIVE: 1,
  EXPIRED: 2,
  CANCELLED: 3,
};

const SELLER_SUBSCRIPTION_STATUS_LABEL = {
  [SELLER_SUBSCRIPTION_STATUS.PENDING_PAYMENT]: "Chờ thanh toán",
  [SELLER_SUBSCRIPTION_STATUS.ACTIVE]: "Đang hiệu lực",
  [SELLER_SUBSCRIPTION_STATUS.EXPIRED]: "Hết hạn",
  [SELLER_SUBSCRIPTION_STATUS.CANCELLED]: "Đã hủy",
};

function getShopExpiry(shop) {
  return null;
}

/**
 * Shop có gói còn hiệu lực — dựa ShopProfile.isActive (cache từ SellerSubscription).
 */
function isSubscriptionActive(shop) {
  if (!shop) {
    return false;
  }
  return shop.isActive === true;
}

/** Mongo filter: shop public khi isActive. */
function activeSubscriptionFilter() {
  return { isActive: true };
}

module.exports = {
  SELLER_VERIFICATION_STATUS,
  USER_ROLE,
  USER_STATUS,
  SHOP_STATUS,
  SHOP_OPEN,
  PRODUCT_STATUS,
  RESERVATION_STATUS,
  RESERVATION_STATUS_LABEL,
  RESERVATION_DISPUTE_WINDOW_HOURS,
  MAX_RESERVATION_REPORT_IMAGES,
  RESERVATION_DISPUTE_REASON,
  RESERVATION_DISPUTE_REASON_LABEL,
  BUYER_DISPUTE_REASON_OPTIONS,
  normalizeBuyerDisputeReason,
  RESERVATION_AUDIT_ACTION,
  MESSAGE_TYPE,
  MESSAGE_STATUS,
  MESSAGE_READ,
  SENDER_TYPE,
  REPORT_TYPE,
  REPORT_TYPE_LABELS,
  RESERVATION_REPORT_TYPES,
  CONTENT_REPORT_TYPES,
  ACCOUNT_REPORT_TYPES,
  MAX_ACCOUNT_REPORT_IMAGES,
  REPORT_STATUS,
  REPORT_STATUS_LABELS,
  REPORT_REPORTER_ROLE,
  REPORT_REPORTER_ROLE_LABELS,
  NOTIFICATION_AUDIENCE,
  normalizeNotificationAudience,
  BANNER_TARGET_TYPE,
  BANNER_TARGET_TYPE_LABEL,
  SELLER_BANNER_STATUS,
  SELLER_BANNER_STATUS_LABEL,
  WALLET_TX_TYPE,
  WALLET_TX_STATUS,
  WALLET_TX_STATUS_LABEL,
  WALLET_TX_TYPE_LABEL,
  WALLET_REFERENCE_TYPE,
  DEPOSIT_SETTLE_TO,
  DEPOSIT_SETTLE_TO_LABEL,
  MIN_TOPUP_AMOUNT,
  MAX_TOPUP_AMOUNT,
  MIN_WITHDRAW_AMOUNT,
  MAX_WITHDRAW_AMOUNT,
  WITHDRAW_STATUS,
  WITHDRAW_STATUS_LABEL,
  SELLER_SUBSCRIPTION_STATUS,
  SELLER_SUBSCRIPTION_STATUS_LABEL,
  getShopExpiry,
  isSubscriptionActive,
  activeSubscriptionFilter,
};
