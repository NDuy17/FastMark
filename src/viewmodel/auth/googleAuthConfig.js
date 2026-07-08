import { makeRedirectUri, ResponseType } from 'expo-auth-session';

import { googleOAuthConfig } from '../../core/config/env';
import { validateGoogleOAuthSetup } from '../../core/utils/authDiagnostics';
import {
  hasGoogleSigninNativeBinary,
  isExpoGoRuntime,
  isNativeGoogleSignInAvailable,
} from './googleSignInModule';
export function isExpoGoClient() {
  return isExpoGoRuntime();
}

export function getGoogleBrowserRedirectUri() {
  return makeRedirectUri({
    scheme: 'fastmark',
    path: 'oauthredirect',
  });
}

export function getGoogleBrowserAuthRequestConfig() {
  const { webClientId } = googleOAuthConfig;

  return {
    webClientId,
    clientId: webClientId,
    redirectUri: getGoogleBrowserRedirectUri(),
    responseType: ResponseType.IdToken,
    scopes: ['openid', 'profile', 'email'],
    selectAccount: true,
  };
}

export function getGoogleAuthSetupError() {
  if (isExpoGoRuntime()) {
    return 'Bạn đang mở app bằng Expo Go. Hãy mở app FastMark đã cài sau khi chạy npx expo run:android.';
  }

  if (!hasGoogleSigninNativeBinary()) {
    return 'Google Sign-In chưa sẵn sàng trên bản build này. Chạy lại: npx expo run:android';
  }

  if (isNativeGoogleSignInAvailable()) {
    const { webClientId } = googleOAuthConfig;

    if (!webClientId) {
      return 'Thiếu EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID trong .env (lấy từ Firebase → Authentication → Google).';
    }

    const oauthIssues = validateGoogleOAuthSetup().filter(
      (issue) => issue.includes('Client ID in .env does not match google-services.json')
    );

    if (oauthIssues.length > 0) {
      return 'Client ID Google trong .env không khớp google-services.json. Web = client_type 3, Android = client_type 1.';
    }

    return null;
  }

  return 'Google Sign-In chưa sẵn sàng trên bản build này. Chạy lại: npx expo run:android';
}

export function describeGoogleOAuthError(response) {
  if (!response || response.type !== 'error') {
    return null;
  }

  const code = response.error?.code || response.params?.error;
  const description = response.error?.message || response.params?.error_description || '';
  const redirectUri = getGoogleBrowserRedirectUri();

  if (code === 'redirect_uri_mismatch' || description.includes('redirect_uri')) {
    return (
      `Redirect URI chưa khớp. Thêm vào Google Cloud Console (OAuth Web client → Authorized redirect URIs): ${redirectUri}`
    );
  }

  if (
    code === 'invalid_request' ||
    description.includes('invalid_request') ||
    description.includes('400')
  ) {
    if (isExpoGoClient()) {
      return 'Expo Go không hỗ trợ Google Sign-In. Mở app FastMark đã build bằng npx expo run:android.';
    }

    return (
      `Google từ chối OAuth (400). Thêm redirect URI vào Web client trên Google Cloud: ${redirectUri}`
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
      'Cấu hình Google chưa khớp. Kiểm tra EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (Web, client_type 3), SHA-1 trong Firebase và google-services.json.'
    );
  }

  if (
    message.includes('RNGoogleSignin') ||
    message.includes('Native module') ||
    message.includes('TurboModule')
  ) {
    if (isExpoGoClient()) {
      return 'Bạn đang dùng Expo Go. Mở app FastMark đã cài sau khi chạy npx expo run:android.';
    }

    return 'Native Google Sign-In chưa được tích hợp. Chạy lại: npx expo run:android';
  }

  if (message.includes('NETWORK_ERROR')) {
    return 'Không có kết nối mạng. Kiểm tra Internet rồi thử lại.';
  }

  return message || 'Đăng nhập Google thất bại.';
}
