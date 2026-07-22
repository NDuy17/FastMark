import { createBuyerReservationOnBackend } from '../../api/buyerOpsApi';
import { getWalletOnBackend } from '../../api/walletApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';

async function requireBuyerToken() {
  const idToken = await getCurrentUserIdToken();
  if (!idToken) {
    throw new Error('Vui lòng đăng nhập.');
  }
  return idToken;
}

export async function loadReservationWalletViewModel() {
  const idToken = await requireBuyerToken();
  const wallet = await getWalletOnBackend(idToken);
  return { balance: Number(wallet?.balance) || 0, wallet };
}

export async function createReservationViewModel({
  productId,
  variantId,
  quantity,
  pickupTime,
  note,
}) {
  const idToken = await requireBuyerToken();
  return createBuyerReservationOnBackend({
    idToken,
    productId,
    variantId,
    quantity,
    pickupTime,
    note,
  });
}
