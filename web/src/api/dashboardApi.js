import { apiRequest } from './client';

/** Dashboard API chỉ cho phép khoảng tối đa 366 ngày — không gửi from/to khi "Tất cả thời gian". */
export function buildDashboardQuery(from, to) {
  if (from && to) {
    return { from, to };
  }
  return { range: '30days' };
}

export function isDashboardAllTime(from, to) {
  return !from && !to;
}

export function formatDashboardPeriodLabel(from, to, formatDateDisplay) {
  if (isDashboardAllTime(from, to)) {
    return 'Tất cả thời gian';
  }
  if (from === to) {
    return formatDateDisplay(from);
  }
  return `${formatDateDisplay(from)} → ${formatDateDisplay(to)}`;
}

export async function getAdminDashboard(token, params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const payload = await apiRequest(`/api/admin/dashboard${suffix}`, {
    method: 'GET',
    token,
  });
  return payload.data?.dashboard || null;
}
