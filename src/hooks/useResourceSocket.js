import { useEffect } from 'react';
import { io } from 'socket.io-client';

import { getNodeApiUrl } from '../core/config/env';
import { getCurrentUserIdToken } from '../repository/authRepository';

let sharedSocket = null;
let connectPromise = null;
let listenerCount = 0;
const listeners = new Set();

function notifyListeners(payload) {
  listeners.forEach((listener) => {
    try {
      listener(payload || {});
    } catch (error) {
      console.warn('resource socket listener failed:', error?.message || error);
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

async function ensureSharedSocket() {
  if (sharedSocket?.connected) {
    return sharedSocket;
  }

  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = (async () => {
    const baseUrl = getNodeApiUrl();
    if (!baseUrl) {
      return null;
    }

    const token = await getCurrentUserIdToken();
    if (!token) {
      return null;
    }

    disconnectSharedSocket();

    const socket = io(baseUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    socket.on('resource_updated', notifyListeners);
    socket.on('wallet_updated', notifyListeners);
    socket.on('withdraw_updated', notifyListeners);
    socket.on('banner_updated', notifyListeners);
    socket.on('subscription_updated', notifyListeners);
    socket.on('product_updated', notifyListeners);
    socket.on('order_updated', notifyListeners);
    socket.on('verification_updated', notifyListeners);

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

export function useResourceSocket({ enabled = true, onResourceUpdated } = {}) {
  useEffect(() => {
    if (!enabled || typeof onResourceUpdated !== 'function') {
      return undefined;
    }

    listeners.add(onResourceUpdated);
    listenerCount += 1;
    ensureSharedSocket();

    return () => {
      listeners.delete(onResourceUpdated);
      listenerCount = Math.max(0, listenerCount - 1);
      if (listenerCount === 0) {
        disconnectSharedSocket();
      }
    };
  }, [enabled, onResourceUpdated]);
}
