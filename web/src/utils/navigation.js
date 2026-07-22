/**
 * Quay lại trang trước trong app; nếu không có history thì về fallback.
 * Tránh hardcode `/accounts`, `/reservations`… khiến mất ngữ cảnh (vd: đơn → user → back lại list user).
 */
export function goBackOr(navigate, fallback = '/') {
  const idx = window.history.state?.idx;
  if (typeof idx === 'number' && idx > 0) {
    navigate(-1);
    return;
  }
  navigate(fallback);
}
