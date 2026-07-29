import { useEffect } from 'react';
import { io } from 'socket.io-client';

import { apiUrl } from '../config/env';

let sharedSocket = null;
let connectPromise = null;
let listenerCount = 0;
const listeners = new Set();

function notifyListeners(payload) {
  listeners.forEach((listener) => {
    try {
      listener(payload || {});
    } catch (error) {
      console.warn('admin realtime listener failed:', error?.message || error);
    }
  });
}

function disconnectSharedSocket() {
  if (sharedSocket) {
    sharedSocket.removeAllListeners();
    sharedSocket.disconnect();
    sharedSocket = null;
  }
  connectPromise = null;
}

async function ensureSharedSocket(getIdToken) {
  if (sharedSocket?.connected) {
    return sharedSocket;
  }

  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = (async () => {
    if (!apiUrl || typeof getIdToken !== 'function') {
      return null;
    }

    const token = await getIdToken();
    if (!token) {
      return null;
    }

    disconnectSharedSocket();

    const socket = io(apiUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    const forward = (payload) => notifyListeners(payload);

    socket.on('admin_updated', forward);
    socket.on('order_updated', forward);
    socket.on('withdraw_updated', forward);
    socket.on('wallet_updated', forward);
    socket.on('banner_updated', forward);
    socket.on('subscription_updated', forward);
    socket.on('product_updated', forward);
    socket.on('report_updated', forward);
    socket.on('review_updated', forward);
    socket.on('verification_updated', forward);

    socket.on('disconnect', () => {
      if (listenerCount === 0) {
        disconnectSharedSocket();
      }
    });

    sharedSocket = socket;
    return socket;
  })();

  try {
    return await connectPromise;
  } finally {
    connectPromise = null;
  }
}

export function useAdminRealtimeSocket({ enabled = true, getIdToken, onEvent } = {}) {
  useEffect(() => {
    if (!enabled || typeof onEvent !== 'function' || typeof getIdToken !== 'function') {
      return undefined;
    }

    listeners.add(onEvent);
    listenerCount += 1;
    ensureSharedSocket(getIdToken);

    return () => {
      listeners.delete(onEvent);
      listenerCount = Math.max(0, listenerCount - 1);
      if (listenerCount === 0) {
        disconnectSharedSocket();
      }
    };
  }, [enabled, getIdToken, onEvent]);
}
