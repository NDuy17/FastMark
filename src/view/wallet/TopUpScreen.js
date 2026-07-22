import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

import { formatPrice } from '../../core/utils/productFormat';
import { buyerTheme as t } from '../../core/theme/buyerTheme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import {
  createTopupViewModel,
  cancelTopupViewModel,
  resolveTopupReturnViewModel,
  syncTopupViewModel,
} from '../../viewmodel/wallet/walletViewModel';
import SubScreenHeader from '../shared/components/SubScreenHeader';

const PRESETS = [50000, 100000, 200000, 500000];
const POLL_MS = 2000;

/** Ẩn thanh brand merchant (FASTMARK + payOS) trên trang checkout PayOS nếu DOM cho phép. */
const HIDE_PAYOS_BRAND_JS = `
(function () {
  function hideBrandBar() {
    try {
      var nodes = Array.from(document.querySelectorAll('header, nav, div, section'));
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (!el || el.dataset.fmHideBrand === '1') continue;
        if (el.children && el.children.length > 8) continue;
        var text = String(el.innerText || '').replace(/\\s+/g, ' ').trim();
        if (!text || text.length > 60) continue;
        var hasMerchant = /FASTMARK/i.test(text);
        var hasPayos = /pay\\s*OS/i.test(text);
        if (hasMerchant && hasPayos) {
          el.style.setProperty('display', 'none', 'important');
          el.dataset.fmHideBrand = '1';
          return true;
        }
      }
      var headers = document.querySelectorAll('header, [class*="header"], [class*="Header"]');
      for (var j = 0; j < headers.length; j++) {
        var h = headers[j];
        if (!h || h.dataset.fmHideBrand === '1') continue;
        var ht = String(h.innerText || '');
        if (/FASTMARK/i.test(ht) || /pay\\s*OS/i.test(ht)) {
          h.style.setProperty('display', 'none', 'important');
          h.dataset.fmHideBrand = '1';
        }
      }
    } catch (e) {}
    return false;
  }
  hideBrandBar();
  var obs = new MutationObserver(function () { hideBrandBar(); });
  if (document.documentElement) {
    obs.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(function () { try { obs.disconnect(); } catch (e) {} }, 10000);
  }
})();
true;
`;

function isPayosReturnUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return (
    url.startsWith('fastmark://') ||
    url.includes('wallet/topup-result') ||
    url.includes('status=success') ||
    url.includes('status=cancel')
  );
}

export default function TopUpScreen({ balance = 0, onBack, onSuccess }) {
  const insets = useScreenInsets();
  const [amount, setAmount] = useState(100000);
  const [customText, setCustomText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkout, setCheckout] = useState(null);
  const [polling, setPolling] = useState(false);
  const finishedRef = useRef(false);
  const handlingReturnRef = useRef(false);

  const selectedAmount = useMemo(() => {
    const custom = Math.round(Number(String(customText).replace(/\D/g, '')));
    if (Number.isFinite(custom) && custom > 0) {
      return custom;
    }
    return amount;
  }, [amount, customText]);

  function selectPreset(value) {
    setAmount(value);
    setCustomText('');
  }

  const finishSuccess = useCallback(
    (synced) => {
      if (finishedRef.current) return false;
      if (synced?.transaction?.status !== 1) return false;
      finishedRef.current = true;
      setPolling(false);
      setCheckout(null);
      onSuccess?.({
        amount: synced.transaction.amount,
        orderCode: synced.transaction.orderCode,
        balance: synced.wallet?.balance,
      });
      return true;
    },
    [onSuccess]
  );

  const handleReturnUrl = useCallback(
    async (url) => {
      if (handlingReturnRef.current || finishedRef.current) return;
      handlingReturnRef.current = true;
      try {
        const resolved = await resolveTopupReturnViewModel(url);
        if (resolved?.cancelled) {
          finishedRef.current = true;
          setPolling(false);
          setCheckout(null);
          Alert.alert('Đã hủy', 'Bạn đã hủy thanh toán PayOS.');
          return;
        }
        if (await finishSuccess(resolved)) {
          return;
        }
        // Return URL tới sớm hơn webhook — tiếp tục poll.
        setPolling(true);
      } catch (error) {
        Alert.alert('Lỗi', error.message || 'Không xác nhận được thanh toán.');
      } finally {
        handlingReturnRef.current = false;
      }
    },
    [finishSuccess]
  );

  // Realtime: poll PayOS sync → backend tự cộng tiền khi PAID.
  useEffect(() => {
    if (!checkout?.orderCode || finishedRef.current) return undefined;

    let cancelled = false;
    setPolling(true);

    async function tick() {
      if (cancelled || finishedRef.current) return;
      try {
        const synced = await syncTopupViewModel(checkout.orderCode);
        if (!cancelled) {
          finishSuccess(synced);
        }
      } catch {
        // Giữ poll; webhook/lần sau sẽ xử lý.
      }
    }

    tick();
    const timer = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [checkout?.orderCode, finishSuccess]);

  async function handleConfirm() {
    if (submitting || checkout) return;
    if (!selectedAmount || selectedAmount < 10000) {
      Alert.alert('Số tiền không hợp lệ', 'Số tiền nạp tối thiểu là 10.000đ.');
      return;
    }

    finishedRef.current = false;
    setSubmitting(true);
    try {
      const result = await createTopupViewModel(selectedAmount);
      if (!result.checkoutUrl) {
        throw new Error('Không nhận được liên kết thanh toán PayOS.');
      }
      setCheckout({
        url: result.checkoutUrl,
        orderCode: result.orderCode,
        description: result.description || '',
      });
    } catch (error) {
      Alert.alert('Không nạp được', error.message || 'Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleCloseCheckout() {
    Alert.alert(
      'Hủy nạp tiền?',
      'Giao dịch sẽ được đánh dấu đã hủy. Nếu bạn đã chuyển khoản, liên hệ hỗ trợ kèm mã giao dịch.',
      [
        { text: 'Ở lại', style: 'cancel' },
        {
          text: 'Hủy nạp',
          style: 'destructive',
          onPress: async () => {
            const orderCode = checkout?.orderCode;
            setPolling(false);
            setCheckout(null);
            finishedRef.current = true;
            if (orderCode != null) {
              try {
                await cancelTopupViewModel(orderCode);
              } catch {
                // Đã đóng UI; lịch sử có thể còn PENDING đến khi sync.
              }
            }
          },
        },
      ]
    );
  }

  if (checkout?.url) {
    return (
      <View style={styles.screen}>
        <SubScreenHeader title="Thanh toán PayOS" onBack={handleCloseCheckout} />

        <View style={styles.checkoutMeta}>
          <Text style={styles.checkoutMetaText}>
            Nội dung CK: {checkout.description || 'userId'}
          </Text>
          {polling ? (
            <View style={styles.pollingRow}>
              <ActivityIndicator size="small" color={t.primaryDark} />
              <Text style={styles.pollingText}>Đang chờ xác nhận… cộng tiền tự động</Text>
            </View>
          ) : null}
        </View>

        <WebView
          source={{ uri: checkout.url }}
          style={styles.webview}
          startInLoadingState
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*', 'http://*', 'https://*', 'fastmark://*']}
          setSupportMultipleWindows={false}
          injectedJavaScript={HIDE_PAYOS_BRAND_JS}
          onShouldStartLoadWithRequest={(request) => {
            const url = request?.url || '';
            if (isPayosReturnUrl(url) && url.startsWith('fastmark://')) {
              handleReturnUrl(url);
              return false;
            }
            return true;
          }}
          onNavigationStateChange={(navState) => {
            const url = navState?.url || '';
            if (isPayosReturnUrl(url)) {
              handleReturnUrl(url);
            }
          }}
          renderLoading={() => (
            <View style={styles.webviewLoading}>
              <ActivityIndicator color={t.primaryDark} />
            </View>
          )}
        />

        {/* Safe area dưới để nút Huỷ của PayOS không bị thanh home che */}
        <View style={{ height: Math.max(insets.bottom, 12) }} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SubScreenHeader title="Nạp tiền" onBack={onBack} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.nestedScrollPaddingBottom + 72 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Số dư hiện tại</Text>
          <Text style={styles.balanceValue}>{formatPrice(balance)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Chọn mệnh giá nạp</Text>
        <View style={styles.presetGrid}>
          {PRESETS.map((value) => {
            const active = !customText && amount === value;
            return (
              <Pressable
                key={value}
                onPress={() => selectPreset(value)}
                style={[styles.presetChip, active && styles.presetChipActive]}
              >
                <Text style={[styles.presetText, active && styles.presetTextActive]}>
                  {formatPrice(value)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.inputWrap}>
          <Ionicons name="wallet-outline" size={18} color={t.textMuted} />
          <TextInput
            style={styles.input}
            value={customText}
            onChangeText={setCustomText}
            placeholder="Nhập số tiền khác..."
            placeholderTextColor="#94a3b8"
            keyboardType="number-pad"
          />
          <Text style={styles.inputSuffix}>VNĐ</Text>
        </View>

        <Text style={styles.sectionTitle}>Phương thức nạp</Text>
        <View style={[styles.methodCard, styles.methodCardActive]}>
          <View style={styles.methodIcon}>
            <Ionicons name="card-outline" size={20} color={t.primaryDark} />
          </View>
          <View style={styles.methodBody}>
            <Text style={styles.methodTitle}>Thanh toán PayOS</Text>
            <Text style={styles.methodSub}>Nhúng trong app · nội dung CK = userId</Text>
          </View>
          <Ionicons name="checkmark-circle" size={22} color={t.primary} />
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottomSpacing, 12) },
        ]}
      >
        <Pressable
          style={[styles.confirmBtn, submitting && styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.confirmRow}>
              <Text style={styles.confirmText}>
                {`Xác nhận nạp ${formatPrice(selectedAmount || 0)}`}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  checkoutMeta: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  checkoutMetaText: {
    fontSize: 12,
    fontWeight: '700',
    color: t.textMuted,
  },
  pollingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pollingText: {
    fontSize: 12,
    fontWeight: '600',
    color: t.primaryDark,
  },
  webview: { flex: 1, backgroundColor: '#fff' },
  webviewLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  content: { padding: 20, gap: 14 },
  balanceCard: {
    backgroundColor: t.primaryDark,
    borderRadius: t.radiusLg,
    padding: 18,
  },
  balanceLabel: { color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  balanceValue: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: t.text, marginTop: 4 },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  presetChip: {
    width: '48%',
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  presetChipActive: {
    backgroundColor: t.primary,
    borderColor: t.primary,
  },
  presetText: { fontSize: 15, fontWeight: '700', color: t.text },
  presetTextActive: { color: '#fff' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 52,
    backgroundColor: '#fff',
  },
  input: { flex: 1, fontSize: 15, fontWeight: '600', color: t.text },
  inputSuffix: { fontWeight: '700', color: t.textMuted },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#fff',
  },
  methodCardActive: {
    borderColor: t.primary,
    backgroundColor: '#f0fdf4',
  },
  methodIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: t.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodBody: { flex: 1, gap: 2 },
  methodTitle: { fontSize: 15, fontWeight: '800', color: t.text },
  methodSub: { fontSize: 12, fontWeight: '600', color: t.textMuted },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: t.border,
  },
  confirmBtn: {
    minHeight: 56,
    borderRadius: 999,
    backgroundColor: t.primaryDark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmBtnDisabled: { opacity: 0.7 },
  confirmText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
