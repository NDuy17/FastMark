import { apiRequest } from './client';

export function sendSystemNotification(token, { title, content, audience }) {
  return apiRequest('/api/admin/notifications/broadcast', {
    method: 'POST',
    token,
    body: { title, content, audience },
  });
}

export function getBroadcastHistory(token, { page = 1, limit = 20 } = {}) {
  return apiRequest(`/api/admin/notifications/history?page=${page}&limit=${limit}`, {
    token,
  });
}
