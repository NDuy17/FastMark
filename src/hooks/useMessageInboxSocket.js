import { useEffect } from 'react';
import { io } from 'socket.io-client';

import { getNodeApiUrl } from '../core/config/env';
import { getCurrentUserIdToken } from '../repository/authRepository';

let sharedSocket = null;
let connectPromise = null;
let listenerCount = 0;
const sentListeners = new Set();
const inboxListeners = new Set();

function notifySentListeners(payload) {
  sentListeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (error) {
      console.warn('inbox message socket listener failed:', error?.message || error);
    }
  });
}

function notifyInboxListeners(payload) {
  inboxListeners.forEach((listener) => {
    try {
      listener(payload || {});
    } catch (error) {
      console.warn('inbox update socket listener failed:', error?.message || error);
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

    socket.on('message_sent', notifySentListeners);
    socket.on('inbox:updated', notifyInboxListeners);

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

export function useMessageInboxSocket({
  enabled = true,
  onMessageSent,
  onInboxUpdated,
} = {}) {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const hasSentListener = typeof onMessageSent === 'function';
    const hasInboxListener = typeof onInboxUpdated === 'function';

    if (!hasSentListener && !hasInboxListener) {
      return undefined;
    }

    if (hasSentListener) {
      sentListeners.add(onMessageSent);
    }
    if (hasInboxListener) {
      inboxListeners.add(onInboxUpdated);
    }

    listenerCount += 1;
    ensureSharedSocket();

    return () => {
      if (hasSentListener) {
        sentListeners.delete(onMessageSent);
      }
      if (hasInboxListener) {
        inboxListeners.delete(onInboxUpdated);
      }
      listenerCount = Math.max(0, listenerCount - 1);
      if (listenerCount === 0) {
        disconnectSharedSocket();
      }
    };
  }, [enabled, onMessageSent, onInboxUpdated]);
}
