import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import {
  registerDevicePushTokenOnBackend,
  removeDevicePushTokenOnBackend,
} from '../api/notificationApi';
import { loadNotificationSettings } from '../core/storage/notificationSettingsStorage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function resolvePlatform() {
  if (Platform.OS === 'android' || Platform.OS === 'ios' || Platform.OS === 'web') {
    return Platform.OS;
  }
  return 'unknown';
}

function extractDevicePushToken(tokenResult) {
  if (!tokenResult) {
    return '';
  }

  if (typeof tokenResult === 'string') {
    return tokenResult.trim();
  }

  return String(tokenResult.data || tokenResult.token || '').trim();
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync('default', {
    name: 'FastMark',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#076F32',
  });
}

async function requestPushPermission() {
  const settings = await loadNotificationSettings();
  if (!settings.orderNotifications && !settings.systemNotifications) {
    return false;
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return (
    requested.granted ||
    requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

async function fetchNativeDevicePushToken() {
  await ensureAndroidChannel();

  const granted = await requestPushPermission();
  if (!granted) {
    return '';
  }

  try {
    const tokenResult = await Notifications.getDevicePushTokenAsync();
    return extractDevicePushToken(tokenResult);
  } catch (error) {
    console.warn('[push] unable to get native device token:', error?.message || error);
    return '';
  }
}

export function usePushNotifications({ enabled = true } = {}) {
  const activeTokenRef = useRef('');

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let disposed = false;

    async function syncToken() {
      const token = await fetchNativeDevicePushToken();
      if (!token || disposed) {
        return;
      }

      activeTokenRef.current = token;
      await registerDevicePushTokenOnBackend({
        token,
        platform: resolvePlatform(),
      });
    }

    syncToken();

    const tokenSubscription = Notifications.addPushTokenListener((tokenResult) => {
      const nextToken = extractDevicePushToken(tokenResult);
      if (!nextToken || nextToken === activeTokenRef.current) {
        return;
      }

      activeTokenRef.current = nextToken;
      registerDevicePushTokenOnBackend({
        token: nextToken,
        platform: resolvePlatform(),
      }).catch(() => {});
    });

    return () => {
      disposed = true;
      tokenSubscription.remove();
      const token = activeTokenRef.current;
      activeTokenRef.current = '';
      if (token) {
        removeDevicePushTokenOnBackend(token).catch(() => {});
      }
    };
  }, [enabled]);
}
