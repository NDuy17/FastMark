import { apiRequest } from './client';

export function listAccounts(token, params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  const path = query ? `/api/admin/accounts?${query}` : '/api/admin/accounts';
  return apiRequest(path, { token });
}

export function getAccountDetail(token, accountId) {
  return apiRequest(`/api/admin/accounts/${accountId}`, { token });
}

export function blockAccount(token, accountId) {
  return apiRequest(`/api/admin/accounts/${accountId}/block`, {
    method: 'POST',
    token,
    body: {},
  });
}

export function unblockAccount(token, accountId) {
  return apiRequest(`/api/admin/accounts/${accountId}/unblock`, {
    method: 'POST',
    token,
    body: {},
  });
}
