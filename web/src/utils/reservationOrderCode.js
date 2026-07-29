/** Mã đơn hiển thị dạng FM + YYMMDD + 4 ký tự cuối id. */
export function formatReservationOrderCode(reservation) {
  const rawCode = String(reservation?.code || reservation?.orderCode || '').trim();
  if (rawCode && !rawCode.startsWith('ID:')) {
    return rawCode.replace(/^#/, '');
  }

  const id = String(reservation?.id || reservation?._id || '').trim();
  const createdAt = reservation?.createdAt ? new Date(reservation.createdAt) : null;
  const datePart =
    createdAt && !Number.isNaN(createdAt.getTime())
      ? [
          String(createdAt.getFullYear()).slice(-2),
          String(createdAt.getMonth() + 1).padStart(2, '0'),
          String(createdAt.getDate()).padStart(2, '0'),
        ].join('')
      : '000000';
  const compact = id.replace(/[^a-zA-Z0-9]/g, '');
  const seq = (compact.length >= 4 ? compact.slice(-4) : compact.padStart(4, '0')).toUpperCase();
  return `FM${datePart}${seq}`;
}
