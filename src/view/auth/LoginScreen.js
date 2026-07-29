import { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import {
  selectAuthActionStatus,
  selectAuthConfigError,
  selectAuthError,
  selectAuthSuccessMessage,
} from '../../viewmodel/auth/authSelectors';
import { clearAuthFeedback, loginUser } from '../../viewmodel/auth/authSlice';
import { validateLoginForm } from '../../viewmodel/auth/authFormValidation';
import { getGoogleAuthSetupError } from '../../viewmodel/auth/googleAuthConfig';
import { showErrorAlert, showAdminAccountAlert, isAdminAccountMessage, resolveAuthAlertMessage } from '../../core/utils/appAlert';
import AuthFormScreen from './components/AuthFormScreen';
import AuthDivider from './components/AuthDivider';
import AuthInput from './components/AuthInput';
import { AUTH_COLORS, AUTH_RADIUS } from './components/authTheme';
import GoogleSignInButton from './GoogleSignInButton';

export default function LoginScreen({ onGoForgot, onGoBack }) {
  const dispatch = useDispatch();
  const actionStatus = useSelector(selectAuthActionStatus);
  const configError = useSelector(selectAuthConfigError);
  const error = useSelector(selectAuthError);
  const successMessage = useSelector(selectAuthSuccessMessage);

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ login: '', password: '' });

  const isLoading = actionStatus === 'loading';
  const isDisabled = isLoading || Boolean(configError);
  const googleSetupError = getGoogleAuthSetupError();

  useEffect(() => {
    dispatch(clearAuthFeedback());
  }, [dispatch]);

  useEffect(() => {
    if (configError) {
      showErrorAlert(configError);
    }
  }, [configError]);

  useEffect(() => {
    if (error && !fieldErrors.login && !fieldErrors.password) {
      if (isAdminAccountMessage(error)) {
        showAdminAccountAlert();
        return;
      }
      showErrorAlert(error);
    }
  }, [error, fieldErrors.login, fieldErrors.password]);

  function clearFieldError(field) {
    setFieldErrors((current) => ({ ...current, [field]: '' }));
  }

  async function handleSubmit() {
    const validationError = validateLoginForm({ login, password });
    if (validationError) {
      setFieldErrors({
        login: validationError.field === 'login' ? validationError.message : '',
        password: validationError.field === 'password' ? validationError.message : '',
      });
      return;
    }

    setFieldErrors({ login: '', password: '' });
    dispatch(clearAuthFeedback());

    try {
      await dispatch(loginUser({ login: login.trim(), password })).unwrap();
    } catch (loginError) {
      const payload =
        loginError && typeof loginError === 'object'
          ? loginError
          : { message: String(loginError || 'Đăng nhập thất bại.'), field: '' };

      const message = payload.message || 'Đăng nhập thất bại.';
      const field = payload.field || '';

      if (field === 'login') {
        setFieldErrors({ login: message, password: '' });
      } else if (field === 'password') {
        setFieldErrors({ login: '', password: message });
      } else if (/không tồn tại|không tìm thấy/i.test(message)) {
        setFieldErrors({ login: message, password: '' });
      } else if (/mật khẩu|google/i.test(message)) {
        setFieldErrors({ login: '', password: message });
      } else if (/admin/i.test(message)) {
        showAdminAccountAlert();
      } else {
        showErrorAlert(message);
      }
    }
  }

  return (
    <AuthFormScreen title="Đăng nhập" onBack={onGoBack}>
      <View style={styles.card}>
        <AuthInput
          label="Email hoặc Username"
          value={login}
          onChangeText={(value) => {
            setLogin(value);
            clearFieldError('login');
          }}
          error={fieldErrors.login}
          autoCapitalize="none"
          autoComplete="username"
        />

        <AuthInput
          label="Mật khẩu"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            clearFieldError('password');
          }}
          error={fieldErrors.password}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
        />

        {successMessage ? (
          <View style={[styles.alertBox, styles.alertSuccess]}>
            <Text style={[styles.alertText, styles.alertTextSuccess]}>{successMessage}</Text>
          </View>
        ) : null}

        <Pressable
          disabled={isDisabled}
          onPress={handleSubmit}
          style={({ pressed }) => [
            styles.primaryButton,
            (pressed || isLoading) && styles.primaryButtonPressed,
            isDisabled && styles.primaryButtonDisabled,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </Text>
        </Pressable>

        <Pressable onPress={() => onGoForgot?.()} style={styles.forgotLinkWrap} hitSlop={8}>
          <Text style={styles.forgotLink}>Quên mật khẩu?</Text>
        </Pressable>

        <AuthDivider label="Hoặc đăng nhập với" />

        {googleSetupError ? (
          <View style={styles.hintBox}>
            <Text style={styles.hintText}>{googleSetupError}</Text>
          </View>
        ) : null}

        <GoogleSignInButton
          disabled={isLoading}
          onError={(message) => {
            const text = resolveAuthAlertMessage(message);
            if (!text) {
              return;
            }
            if (isAdminAccountMessage(text)) {
              showAdminAccountAlert();
              return;
            }
            showErrorAlert(text);
          }}
        />
      </View>
    </AuthFormScreen>
  );
}
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AUTH_COLORS.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '900',
    color: AUTH_COLORS.text,
  },
  backButton: {
    borderWidth: 1,
    borderColor: AUTH_COLORS.border,
    backgroundColor: '#ffffff',
  },
  card: {
    paddingVertical: 8,
  },
  forgotLinkWrap: {
    alignItems: 'center',
    marginTop: 14,
  },
  forgotLink: {
    fontSize: 14,
    fontWeight: '700',
    color: AUTH_COLORS.primary,
  },
  alertBox: {
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: AUTH_COLORS.errorBg,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  alertSuccess: {
    backgroundColor: AUTH_COLORS.successBg,
    borderLeftColor: '#22c55e',
  },
  alertText: {
    fontSize: 13,
    fontWeight: '600',
    color: AUTH_COLORS.errorText,
    lineHeight: 18,
  },
  alertTextSuccess: {
    color: AUTH_COLORS.successText,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: AUTH_RADIUS.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AUTH_COLORS.primary,
    shadowColor: AUTH_COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 5,
  },
  primaryButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  primaryButtonDisabled: {
    backgroundColor: '#9ca3af',
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  hintBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fffbeb',
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  hintText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#92400e',
    fontWeight: '600',
  },
});
