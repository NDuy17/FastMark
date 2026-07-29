import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import {
  selectAuthActionStatus,
  selectAuthError,
  selectPendingGoogle,
} from '../../viewmodel/auth/authSelectors';
import {
  clearAuthFeedback,
  clearPendingGoogle,
  completeGoogleProfile,
} from '../../viewmodel/auth/authSlice';
import { validateGoogleProfileForm } from '../../viewmodel/auth/authFormValidation';
import { showErrorAlert } from '../../core/utils/appAlert';
import AuthFormScreen from './components/AuthFormScreen';
import AuthBrand from './components/AuthBrand';
import AvatarBadge from '../shared/components/AvatarBadge';
import AuthInput from './components/AuthInput';
import { AUTH_COLORS, AUTH_RADIUS } from './components/authTheme';

export default function GoogleUsernameSetupScreen() {
  const dispatch = useDispatch();
  const pendingGoogle = useSelector(selectPendingGoogle);
  const actionStatus = useSelector(selectAuthActionStatus);
  const error = useSelector(selectAuthError);

  const [fullName, setFullName] = useState(pendingGoogle?.fullName || '');
  const [userName, setUserName] = useState('');

  const isLoading = actionStatus === 'loading';

  useEffect(() => {
    if (error) {
      showErrorAlert(error);
    }
  }, [error]);

  function handleSubmit() {
    const validationError = validateGoogleProfileForm({ fullName, userName });
    if (validationError) {
      showErrorAlert(validationError);
      return;
    }

    dispatch(
      completeGoogleProfile({
        fullName: fullName.trim(),
        userName: userName.trim(),
      })
    );
  }

  function handleCancel() {
    dispatch(clearAuthFeedback());
    dispatch(clearPendingGoogle());
  }

  return (
    <AuthFormScreen title="Hoàn tất tài khoản" onBack={handleCancel}>
      <View style={styles.formContent}>
        <AuthBrand
          title="Hoàn tất tài khoản"
          subtitle="Đây là lần đăng nhập Google đầu tiên. Hãy chọn tên đăng nhập để tiếp tục."
        />

        <View style={styles.card}>
          <View style={styles.googleUserRow}>
            <AvatarBadge
              name={fullName || pendingGoogle?.fullName || pendingGoogle?.email || 'G'}
              uri=""
              size={48}
            />
            <View style={styles.googleUserMeta}>
              <Text style={styles.googleEmail}>{pendingGoogle?.email || 'Google Account'}</Text>
              <Text style={styles.googleHint}>Đăng nhập bằng Google</Text>
            </View>
          </View>

          <AuthInput
            label="Họ và tên"
            value={fullName}
            onChangeText={(value) => {
              setFullName(value);
            }}
            autoCapitalize="words"
            autoComplete="name"
            placeholder="Nguyễn Văn A"
          />

          <AuthInput
            label="Tên đăng nhập"
            value={userName}
            onChangeText={(value) => {
              setUserName(value);
            }}
            autoCapitalize="none"
            autoComplete="username"
            placeholder="nguyenvana"
          />

          <Pressable
            disabled={isLoading}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.primaryButton,
              (pressed || isLoading) && styles.primaryButtonPressed,
              isLoading && styles.primaryButtonDisabled,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {isLoading ? 'Đang lưu...' : 'Tiếp tục'}
            </Text>
          </Pressable>
        </View>
      </View>
    </AuthFormScreen>
  );
}

const styles = StyleSheet.create({
  formContent: {
    flexGrow: 1,
  },
  card: {
    backgroundColor: AUTH_COLORS.card,
    borderRadius: AUTH_RADIUS.card,
    padding: 20,
    borderWidth: 1,
    borderColor: AUTH_COLORS.border,
  },
  googleUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: AUTH_COLORS.border,
  },
  googleUserMeta: {
    flex: 1,
  },
  googleEmail: {
    fontSize: 15,
    fontWeight: '700',
    color: AUTH_COLORS.text,
  },
  googleHint: {
    marginTop: 2,
    fontSize: 13,
    color: AUTH_COLORS.textMuted,
    fontWeight: '600',
  },
  alertBox: {
    backgroundColor: AUTH_COLORS.errorBg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  alertText: {
    color: AUTH_COLORS.errorText,
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: AUTH_COLORS.primary,
    borderRadius: AUTH_RADIUS.button,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryButtonPressed: {
    backgroundColor: AUTH_COLORS.primaryDark,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
});
