import { useEffect } from 'react';
import { io } from 'socket.io-client';

import { getNodeApiUrl } from '../core/config/env';
import { normalizeSocketNotification } from '../core/utils/notificationRealtime';
import { getCurrentUserIdToken } from '../repository/authRepository';

let sharedSocket = null;
let connectPromise = null;
let listenerCount = 0;
const newListeners = new Set();
const readListeners = new Set();

function notifyNewListeners(payload) {
  const normalized = normalizeSocketNotification(payload);
  if (!normalized) {
    return;
  }

  newListeners.forEach((listener) => {
    try {
      listener(normalized);
    } catch (error) {
      console.warn('notification socket listener failed:', error?.message || error);
    }
  });
}

function notifyReadListeners(payload) {
  readListeners.forEach((listener) => {
    try {
      listener(payload || {});
    } catch (error) {
      console.warn('notification read socket listener failed:', error?.message || error);
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

    socket.on('notification:new', notifyNewListeners);
    socket.on('notification_created', notifyNewListeners);
    socket.on('notification:read', notifyReadListeners);

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

export function useNotificationSocket({
  enabled = true,
  onNotificationNew,
  onNotificationRead,
} = {}) {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const hasNewListener = typeof onNotificationNew === 'function';
    const hasReadListener = typeof onNotificationRead === 'function';

    if (!hasNewListener && !hasReadListener) {
      return undefined;
    }

    if (hasNewListener) {
      newListeners.add(onNotificationNew);
    }
    if (hasReadListener) {
      readListeners.add(onNotificationRead);
    }

    listenerCount += 1;
    ensureSharedSocket();

    return () => {
      if (hasNewListener) {
        newListeners.delete(onNotificationNew);
      }
      if (hasReadListener) {
        readListeners.delete(onNotificationRead);
      }
      listenerCount = Math.max(0, listenerCount - 1);
      if (listenerCount === 0) {
        disconnectSharedSocket();
      }
    };
  }, [enabled, onNotificationNew, onNotificationRead]);
}
