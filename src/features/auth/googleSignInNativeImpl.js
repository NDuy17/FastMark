import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { GoogleSignin } from '@react-native-google-signin/google-signin/lib/module/signIn/GoogleSignin';
import { statusCodes } from '@react-native-google-signin/google-signin/lib/module/errors/errorCodes';

import { googleOAuthConfig } from '../../services/env';
import { describeNativeGoogleError, getGoogleAuthSetupError } from './googleAuthConfig';
import { socialLogin } from './authSlice';
import { GoogleSignInPressable } from './googleSignInShared';

export default function GoogleSignInNativeImpl({ disabled, onError }) {
  const dispatch = useDispatch();
  const setupError = getGoogleAuthSetupError();

  useEffect(() => {
    if (setupError) {
      return;
    }

    GoogleSignin.configure({
      webClientId: googleOAuthConfig.webClientId,
      offlineAccess: false,
    });
  }, [setupError]);

  async function handlePress() {
    onError?.('');

    if (setupError) {
      onError?.(setupError);
      return;
    }

    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();

      if (response?.type === 'cancelled') {
        return;
      }

      const userData = response?.data || response;
      let idToken = userData?.idToken || userData?.user?.idToken;

      if (!idToken) {
        const tokens = await GoogleSignin.getTokens();
        idToken = tokens?.idToken;
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
      disabled={disabled || Boolean(setupError)}
      onPress={handlePress}
    />
  );
}
