import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getLockAppealStatusOnBackend,
  submitLockAppealOnBackend,
} from '../../api/reportApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { selectAuthProfile } from '../../viewmodel/auth/authSelectors';
import { loadUserProfile, logoutUser } from '../../viewmodel/auth/authSlice';
import { showErrorAlert, confirmLogout } from '../../core/utils/appAlert';
import WithdrawScreen from '../wallet/WithdrawScreen';
import AdminAppealCompose from '../shared/components/AdminAppealCompose';
import KeyboardAwareScrollView from '../shared/components/KeyboardAwareScrollView';

export default function AccountLockedScreen() {
  const dispatch = useDispatch();
  const profile = useSelector(selectAuthProfile);

  const [loading, setLoading] = useState(true);
  const [appealState, setAppealState] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [screen, setScreen] = useState('main');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        showErrorAlert('Phiên đăng nhập đã hết hạn.');
        return;
      }
      const status = await getLockAppealStatusOnBackend(idToken);
      setAppealState(status);
      if (status && !status.accountLocked) {
        await dispatch(loadUserProfile());
      }
    } catch (loadError) {
      showErrorAlert(loadError.message || 'Không tải được trạng thái khiếu nại.');
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleSubmitAppeal({ content, images }) {
    const idToken = await getCurrentUserIdToken();
    if (!idToken) {
      Alert.alert('Thông báo', 'Vui lòng đăng nhập lại.');
      return;
    }
    await submitLockAppealOnBackend({
      idToken,
      title: 'Yêu cầu xem xét lại khóa tài khoản',
      content,
      images,
    });
    setShowForm(false);
    Alert.alert('Đã gửi khiếu nại', 'Đang chờ admin xử lý.');
    await refresh();
  }

  const phase = appealState?.phase || 'can_appeal';
  const displayName = profile?.fullName || profile?.userName || 'Tài khoản';

  if (screen === 'withdraw') {
    return (
      <WithdrawScreen
        balance={profile?.walletBalance ?? 0}
        onBack={() => setScreen('main')}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAwareScrollView
        nestedScrollPadding={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="lock-closed" size={36} color="#b91c1c" />
        </View>
        <Text style={styles.title}>Tài khoản đã bị khóa</Text>
        <Text style={styles.subtitle}>
          {displayName} hiện không thể sử dụng FastMark cho đến khi admin mở khóa. Bạn vẫn có thể
          gửi yêu cầu xem xét lại, rút tiền trong ví hoặc đăng xuất.
        </Text>

        <Pressable style={styles.secondaryBtn} onPress={() => setScreen('withdraw')}>
          <Text style={styles.secondaryBtnText}>Rút tiền</Text>
        </Pressable>

        {loading ? <Text style={styles.muted}>Đang tải trạng thái...</Text> : null}

        {!loading && phase === 'pending' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Chờ admin xử lý</Text>
            <Text style={styles.cardBody}>
              Bạn đã gửi khiếu nại. Vui lòng đợi quản trị viên xem xét.
            </Text>
            {appealState?.appeal?.content ? (
              <Text style={styles.quote}>{appealState.appeal.content}</Text>
            ) : null}
          </View>
        ) : null}

        {!loading && phase === 'rejected' ? (
          <View style={[styles.card, styles.cardDanger]}>
            <Text style={styles.cardTitle}>Khiếu nại đã bị từ chối</Text>
            <Text style={styles.cardBody}>
              {appealState?.appeal?.adminNote ||
                appealState?.message ||
                'Tài khoản vẫn bị khóa. Bạn không thể gửi khiếu nại lại.'}
            </Text>
          </View>
        ) : null}

        {!loading && phase === 'can_appeal' && !showForm ? (
          <Pressable
            style={styles.primaryBtn}
            onPress={() => setShowForm(true)}
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>Yêu cầu xem xét lại</Text>
          </Pressable>
        ) : null}

        {!loading && phase === 'can_appeal' && showForm ? (
          <AdminAppealCompose
            contentLabel="Nội dung yêu cầu"
            contentPlaceholder="Giải thích vì sao bạn muốn mở lại tài khoản..."
            submitLabel="Gửi yêu cầu"
            onCancel={() => setShowForm(false)}
            onSubmit={handleSubmitAppeal}
          />
        ) : null}

        <Pressable style={styles.refreshBtn} onPress={refresh}>
          <Text style={styles.refreshText}>Làm mới trạng thái</Text>
        </Pressable>
        <Pressable
          style={styles.logoutBtn}
          onPress={() => confirmLogout(() => dispatch(logoutUser()))}
        >
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 24, paddingBottom: 40 },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  secondaryBtnText: { color: '#076F32', fontWeight: '800', fontSize: 14 },
  muted: { textAlign: 'center', color: '#94a3b8', marginBottom: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  cardDanger: { borderColor: '#fecaca', backgroundColor: '#fff1f2' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 6 },
  cardBody: { fontSize: 14, color: '#475569', lineHeight: 20 },
  quote: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    color: '#334155',
    fontSize: 13,
  },
  primaryBtn: {
    backgroundColor: '#076F32',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  refreshBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 8 },
  refreshText: { color: '#0369a1', fontWeight: '700' },
  logoutBtn: { alignItems: 'center', paddingVertical: 12 },
  logoutText: { color: '#b91c1c', fontWeight: '800' },
});
