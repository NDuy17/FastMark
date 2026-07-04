import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useDispatch, useSelector } from 'react-redux';

import AuthenticatedHome from './features/auth/AuthenticatedHome';
import AuthScreen from './features/auth/AuthScreen';
import { selectAuthStatus } from './features/auth/authSelectors';
import {
  loadUserProfile,
  setAuthChecking,
  setAuthUser,
  setConfigError,
  setUnauthenticated,
} from './features/auth/authSlice';
import { store } from './store';
import {
  serializeAuthUser,
  subscribeToAuthChanges,
} from './services/authService';
import { getBackendConfigError } from './services/env';

export default function FastmarkApp() {
  const dispatch = useDispatch();
  const status = useSelector(selectAuthStatus);

  useEffect(() => {
    const configError = getBackendConfigError();

    if (configError) {
      dispatch(setConfigError(configError));
      return undefined;
    }

    dispatch(setAuthChecking());

    try {
      const unsubscribe = subscribeToAuthChanges(
        (firebaseUser) => {
          if (!firebaseUser) {
            dispatch(setUnauthenticated());
            return;
          }

          const user = serializeAuthUser(firebaseUser);
          const currentUid = store.getState().auth.user?.uid;

          dispatch(setAuthUser(user));

          if (currentUid !== user.uid) {
            dispatch(loadUserProfile());
          }
        },
        (error) => {
          dispatch(setConfigError(error?.message || 'Không khởi tạo được xác thực.'));
        }
      );

      return unsubscribe;
    } catch (error) {
      dispatch(setConfigError(error?.message || 'Không khởi tạo được xác thực.'));
      return undefined;
    }
  }, [dispatch]);

  if (status === 'checking') {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#0f766e" />
        <Text style={styles.loadingText}>Đang kiểm tra đăng nhập...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      {status === 'authenticated' ? <AuthenticatedHome /> : <AuthScreen />}
    </>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e7f0ed',
  },
  loadingText: {
    marginTop: 14,
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
  },
});
