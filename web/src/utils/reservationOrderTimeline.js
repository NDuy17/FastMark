import {
  RESERVATION_CANCEL_REASON,
  inferCancelReasonCode,
} from '../constants/reservationOrderFlow';

const R = RESERVATION_CANCEL_REASON;

const STEP_DEFS = {
  created: { key: 'created', label: 'Tạo đơn', tone: 'neutral' },
  pending_confirm: { key: 'pending_confirm', label: 'Chờ xác nhận', tone: 'orange' },
  confirmed: { key: 'confirmed', label: 'Xác nhận', tone: 'green' },
  holding: { key: 'holding', label: 'Giữ hàng', tone: 'green' },
  received: { key: 'received', label: 'Đã nhận hàng', tone: 'green' },
  completed: { key: 'completed', label: 'Hoàn thành', tone: 'green' },
  pickup_overdue: { key: 'pickup_overdue', label: 'Quá giờ nhận hàng', tone: 'orange' },
  dispute: { key: 'dispute', label: 'Tranh chấp', tone: 'purple' },
  cancelled: { key: 'cancelled', label: 'Đã hủy', tone: 'red' },
};

const TERMINAL_KEYS_BY_REASON = {
  [R.CONFIRM_TIMEOUT]: ['created', 'pending_confirm', 'cancelled'],
  [R.SELLER_REJECTED]: ['created', 'cancelled'],
  [R.BUYER_CANCEL_PENDING]: ['created', 'cancelled'],
  [R.BUYER_CANCEL_HOLDING]: ['created', 'confirmed', 'holding', 'cancelled'],
  [R.SELLER_CANCEL_HOLDING]: ['created', 'confirmed', 'holding', 'cancelled'],
  [R.SELLER_REFUND_AFTER_PICKUP]: ['created', 'confirmed', 'holding', 'pickup_overdue', 'cancelled'],
  [R.BUYER_RECEIVED]: ['created', 'confirmed', 'holding', 'received', 'completed'],
  [R.BUYER_REPORT_SELLER_ABSENT]: ['created', 'confirmed', 'holding', 'pickup_overdue', 'dispute', 'cancelled'],
  [R.SELLER_REPORT_BUYER_NO_SHOW]: ['created', 'confirmed', 'holding', 'pickup_overdue', 'dispute', 'cancelled'],
  [R.DISPUTE_BOTH_REPORTED]: ['created', 'confirmed', 'holding', 'pickup_overdue', 'dispute', 'cancelled'],
  [R.PICKUP_TIMEOUT]: ['created', 'confirmed', 'holding', 'pickup_overdue', 'cancelled'],
  [R.ADMIN_BUYER_WIN]: ['created', 'confirmed', 'holding', 'pickup_overdue', 'dispute', 'cancelled'],
  [R.ADMIN_SELLER_WIN]: ['created', 'confirmed', 'holding', 'pickup_overdue', 'dispute', 'cancelled'],
  [R.AUTO_BUYER_WIN]: ['created', 'confirmed', 'holding', 'pickup_overdue', 'dispute', 'cancelled'],
  [R.AUTO_SELLER_WIN]: ['created', 'confirmed', 'holding', 'pickup_overdue', 'dispute', 'cancelled'],
  [R.BUYER_FORFEIT]: ['created', 'confirmed', 'holding', 'pickup_overdue', 'cancelled'],
  [R.ADMIN_COMPLETED]: ['created', 'confirmed', 'holding', 'received', 'completed'],
  [R.SELLER_ACCOUNT_LOCKED]: ['created', 'confirmed', 'holding', 'cancelled'],
  [R.SELLER_SHOP_LOCKED]: ['created', 'confirmed', 'holding', 'cancelled'],
  [R.BUYER_ACCOUNT_LOCKED]: ['created', 'cancelled'],
};

const OUTCOME_REASON = {
  [R.CONFIRM_TIMEOUT]: 'Người bán không xác nhận giữ hàng trong thời gian quy định.',
  [R.SELLER_REJECTED]: 'Người bán từ chối yêu cầu giữ hàng.',
  [R.BUYER_CANCEL_PENDING]: 'Người mua hủy đơn trước khi người bán xác nhận.',
  [R.BUYER_CANCEL_HOLDING]: 'Người mua hủy đơn sau khi người bán đã xác nhận giữ hàng.',
  [R.SELLER_CANCEL_HOLDING]: 'Người bán chủ động hủy đơn sau khi đã xác nhận giữ hàng.',
  [R.SELLER_REFUND_AFTER_PICKUP]:
    'Quá giờ nhận hàng, người bán đã hoàn cọc cho người mua.',
  [R.BUYER_RECEIVED]: 'Người mua đã xác nhận nhận hàng thành công.',
  [R.BUYER_REPORT_SELLER_ABSENT]: 'Người mua báo cáo người bán không giao hàng đúng hẹn.',
  [R.SELLER_REPORT_BUYER_NO_SHOW]: 'Người bán báo cáo người mua không đến nhận hàng.',
  [R.DISPUTE_BOTH_REPORTED]: 'Cả người mua và người bán đều gửi báo cáo.',
  [R.PICKUP_TIMEOUT]: 'Quá thời gian nhận hàng và không có phản hồi từ hai bên.',
  [R.ADMIN_BUYER_WIN]: 'Admin xử lý tranh chấp theo hướng hoàn cọc cho người mua.',
  [R.ADMIN_SELLER_WIN]: 'Admin xử lý tranh chấp theo hướng chuyển cọc cho người bán.',
  [R.AUTO_BUYER_WIN]: 'Người bán không phản hồi báo cáo trong thời hạn quy định.',
  [R.AUTO_SELLER_WIN]: 'Người mua không phản hồi báo cáo trong thời hạn quy định.',
  [R.BUYER_FORFEIT]: 'Quá giờ nhận hàng, người mua đã đồng ý mất cọc.',
};

const DEPOSIT_SETTLE_TO = {
  NONE: 0,
  BUYER: 1,
  SELLER: 2,
};

function isPastPickup(reservation) {
  if (reservation?.isPastPickup) return true;
  if (!reservation?.pickupTime) return false;
  const pickup = new Date(reservation.pickupTime);
  return Number.isFinite(pickup.getTime()) && pickup.getTime() <= Date.now();
}

function resolveStepAt(reservation, stepKey) {
  switch (stepKey) {
    case 'created':
      return reservation.createdAt;
    case 'pending_confirm':
      return reservation.createdAt;
    case 'confirmed':
      return reservation.sellerConfirmedAt || reservation.confirmedAt;
    case 'holding':
      return reservation.depositPaidAt || reservation.sellerConfirmedAt || reservation.confirmedAt;
    case 'received':
      return reservation.completedAt;
    case 'completed':
      return reservation.completedAt;
    case 'pickup_overdue':
      return reservation.pickupTime;
    case 'dispute':
      return (
        reservation.disputedAt ||
        reservation.buyerDisputedAt ||
        reservation.sellerDisputedAt
      );
    case 'cancelled':
      return reservation.cancelledAt || reservation.updatedAt;
    default:
      return null;
  }
}

function resolveTimelineKeys(reservation, reasonCode) {
  const status = Number(reservation?.status);

  if (status === 0) {
    return ['created', 'pending_confirm'];
  }
  if (status === 2) {
    return ['created', 'confirmed', 'holding'];
  }
  if (status === 4) {
    const keys = ['created', 'confirmed', 'holding'];
    if (isPastPickup(reservation)) {
      keys.push('pickup_overdue');
    }
    keys.push('dispute');
    return keys;
  }

  return TERMINAL_KEYS_BY_REASON[reasonCode] || ['created', 'cancelled'];
}

function isTerminalStatus(status) {
  const code = Number(status);
  return code !== 0 && code !== 2 && code !== 4;
}

function buildSteps(reservation, reasonCode) {
  const status = Number(reservation?.status);
  const keys = resolveTimelineKeys(reservation, reasonCode);
  const isActive = status === 0 || status === 2 || status === 4;

  return keys.map((key, index) => {
    const def = STEP_DEFS[key];
    const isLast = index === keys.length - 1;
    return {
      ...def,
      at: resolveStepAt(reservation, key),
      state: isActive && isLast ? 'current' : 'done',
    };
  });
}

function resolveFinalStatusLabel(reservation) {
  const status = Number(reservation?.status);
  if (status === 3 || status === 5) return 'Hoàn thành';
  if (status === 4) return 'Tranh chấp';
  if (status === 0) return 'Chờ xác nhận';
  if (status === 2) return 'Giữ hàng';
  return 'Đã hủy';
}

function resolveActorLabel(reservation, reasonCode) {
  const cancelledBy = String(reservation?.cancelledBy || '').trim();
  const status = Number(reservation?.status);

  if (reasonCode === R.CONFIRM_TIMEOUT || reasonCode === R.PICKUP_TIMEOUT) {
    return 'Hệ thống';
  }
  if (cancelledBy === 'buyer') return 'Người mua';
  if (cancelledBy === 'seller' || cancelledBy === 'seller_reject' || cancelledBy === 'seller_after_accept') {
    return 'Người bán';
  }
  if (cancelledBy === 'admin') return 'Admin';
  if (cancelledBy === 'system') return 'Hệ thống';
  if (status === 4) {
    if (reservation.disputeByBuyer && reservation.disputeBySeller) return 'Người mua & Người bán';
    if (reservation.disputeByBuyer) return 'Người mua';
    if (reservation.disputeBySeller) return 'Người bán';
  }
  if (status === 3 || status === 5) return 'Người mua';
  return '—';
}

function resolveDepositResult(reservation, reasonCode) {
  const status = Number(reservation?.status);
  const settleTo = Number(reservation?.depositSettleTo);
  const label = String(reservation?.depositSettleToLabel || '').trim();

  if (
    status === 4 &&
    reasonCode === R.DISPUTE_BOTH_REPORTED
  ) {
    return {
      recipient: '—',
      text: 'Đang chờ Admin quyết định phân bổ tiền cọc.',
    };
  }

  if (settleTo === DEPOSIT_SETTLE_TO.BUYER) {
    return {
      recipient: 'Người mua',
      text: 'Tiền cọc đã được hoàn cho người mua.',
    };
  }
  if (settleTo === DEPOSIT_SETTLE_TO.SELLER) {
    return {
      recipient: 'Người bán',
      text: 'Tiền cọc đã được chuyển cho người bán.',
    };
  }
  if (settleTo === DEPOSIT_SETTLE_TO.NONE) {
    return {
      recipient: '—',
      text: label || 'Tiền cọc đang được giữ (escrow).',
    };
  }
  return {
    recipient: '—',
    text: label || 'Chưa xác định kết quả cọc.',
  };
}

function resolveOutcomeReason(reservation, reasonCode) {
  if (OUTCOME_REASON[reasonCode]) {
    return OUTCOME_REASON[reasonCode];
  }
  const human = String(reservation?.reasonLabelBuyer || '').trim();
  if (human && !/^[a-z0-9_]+$/i.test(human)) {
    return human;
  }
  const note = String(reservation?.cancelNote || '').trim();
  if (note) return note;
  return '—';
}

function resolveProcessedAt(reservation) {
  return (
    reservation.depositSettledAt ||
    reservation.cancelledAt ||
    reservation.completedAt ||
    reservation.updatedAt ||
    null
  );
}

function shouldShowSellerEvidence(reservation, reasonCode) {
  return (
    reasonCode === R.SELLER_CANCEL_HOLDING ||
    Boolean(reservation?.cancelledBySellerAfterAccept)
  );
}

export function buildReservationOrderTimeline(reservation) {
  if (!reservation) {
    return { steps: [], outcome: null };
  }

  const reasonCode = inferCancelReasonCode(reservation);
  const steps = buildSteps(reservation, reasonCode);
  const deposit = resolveDepositResult(reservation, reasonCode);
  const showSellerEvidence = shouldShowSellerEvidence(reservation, reasonCode);
  const showOutcome = isTerminalStatus(reservation.status);

  const outcome = showOutcome
    ? {
        statusLabel: resolveFinalStatusLabel(reservation),
        reason: resolveOutcomeReason(reservation, reasonCode),
        actor: resolveActorLabel(reservation, reasonCode),
        processedAt: resolveProcessedAt(reservation),
        depositAmount: Number(reservation.depositAmount) || 0,
        depositRecipient: deposit.recipient,
        depositResult: deposit.text,
        sellerCancelNote: showSellerEvidence ? String(reservation.cancelNote || '').trim() : '',
        sellerCancelImages: showSellerEvidence
          ? (Array.isArray(reservation.sellerCancelImages)
              ? reservation.sellerCancelImages.filter(Boolean)
              : [])
          : [],
      }
    : null;

  return { steps, outcome, reasonCode, showOutcome };
}
