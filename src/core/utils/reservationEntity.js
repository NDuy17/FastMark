export function getReservationShopId(reservation) {
  return String(reservation?.shopId || reservation?.shop?.id || '').trim();
}

export function getReservationProductId(reservation) {
  return String(reservation?.product?.id || reservation?.productId || '').trim();
}

export function getReservationBuyerId(reservation) {
  return String(
    reservation?.buyer?.id || reservation?.buyerId || reservation?.userId || ''
  ).trim();
}
