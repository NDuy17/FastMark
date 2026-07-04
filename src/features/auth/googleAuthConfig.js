import { Platform } from 'react-native';

import { googleOAuthConfig } from '../../services/env';

export function getGoogleBrowserAuthRequestConfig() {
  const { webClientId } = googleOAuthConfig;

  return {
    webClientId,
    clientId: webClientId,
    scopes: ['openid', 'profile', 'email'],
    selectAccount: true,
  };
}

export function getGoogleBrowserAuthRedirectUriOptions() {
  return { scheme: 'fastmark' };
}

export function getGoogleAuthSetupError() {
  const { webClientId } = googleOAuthConfig;

  if (!webClientId) {
    return 'Thiếu EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID trong .env (lấy từ Firebase → Authentication → Google).';
  }

  return null;
}

export function describeGoogleOAuthError(response) {
  if (!response || response.type !== 'error') {
    return null;
  }

  const code = response.error?.code || response.params?.error;
  const description = response.error?.message || response.params?.error_description || '';

  if (code === 'redirect_uri_mismatch' || description.includes('redirect_uri')) {
    return (
      'Lỗi redirect_uri: thêm redirect URI của app vào Google Cloud Console (OAuth Web client → Authorized redirect URIs).'
    );
  }

  if (code === 'invalid_request' || description.includes('invalid_request')) {
    return (
      'Google từ chối yêu cầu OAuth. Trên Android, hãy build native app (npx expo run:android) thay vì Expo Go. Nếu dùng Expo Go, thêm redirect URI https://auth.expo.io vào Web client trên Google Cloud.'
    );
  }

  return description || 'Đăng nhập Google thất bại.';
}

export function describeNativeGoogleError(error) {
  if (!error) {
    return null;
  }

  const message = error.message || '';

  if (message.includes('DEVELOPER_ERROR') || error.code === '10') {
    return (
      'Cấu hình Google chưa khớp. Thêm SHA-1 vào Firebase, tải lại google-services.json, rồi rebuild: npx expo run:android.'
    );
  }

  if (message.includes('NETWORK_ERROR')) {
    return 'Không có kết nối mạng. Kiểm tra Internet rồi thử lại.';
  }

  return message || 'Đăng nhập Google thất bại.';
}
