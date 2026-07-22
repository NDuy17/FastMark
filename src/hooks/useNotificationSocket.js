import { useEffect } from 'react';
import { io } from 'socket.io-client';

import { getNodeApiUrl } from '../core/config/env';
import { normalizeSocketNotification } from '../core/utils/notificationRealtime';
import { getCurrentUserIdToken } from '../repository/authRepository';

let sharedSocket = null;
let connectPromise = null;
let listenerCount = 0;
const listeners = new Set();

function notifyListeners(payload) {
  const normalized = normalizeSocketNotification(payload);
  if (!normalized) {
    return;
  }

  listeners.forEach((listener) => {
    try {
      listener(normalized);
    } catch (error) {
      console.warn('notification socket listener failed:', error?.message || error);
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

    socket.on('notification:new', (payload) => {
      notifyListeners(payload);
    });

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

export function useNotificationSocket({ enabled = true, onNotificationNew } = {}) {
  useEffect(() => {
    if (!enabled || typeof onNotificationNew !== 'function') {
      return undefined;
    }

    listeners.add(onNotificationNew);
    listenerCount += 1;
    ensureSharedSocket();

    return () => {
      listeners.delete(onNotificationNew);
      listenerCount = Math.max(0, listenerCount - 1);
      if (listenerCount === 0) {
        disconnectSharedSocket();
      }
    };
  }, [enabled, onNotificationNew]);
}
