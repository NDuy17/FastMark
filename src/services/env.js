import {
  getAndroidOAuthClientIdFromGoogleServices,
  getWebOAuthClientIdFromGoogleServices,
} from './googleServicesConfig';

const env = process.env || {};

export const firebaseConfig = {
  apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const supabaseConfig = {
  url: env.EXPO_PUBLIC_SUPABASE_URL,
  key: env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
};

export const nodeApiUrl = env.EXPO_PUBLIC_NODE_API_URL || '';

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

export function getMissingSupabaseEnv() {
  if (nodeApiUrl) {
    return [];
  }

  const missing = [];

  if (!supabaseConfig.url) {
    missing.push('EXPO_PUBLIC_SUPABASE_URL');
  }

  if (!supabaseConfig.key) {
    missing.push('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  }

  return missing;
}

export function getNodeApiUrl() {
  return nodeApiUrl;
}

export function getMissingBackendEnv() {
  return [...getMissingFirebaseEnv(), ...getMissingSupabaseEnv()];
}

export function getAuthConfigError() {
  const missing = getMissingFirebaseEnv();

  if (missing.length === 0) {
    return '';
  }

  return `Cần bổ sung các biến trong .env: ${missing.join(', ')}`;
}

export function assertBackendEnv() {
  const missing = getMissingBackendEnv();

  if (missing.length > 0) {
    throw new Error(`Thiếu cấu hình kết nối: ${missing.join(', ')}`);
  }
}

export function getBackendConfigError() {
  const missing = getMissingBackendEnv();

  if (missing.length === 0) {
    return '';
  }

  return `Cần bổ sung các biến trong .env: ${missing.join(', ')}`;
}
