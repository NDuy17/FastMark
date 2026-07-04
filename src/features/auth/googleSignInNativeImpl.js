import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

import { googleOAuthConfig } from '../../services/env';
import { describeNativeGoogleError } from './googleAuthConfig';
import { socialLogin } from './authSlice';
import { GoogleSignInPressable } from './googleSignInShared';

export default function GoogleSignInNativeImpl({ disabled, onError }) {
  const dispatch = useDispatch();

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: googleOAuthConfig.webClientId,
      offlineAccess: false,
    });
  }, []);

  async function handlePress() {
    onError?.('');

    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();

      if (response.type === 'cancelled') {
        return;
      }

      let idToken = response.data?.idToken;
      if (!idToken) {
        const tokens = await GoogleSignin.getTokens();
        idToken = tokens.idToken;
      }

      if (!idToken) {
        onError?.('Google không trả về id_token. Kiểm tra Web Client ID trong Firebase.');
        return;
      }

      dispatch(socialLogin({ token: idToken }));
    } catch (error) {
      if (error?.code === statusCodes.SIGN_IN_CANCELLED) {
        return;
      }

      onError?.(describeNativeGoogleError(error) || 'Đăng nhập Google thất bại.');
    }
  }

  return (
    <GoogleSignInPressable
      disabled={disabled}
      onPress={handlePress}
    />
  );
}
