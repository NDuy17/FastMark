import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';

const PENDING_ORDER_KEY = '@fastmark/pending_topup_order';
const RETURN_URL = 'fastmark://wallet/topup-result';
const CANCEL_URL = 'fastmark://wallet/topup-result?status=cancel';

const listeners = new Set();

export function getPayosReturnUrl() {
  return RETURN_URL;
}

export function getPayosCancelUrl() {
  return CANCEL_URL;
}

export async function savePendingTopupOrderCode(orderCode) {
  if (orderCode == null || orderCode === '') {
    return;
  }
  await AsyncStorage.setItem(PENDING_ORDER_KEY, String(orderCode));
}

export async function loadPendingTopupOrderCode() {
  const value = await AsyncStorage.getItem(PENDING_ORDER_KEY);
  if (!value) {
    return null;
  }
  const asNumber = Number(value);
  return Number.isFinite(asNumber) ? asNumber : value;
}

export async function clearPendingTopupOrderCode() {
  await AsyncStorage.removeItem(PENDING_ORDER_KEY);
}

function parseQueryParams(url) {
  const queryIndex = url.indexOf('?');
  if (queryIndex < 0) {
    return {};
  }
  const query = url.slice(queryIndex + 1);
  const params = {};
  query.split('&').forEach((part) => {
    if (!part) return;
    const [rawKey, rawValue = ''] = part.split('=');
    const key = decodeURIComponent(rawKey || '').trim();
    if (!key) return;
    params[key] = decodeURIComponent(rawValue.replace(/\+/g, ' '));
  });
  return params;
}

export function parseTopupResultUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }
  if (!url.includes('wallet/topup-result')) {
    return null;
  }

  const query = parseQueryParams(url);
  const status = String(query.status || '').toLowerCase();
  const orderCodeRaw = query.orderCode ?? query.order_code ?? null;
  const orderCode =
    orderCodeRaw != null && String(orderCodeRaw).trim() !== ''
      ? Number(orderCodeRaw) || String(orderCodeRaw)
      : null;

  return {
    url,
    status: status || (url.includes('cancel') ? 'cancel' : 'success'),
    orderCode,
    cancelled: status === 'cancel' || status === 'cancelled',
  };
}

export function subscribeTopupDeepLink(listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitTopupDeepLink(payload) {
  listeners.forEach((listener) => {
    try {
      listener(payload);
    } catch {
      // Ignore listener errors.
    }
  });
}

/** Start global Linking listener for PayOS return URL. Call once from app root. */
export function startTopupDeepLinkListener(onResolved) {
  async function handleUrl(url) {
    const parsed = parseTopupResultUrl(url);
    if (!parsed) {
      return;
    }
    emitTopupDeepLink(parsed);
    if (typeof onResolved === 'function') {
      try {
        await onResolved(parsed);
      } catch {
        // Caller handles errors.
      }
    }
  }

  const subscription = Linking.addEventListener('url', ({ url }) => {
    handleUrl(url);
  });

  Linking.getInitialURL()
    .then((url) => {
      if (url) {
        handleUrl(url);
      }
    })
    .catch(() => {});

  return () => subscription.remove();
}
