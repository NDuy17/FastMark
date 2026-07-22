import {
  getSellerSubscriptionOnBackend,
  purchaseSellerSubscriptionOnBackend,
} from '../../api/sellerSubscriptionApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';

async function requireSellerToken() {
  const idToken = await getCurrentUserIdToken();
  if (!idToken) {
    throw new Error('Vui lòng đăng nhập.');
  }
  return idToken;
}

export async function loadSellerSubscriptionViewModel() {
  const idToken = await requireSellerToken();
  return getSellerSubscriptionOnBackend(idToken);
}

export async function purchaseSellerSubscriptionViewModel(planId) {
  const idToken = await requireSellerToken();
  return purchaseSellerSubscriptionOnBackend({ idToken, planId });
}
