import {
  createWalletTopupOnBackend,
  getWalletOnBackend,
  getWalletTransactionOnBackend,
  getWalletTransactionsOnBackend,
  syncWalletTopupOnBackend,
  cancelWalletTopupOnBackend,
} from '../../api/walletApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import {
  clearPendingTopupOrderCode,
  loadPendingTopupOrderCode,
  parseTopupResultUrl,
  savePendingTopupOrderCode,
} from './topupSession';

export async function loadWalletViewModel() {
  const idToken = await getCurrentUserIdToken();
  if (!idToken) {
    throw new Error('Vui lòng đăng nhập để xem ví.');
  }

  const [wallet, transactions] = await Promise.all([
    getWalletOnBackend(idToken),
    getWalletTransactionsOnBackend(idToken, { limit: 20 }),
  ]);

  return { wallet, transactions };
}

export async function loadWalletTransactionsViewModel({ limit = 50 } = {}) {
  const idToken = await getCurrentUserIdToken();
  if (!idToken) {
    throw new Error('Vui lòng đăng nhập để xem giao dịch.');
  }

  const transactions = await getWalletTransactionsOnBackend(idToken, { limit });
  return { transactions };
}

export async function loadWalletTransactionDetailViewModel(transactionId) {
  const idToken = await getCurrentUserIdToken();
  if (!idToken) {
    throw new Error('Vui lòng đăng nhập để xem chi tiết giao dịch.');
  }

  const transaction = await getWalletTransactionOnBackend(idToken, transactionId);
  return { transaction };
}

export async function createTopupViewModel(amount) {
  const idToken = await getCurrentUserIdToken();
  if (!idToken) {
    throw new Error('Vui lòng đăng nhập để nạp tiền.');
  }

  const result = await createWalletTopupOnBackend(idToken, amount);
  if (result.orderCode != null) {
    await savePendingTopupOrderCode(result.orderCode);
  }
  return result;
}

export async function syncTopupViewModel(orderCode) {
  const idToken = await getCurrentUserIdToken();
  if (!idToken) {
    throw new Error('Vui lòng đăng nhập.');
  }

  const synced = await syncWalletTopupOnBackend(idToken, orderCode);
  if (synced.transaction?.status === 1) {
    await clearPendingTopupOrderCode();
  }
  return synced;
}

export async function cancelTopupViewModel(orderCode) {
  const idToken = await getCurrentUserIdToken();
  if (!idToken) {
    throw new Error('Vui lòng đăng nhập.');
  }

  const result = await cancelWalletTopupOnBackend(idToken, orderCode);
  await clearPendingTopupOrderCode();
  return result;
}

/** Sync sau PayOS redirect / deep-link. Hủy thì đánh dấu CANCELLED trên backend. */
export async function resolveTopupReturnViewModel(urlOrResult) {
  const parsed =
    typeof urlOrResult === 'string' ? parseTopupResultUrl(urlOrResult) : urlOrResult;

  if (!parsed) {
    return null;
  }

  let orderCode = parsed.orderCode;
  if (orderCode == null) {
    orderCode = await loadPendingTopupOrderCode();
  }

  if (parsed.cancelled) {
    if (orderCode != null) {
      try {
        await cancelTopupViewModel(orderCode);
      } catch {
        await clearPendingTopupOrderCode();
      }
    } else {
      await clearPendingTopupOrderCode();
    }
    return { cancelled: true, transaction: null, wallet: null };
  }

  if (orderCode == null) {
    return { cancelled: false, pending: true, transaction: null, wallet: null };
  }

  const synced = await syncTopupViewModel(orderCode);
  return {
    cancelled: false,
    pending: false,
    transaction: synced.transaction,
    wallet: synced.wallet,
  };
}
