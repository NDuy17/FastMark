import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { formatPrice } from '../../core/utils/productFormat';
import { buyerTheme as t } from '../../core/theme/buyerTheme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { WALLET_TX_STATUS, normalizeWalletTransaction } from '../../model/walletModel';
import { loadWalletTransactionDetailViewModel } from '../../viewmodel/wallet/walletViewModel';
import SubScreenHeader from '../shared/components/SubScreenHeader';

function formatTxTime(value) {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function DetailRow({ label, value }) {
  if (value == null || value === '') {
    return null;
  }

  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} selectable>
        {String(value)}
      </Text>
    </View>
  );
}

export default function WalletTransactionDetailScreen({
  transactionId = null,
  initialTransaction = null,
  onBack,
}) {
  const insets = useScreenInsets();
  const [loading, setLoading] = useState(!initialTransaction);
  const [error, setError] = useState('');
  const [transaction, setTransaction] = useState(() =>
    initialTransaction ? normalizeWalletTransaction(initialTransaction) : null
  );

  const load = useCallback(async () => {
    const id = transactionId || initialTransaction?.id;
    if (!id) {
      setError('Không tìm thấy giao dịch.');
      setLoading(false);
      return;
    }

    setError('');
    setLoading(true);
    try {
      const data = await loadWalletTransactionDetailViewModel(id);
      setTransaction(data.transaction);
    } catch (err) {
      if (!initialTransaction) {
        setError(err.message || 'Không tải được chi tiết giao dịch.');
      }
    } finally {
      setLoading(false);
    }
  }, [initialTransaction, transactionId]);

  useEffect(() => {
    load();
  }, [load]);

  const item = transaction;
  const isCredit = Boolean(item?.isCredit);
  const status = item?.status;
  const pending = status === WALLET_TX_STATUS.PENDING;
  const success = status === WALLET_TX_STATUS.SUCCESS;
  const cancelled = status === WALLET_TX_STATUS.CANCELLED;
  const failed = status === WALLET_TX_STATUS.FAILED;
  const statusText =
    item?.statusLabel ||
    (pending
      ? 'Đang chờ'
      : success
        ? 'Thành công'
        : cancelled
          ? 'Đã hủy'
          : failed
            ? 'Thất bại'
            : '—');

  return (
    <View style={styles.screen}>
      <SubScreenHeader title="Chi tiết giao dịch" onBack={onBack} />

      {loading && !item ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={t.primary} />
        </View>
      ) : error && !item ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryText}>Thử lại</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.nestedScrollPaddingBottom },
          ]}
        >
          <View style={styles.summaryCard}>
            <View style={[styles.summaryIcon, isCredit ? styles.iconCredit : styles.iconDebit]}>
              <Ionicons
                name={isCredit ? 'arrow-down' : 'arrow-up'}
                size={22}
                color={isCredit ? t.primary : t.danger}
              />
            </View>
            <Text style={styles.summaryType}>{item?.typeLabel || 'Giao dịch'}</Text>
            <Text style={[styles.summaryAmount, isCredit ? styles.plus : styles.minus]}>
              {isCredit ? '+' : '-'}
              {formatPrice(item?.amount || 0)}
            </Text>
            <Text
              style={[
                styles.summaryStatus,
                pending && styles.pending,
                success && styles.success,
                cancelled && styles.cancelled,
                failed && styles.failed,
              ]}
            >
              {statusText}
            </Text>
          </View>

          <View style={styles.card}>
            <DetailRow label="Mô tả" value={item?.description || item?.typeLabel} />
            <DetailRow
              label="Mã giao dịch"
              value={item?.orderCode != null ? String(item.orderCode) : null}
            />
            <DetailRow label="ID giao dịch" value={item?.id} />
            <DetailRow label="Ngân hàng" value={item?.bankName || null} />
            <DetailRow label="Mã ngân hàng" value={item?.bankCode || null} />
            <DetailRow label="Số tài khoản" value={item?.accountNumber || null} />
            <DetailRow label="Tên chủ tài khoản" value={item?.accountName || null} />
            <DetailRow
              label="Số dư sau giao dịch"
              value={item?.balanceAfter == null ? null : formatPrice(item.balanceAfter)}
            />
            <DetailRow label="Mã thanh toán" value={item?.paymentLinkId || null} />
            <DetailRow label="Đơn giữ hàng liên quan" value={item?.reservationId || null} />
            <DetailRow label="Ghi chú admin" value={item?.adminNote || null} />
            <DetailRow label="Thời gian tạo" value={formatTxTime(item?.createdAt)} />
            <DetailRow label="Cập nhật lần cuối" value={formatTxTime(item?.updatedAt)} />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  content: { padding: 16, gap: 14 },
  errorText: { color: t.danger, fontWeight: '700', textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: t.primarySoft,
  },
  retryText: { color: t.primaryDark, fontWeight: '800' },
  summaryCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: t.radiusLg,
    borderWidth: 1,
    borderColor: t.border,
    paddingVertical: 24,
    paddingHorizontal: 16,
    gap: 8,
  },
  summaryIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconCredit: { backgroundColor: t.primarySoft },
  iconDebit: { backgroundColor: t.dangerSoft },
  summaryType: { fontSize: 15, fontWeight: '700', color: t.textMuted },
  summaryAmount: { fontSize: 30, fontWeight: '900' },
  plus: { color: t.primary },
  minus: { color: t.danger },
  summaryStatus: { fontSize: 13, fontWeight: '800', marginTop: 2 },
  pending: { color: '#0284c7' },
  success: { color: '#16a34a' },
  cancelled: { color: '#dc2626' },
  failed: { color: '#dc2626' },
  card: {
    backgroundColor: '#fff',
    borderRadius: t.radiusLg,
    borderWidth: 1,
    borderColor: t.border,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  detailRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.border,
    gap: 6,
  },
  detailLabel: { fontSize: 12, fontWeight: '700', color: t.textMuted },
  detailValue: {
    fontSize: 15,
    fontWeight: '700',
    color: t.text,
  },
});
