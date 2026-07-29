import { RESERVATION_STATUS } from '../../constants/sellerOrders';
import { formatPrice } from './productFormat';

export function getBuyerCancelConfirmMessage(reservation) {
  const depositAmount = Number(reservation?.depositAmount) || 0;
  const isWaitingPickup = Number(reservation?.status) === RESERVATION_STATUS.WAITING_PICKUP;

  if (isWaitingPickup && depositAmount > 0) {
    return (
      `Bạn có muốn hủy đơn này không?\n\n` +
      `Nếu hủy, bạn sẽ mất cọc ${formatPrice(depositAmount)} và không thể nhận hàng nữa.`
    );
  }

  if (depositAmount > 0) {
    return (
      `Bạn có muốn hủy đơn này không?\n\n` +
      `Tiền cọc ${formatPrice(depositAmount)} sẽ được hoàn về ví của bạn.`
    );
  }

  return 'Bạn có muốn hủy đơn này không?';
}
