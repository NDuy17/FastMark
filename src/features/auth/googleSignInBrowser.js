import * as Google from 'expo-auth-session/providers/google';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';

import {
  describeGoogleOAuthError,
  getGoogleBrowserAuthRedirectUriOptions,
  getGoogleBrowserAuthRequestConfig,
} from './googleAuthConfig';
import { socialLogin } from './authSlice';
import { GoogleSignInPressable } from './googleSignInShared';

export default function GoogleSignInBrowserButton({ disabled, onError }) {
  const dispatch = useDispatch();
  const [request, googleResponse, promptGoogle] = Google.useIdTokenAuthRequest(
    getGoogleBrowserAuthRequestConfig(),
    getGoogleBrowserAuthRedirectUriOptions()
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
    promptGoogle();
  }

  return (
    <GoogleSignInPressable
      disabled={disabled || !request}
      onPress={handlePress}
    />
  );
}
