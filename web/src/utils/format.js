export function formatDate(value) {
  if (!value) {
    return '';
  }
  return new Date(value).toLocaleString('vi-VN');
}

/** yyyy-mm-dd → dd-mm-yyyy (dashboard date inputs). */
export function formatDateDisplay(value) {
  const [year, month, day] = String(value || '').split('-');
  return year && month && day ? `${day}-${month}-${year}` : value;
}

/** Hoạt động gần nhất — tách giờ và ngày cho bảng tài khoản. */
export function formatDateActivity(value) {
  if (!value) {
    return '';
  }
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    const time = date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const day = [
      String(date.getDate()).padStart(2, '0'),
      String(date.getMonth() + 1).padStart(2, '0'),
      date.getFullYear(),
    ].join('/');
    return { time, day };
  } catch {
    return '';
  }
}

export function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')} đ`;
}

export function formatPrice(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

/** 16:58:13 27/07/2026 — dùng header chi tiết đơn hàng. */
export function formatDateTimeDetail(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const time = date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const day = [
    String(date.getDate()).padStart(2, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    date.getFullYear(),
  ].join('/');
  return `${time} ${day}`;
}
