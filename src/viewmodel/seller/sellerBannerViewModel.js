import {
  getSellerBannerOnBackend,
  purchaseSellerBannerOnBackend,
  updateSellerBannerCreativeOnBackend,
} from '../../api/sellerSubscriptionApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';

async function requireSellerToken() {
  const idToken = await getCurrentUserIdToken();
  if (!idToken) {
    throw new Error('Vui lòng đăng nhập.');
  }
  return idToken;
}

export async function loadSellerBannerViewModel() {
  const idToken = await requireSellerToken();
  return getSellerBannerOnBackend(idToken);
}

export async function purchaseSellerBannerViewModel(planId) {
  const idToken = await requireSellerToken();
  return purchaseSellerBannerOnBackend({ idToken, planId });
}

export async function requestSellerBannerHangViewModel(payload) {
  const idToken = await requireSellerToken();
  return updateSellerBannerCreativeOnBackend({ idToken, ...payload });
}

/** @deprecated dùng requestSellerBannerHangViewModel */
export async function updateSellerBannerCreativeViewModel(payload) {
  return requestSellerBannerHangViewModel(payload);
}
