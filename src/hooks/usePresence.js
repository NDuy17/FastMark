import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useSelector } from 'react-redux';

import {
  setPresenceOfflineOnBackend,
  setPresenceOnlineOnBackend,
} from '../api/presenceApi';
import { APP_MODE_BUYER, APP_MODE_SELLER } from './useAppMode';
import { selectAuthStatus } from '../viewmodel/auth/authSelectors';

/**
 * Presence cá nhân (người mua). Chỉ online khi đang ở chế độ buyer.
 * Khi chuyển sang seller → đánh dấu offline để không còn "Đang hoạt động" phía tài khoản cá nhân.
 */
export function usePresence(appMode = APP_MODE_BUYER, { enabled = true } = {}) {
  const authStatus = useSelector(selectAuthStatus);
  const appStateRef = useRef(AppState.currentState);
  const isBuyerMode = appMode !== APP_MODE_SELLER;

  useEffect(() => {
    if (!enabled || authStatus !== 'authenticated') {
      return undefined;
    }

    let isActive = true;

    async function markOnline() {
      if (!isBuyerMode || appStateRef.current !== 'active') {
        return;
      }

      try {
        await setPresenceOnlineOnBackend();
      } catch {
        // Presence is best-effort.
      }
    }

    async function markOffline() {
      try {
        await setPresenceOfflineOnBackend();
      } catch {
        // Presence is best-effort.
      }
    }

    if (isBuyerMode) {
      markOnline();
    } else {
      markOffline();
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (!isActive || !isBuyerMode) {
        return;
      }

      if (prevState.match(/inactive|background/) && nextState === 'active') {
        markOnline();
      } else if (nextState.match(/inactive|background/)) {
        markOffline();
      }
    });

    return () => {
      isActive = false;
      markOffline();
      subscription.remove();
    };
  }, [authStatus, enabled, isBuyerMode]);
}
