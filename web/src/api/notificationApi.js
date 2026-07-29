import { apiRequest } from './client';

export function sendSystemNotification(token, { title, content, audience }) {
  return apiRequest('/api/admin/notifications/broadcast', {
    method: 'POST',
    token,
    body: { title, content, audience },
  });
}

export function getBroadcastHistory(token, { page = 1, limit = 20, from, to } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return apiRequest(`/api/admin/notifications/history?${params}`, {
    token,
  });
}
