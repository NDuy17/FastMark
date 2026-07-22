import {
  createWalletWithdrawOnBackend,
  listWalletBanksOnBackend,
  listWalletWithdrawsOnBackend,
} from '../../api/walletApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';

async function requireToken() {
  const idToken = await getCurrentUserIdToken();
  if (!idToken) {
    throw new Error('Vui lòng đăng nhập.');
  }
  return idToken;
}

export async function loadWithdrawBanksViewModel() {
  const idToken = await requireToken();
  return listWalletBanksOnBackend(idToken);
}

export async function loadMyWithdrawsViewModel() {
  const idToken = await requireToken();
  return listWalletWithdrawsOnBackend(idToken, { limit: 40 });
}

export async function createWithdrawViewModel(payload) {
  const idToken = await requireToken();
  return createWalletWithdrawOnBackend(idToken, payload);
}
