import { apiRequest, AUTH_TIMEOUT_MS, SELLER_UPLOAD_TIMEOUT_MS } from './client';
import { API_ENDPOINTS } from './endpoints';

async function parseApiResponse(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success === false) {
    const error = new Error(payload.message || 'Yêu cầu API thất bại.');
    error.statusCode = response.status;
    throw error;
  }

  return payload;
}

export async function getSellerSubscriptionOnBackend(idToken) {
  const response = await apiRequest(
    API_ENDPOINTS.sellerSubscription,
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data;
}

export async function purchaseSellerSubscriptionOnBackend({ idToken, planId, planMonths }) {
  const response = await apiRequest(
    API_ENDPOINTS.sellerSubscriptionPurchase,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ planId, planMonths }),
    },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data;
}

export async function getSellerBannerOnBackend(idToken) {
  const response = await apiRequest(
    API_ENDPOINTS.sellerBanner,
    { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data;
}

export async function purchaseSellerBannerOnBackend({ idToken, planId }) {
  const response = await apiRequest(
    API_ENDPOINTS.sellerBannerPurchase,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ planId }),
    },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data;
}

export async function updateSellerBannerCreativeOnBackend({
  idToken,
  bannerId,
  image,
  imageUrl,
  targetType,
  targetId,
}) {
  const response = await apiRequest(
    API_ENDPOINTS.sellerBannerCreative,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bannerId,
        image,
        imageUrl,
        targetType,
        targetId,
      }),
    },
    SELLER_UPLOAD_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.banner;
}
