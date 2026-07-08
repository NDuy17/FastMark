import { Platform } from 'react-native';
import Constants from 'expo-constants';

import {
  getAndroidOAuthClientIdFromGoogleServices,
  getWebOAuthClientIdFromGoogleServices,
} from './googleServicesConfig';
import { createLogger } from '../utils/logger';

const log = createLogger('Env');

const env = process.env || {};

export const firebaseConfig = {
  apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const nodeApiUrl = env.EXPO_PUBLIC_NODE_API_URL || '';

function readSupabaseEnv(...keys) {
  for (const key of keys) {
    const value = env[key];
    if (value !== undefined && String(value).trim() !== '') {
      return String(value).trim();
    }
  }

  return '';
}

export const supabaseConfig = {
  url: readSupabaseEnv('EXPO_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL'),
  anonKey: readSupabaseEnv(
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'VITE_SUPABASE_ANON_KEY'
  ),
};

export function getSupabaseConfig() {
  return supabaseConfig;
}

export function getSupabaseConfigError() {
  if (!supabaseConfig.url || !supabaseConfig.anonKey) {
    return 'Thiếu EXPO_PUBLIC_SUPABASE_URL hoặc EXPO_PUBLIC_SUPABASE_ANON_KEY trong .env';
  }

  return '';
}

export const googleOAuthConfig = {
  webClientId:
    env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    getWebOAuthClientIdFromGoogleServices() ||
    '',
  androidClientId:
    env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
    getAndroidOAuthClientIdFromGoogleServices() ||
    '',
  iosClientId: env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
};

const firebaseRequiredKeys = [
  ['EXPO_PUBLIC_FIREBASE_API_KEY', 'apiKey'],
  ['EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', 'authDomain'],
  ['EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'projectId'],
  ['EXPO_PUBLIC_FIREBASE_APP_ID', 'appId'],
];

export function getMissingFirebaseEnv() {
  return firebaseRequiredKeys
    .filter(([, configKey]) => !firebaseConfig[configKey])
    .map(([envKey]) => envKey);
}

export function getNodeApiUrl() {
  const configured = String(nodeApiUrl || '').trim().replace(/\/$/, '');

  if (!configured) {
    return '';
  }

  // Android emulator: localhost/LAN IP on host machine maps to 10.0.2.2
  if (Platform.OS === 'android' && Constants.isDevice === false) {
    const portMatch = configured.match(/:(\d+)(?:\/|$)/);
    const port = portMatch?.[1] || '5000';
    return `http://10.0.2.2:${port}`;
  }

  return configured;
}

export function getAuthConfigError() {
  const missing = getMissingFirebaseEnv();

  if (missing.length === 0) {
    return '';
  }

  return `Cần bổ sung các biến trong .env: ${missing.join(', ')}`;
}

export function getFirebaseConfigSummary() {
  return {
    projectId: firebaseConfig.projectId || '(missing)',
    authDomain: firebaseConfig.authDomain || '(missing)',
    appId: firebaseConfig.appId ? `${firebaseConfig.appId.slice(0, 8)}...` : '(missing)',
    apiKey: firebaseConfig.apiKey ? 'set' : '(missing)',
  };
}

export function assertBackendEnv() {
  const missing = getMissingFirebaseEnv();

  if (missing.length > 0) {
    log.fail('assertBackendEnv', `Missing: ${missing.join(', ')}`);
    throw new Error(`Thiếu cấu hình kết nối: ${missing.join(', ')}`);
  }

  log.debug('assertBackendEnv:ok');
}
