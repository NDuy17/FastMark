import * as Google from 'expo-auth-session/providers/google';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';

import {
  describeGoogleOAuthError,
  getGoogleBrowserAuthRequestConfig,
} from './googleAuthConfig';
import { socialLogin } from './authSlice';
import { GoogleSignInPressable } from './googleSignInShared';

export default function GoogleSignInBrowserButton({ disabled, onError }) {
  const dispatch = useDispatch();
  const [request, googleResponse, promptGoogle] = Google.useAuthRequest(
    getGoogleBrowserAuthRequestConfig()
  );

  useEffect(() => {
    if (!googleResponse) {
      return;
    }

    if (googleResponse.type === 'error') {
      onError?.(describeGoogleOAuthError(googleResponse) || 'Đăng nhập Google thất bại.');
      return;
    }

    if (googleResponse.type !== 'success') {
      return;
    }

    const idToken =
      googleResponse.params?.id_token ||
      googleResponse.authentication?.idToken ||
      '';

    if (!idToken) {
      onError?.('Google không trả về id_token. Kiểm tra OAuth Client ID trên Google Cloud.');
      return;
    }

    dispatch(socialLogin({ token: idToken }));
  }, [googleResponse, dispatch, onError]);

  function handlePress() {
    onError?.('');

    if (!request) {
      onError?.('Google Sign-In đang khởi tạo. Thử lại sau vài giây.');
      return;
    }

    promptGoogle();
  }

  return (
    <GoogleSignInPressable
      disabled={disabled}
      onPress={handlePress}
    />
  );
}
