export const RESERVATION_STATUS = {
  PENDING_SELLER_CONFIRMATION: 0,
  REJECTED: 1,
  WAITING_PICKUP: 2,
  COMPLETED: 3,
  DISPUTED: 4,
  AUTO_COMPLETED: 5,
  REFUNDED: 6,
  DISPUTE_RESOLVED: 7,
};

export const RESERVATION_STATUS_LABELS = {
  [RESERVATION_STATUS.PENDING_SELLER_CONFIRMATION]: 'Chờ shop xác nhận',
  [RESERVATION_STATUS.REJECTED]: 'Đã từ chối',
  [RESERVATION_STATUS.WAITING_PICKUP]: 'Chờ nhận hàng',
  [RESERVATION_STATUS.COMPLETED]: 'Hoàn thành',
  [RESERVATION_STATUS.DISPUTED]: 'Tranh chấp',
  [RESERVATION_STATUS.AUTO_COMPLETED]: 'Tự hoàn thành',
  [RESERVATION_STATUS.REFUNDED]: 'Đã hủy',
  [RESERVATION_STATUS.DISPUTE_RESOLVED]: 'Đã hủy',
};

export const RESERVATION_TAB = {
  HOLDING: 'holding',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
};

export const RESERVATION_TAB_LABELS = {
  holding: 'Giữ hàng',
  cancelled: 'Đã hủy',
  completed: 'Hoàn thành',
};

export const RESERVATION_DISPUTE_REASON = {
  SELLER_ABSENT: 'seller_absent',
  SHOP_CLOSED: 'shop_closed',
  SELLER_NO_DELIVERY: 'seller_no_delivery',
  /** Legacy */
  SHOP_NO_DELIVERY: 'shop_no_delivery',
  SHOP_OUT_OF_STOCK: 'shop_out_of_stock',
  OTHER: 'other',
  BUYER_NO_SHOW: 'buyer_no_show',
};

export const RESERVATION_DISPUTE_REASON_LABELS = {
  [RESERVATION_DISPUTE_REASON.SELLER_ABSENT]: 'Người bán không có mặt',
  [RESERVATION_DISPUTE_REASON.SHOP_CLOSED]: 'Shop đóng cửa',
  [RESERVATION_DISPUTE_REASON.SELLER_NO_DELIVERY]: 'Người bán không giao hàng',
  [RESERVATION_DISPUTE_REASON.SHOP_NO_DELIVERY]: 'Người bán không giao hàng',
  [RESERVATION_DISPUTE_REASON.SHOP_OUT_OF_STOCK]: 'Shop hết hàng',
  [RESERVATION_DISPUTE_REASON.OTHER]: 'Khác',
  [RESERVATION_DISPUTE_REASON.BUYER_NO_SHOW]: 'Người mua không đến nhận hàng',
};

export const BUYER_DISPUTE_REASON_OPTIONS = [
  RESERVATION_DISPUTE_REASON.SELLER_ABSENT,
  RESERVATION_DISPUTE_REASON.SHOP_CLOSED,
  RESERVATION_DISPUTE_REASON.SELLER_NO_DELIVERY,
  RESERVATION_DISPUTE_REASON.OTHER,
];

export const DEPOSIT_SETTLE_TO = {
  NONE: 0,
  BUYER: 1,
  SELLER: 2,
};

const CANCELLED_RESERVATION_STATUSES = new Set([
  RESERVATION_STATUS.REJECTED,
  RESERVATION_STATUS.REFUNDED,
  RESERVATION_STATUS.DISPUTE_RESOLVED,
]);

export function isCancelledReservationStatus(status) {
  return CANCELLED_RESERVATION_STATUSES.has(Number(status));
}

/**
 * Lý do hiển thị trên item đơn đã hủy (buyer + seller).
 * Đơn từng tranh chấp: đọc depositSettleTo để biết cọc về ai (không dùng lý do admin).
 */
export function getCancelledReservationReason(item) {
  const status = Number(item?.status);
  if (!isCancelledReservationStatus(status)) {
    return '';
  }

  const settleTo = Number(item?.depositSettleTo);
  const hadDispute =
    Boolean(item?.disputeByBuyer) ||
    Boolean(item?.disputeBySeller) ||
    Boolean(item?.disputedAt) ||
    Boolean(item?.disputeReason) ||
    status === RESERVATION_STATUS.DISPUTE_RESOLVED;

  if (hadDispute) {
    if (settleTo === DEPOSIT_SETTLE_TO.BUYER) {
      return 'Có tranh chấp, đã hoàn tiền cho người mua';
    }
    if (settleTo === DEPOSIT_SETTLE_TO.SELLER) {
      return 'Có tranh chấp, đã giải ngân cọc';
    }
    // Fallback theo status nếu settle chưa rõ trên bản ghi cũ
    if (status === RESERVATION_STATUS.REFUNDED) {
      return 'Có tranh chấp, đã hoàn tiền cho người mua';
    }
    if (status === RESERVATION_STATUS.DISPUTE_RESOLVED) {
      return 'Có tranh chấp, đã giải ngân cọc';
    }
  }

  const cancelReason = String(item?.cancelReason || '').trim();
  if (cancelReason) {
    return cancelReason;
  }

  if (status === RESERVATION_STATUS.REJECTED) {
    return 'Shop từ chối hoặc quá giờ chưa xác nhận đơn.';
  }

  if (settleTo === DEPOSIT_SETTLE_TO.BUYER) {
    return 'Đã hoàn tiền cọc cho người mua';
  }
  if (settleTo === DEPOSIT_SETTLE_TO.SELLER) {
    return 'Đã giải ngân cọc cho người bán';
  }

  if (status === RESERVATION_STATUS.REFUNDED) {
    return 'Đã hoàn tiền cọc cho người mua';
  }
  if (status === RESERVATION_STATUS.DISPUTE_RESOLVED) {
    return 'Đã giải ngân cọc cho người bán';
  }

  return '';
}