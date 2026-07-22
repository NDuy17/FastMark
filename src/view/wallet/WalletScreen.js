import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { formatPrice } from '../../core/utils/productFormat';
import { buyerTheme as t } from '../../core/theme/buyerTheme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import SubScreenHeader from '../shared/components/SubScreenHeader';
import { WALLET_TX_STATUS } from '../../model/walletModel';
import { loadWalletViewModel } from '../../viewmodel/wallet/walletViewModel';
import WalletTransactionDetailScreen from './WalletTransactionDetailScreen';

function formatTxTime(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function TransactionRow({ item, onPress }) {
  const isCredit = item.isCredit;
  const status = item.status;
  const pending = status === WALLET_TX_STATUS.PENDING;
  const success = status === WALLET_TX_STATUS.SUCCESS;
  const cancelled = status === WALLET_TX_STATUS.CANCELLED;
  const failed = status === WALLET_TX_STATUS.FAILED;
  const statusText =
    item.statusLabel ||
    (pending
      ? 'Đang chờ'
      : success
        ? 'Thành công'
        : cancelled
          ? 'Đã hủy'
          : failed
            ? 'Thất bại'
            : '');

  return (
    <Pressable
      onPress={() => onPress?.(item)}
      style={({ pressed }) => [styles.txRow, pressed && styles.txRowPressed]}
    >
      <View style={[styles.txIcon, isCredit ? styles.txIconCredit : styles.txIconDebit]}>
        <Ionicons
          name={isCredit ? 'add' : 'remove'}
          size={20}
          color={isCredit ? t.primaryDark : t.danger}
        />
      </View>
      <View style={styles.txBody}>
        <Text style={styles.txTitle} numberOfLines={1}>
          {item.description || item.typeLabel}
        </Text>
        <Text style={styles.txMeta}>{formatTxTime(item.createdAt)}</Text>
        {statusText ? (
          <Text
            style={[
              styles.txStatus,
              pending && styles.txPending,
              success && styles.txSuccess,
              cancelled && styles.txCancelled,
              failed && styles.txFailed,
            ]}
          >
            {statusText}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.txAmount, isCredit ? styles.txAmountPlus : styles.txAmountMinus]}>
        {isCredit ? '+' : '-'}
        {formatPrice(item.amount)}
      </Text>
      <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
    </Pressable>
  );
}

export default function WalletScreen({ onBack, onTopUp, onWithdraw, onSeeAllTransactions }) {
  const insets = useScreenInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wallet, setWallet] = useState({ balance: 0 });
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await loadWalletViewModel();
      setWallet(data.wallet);
      setTransactions(data.transactions || []);
    } catch (err) {
      setError(err.message || 'Không tải được ví.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (selectedTransaction) {
    return (
      <WalletTransactionDetailScreen
        transactionId={selectedTransaction.id}
        initialTransaction={selectedTransaction}
        onBack={() => setSelectedTransaction(null)}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <SubScreenHeader title="Ví FastMark" onBack={onBack} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={t.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.nestedScrollPaddingBottom },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={t.primary}
            />
          }
        >
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Tổng số dư</Text>
            <Text style={styles.balanceValue}>{formatPrice(wallet.balance)}</Text>
            <View style={styles.actionRow}>
              <Pressable style={styles.actionItem} onPress={onTopUp}>
                <View style={styles.actionBtn}>
                  <Ionicons name="add" size={22} color={t.primaryDark} />
                </View>
                <Text style={styles.actionLabel}>Nạp tiền</Text>
              </Pressable>
              <Pressable
                style={styles.actionItem}
                onPress={() => {
                  if (onWithdraw) {
                    onWithdraw();
                    return;
                  }
                  Alert.alert('Thông báo', 'Không mở được màn rút tiền.');
                }}
              >
                <View style={styles.actionBtn}>
                  <Ionicons name="remove" size={22} color={t.primaryDark} />
                </View>
                <Text style={styles.actionLabel}>Rút tiền</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Giao dịch gần đây</Text>
            <Pressable onPress={onSeeAllTransactions} hitSlop={8}>
              <Text style={styles.seeAll}>Xem tất cả</Text>
            </Pressable>
          </View>

          <View style={styles.txCard}>
            {transactions.length === 0 ? (
              <Text style={styles.emptyText}>Chưa có giao dịch nào.</Text>
            ) : (
              transactions
                .slice(0, 8)
                .map((item) => (
                  <TransactionRow
                    key={item.id}
                    item={item}
                    onPress={setSelectedTransaction}
                  />
                ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 16 },
  errorText: { color: t.danger, fontWeight: '600' },
  balanceCard: {
    backgroundColor: t.primaryDark,
    borderRadius: t.radiusLg,
    padding: 20,
  },
  balanceLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600' },
  balanceValue: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 20,
  },
  actionRow: { flexDirection: 'row', justifyContent: 'space-around' },
  actionItem: { alignItems: 'center', gap: 8 },
  actionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { color: '#fff', fontSize: 13, fontWeight: '700' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: t.text },
  seeAll: { fontSize: 13, fontWeight: '700', color: t.primary },
  txCard: {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: t.radius,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  emptyText: {
    padding: 20,
    textAlign: 'center',
    color: t.textMuted,
    fontWeight: '600',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  txRowPressed: { backgroundColor: '#f8fafc' },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txIconCredit: { backgroundColor: t.primarySoft },
  txIconDebit: { backgroundColor: t.dangerSoft },
  txBody: { flex: 1, gap: 2 },
  txTitle: { fontSize: 14, fontWeight: '700', color: t.text },
  txMeta: { fontSize: 12, color: t.textMuted, fontWeight: '500' },
  txStatus: { fontSize: 11, fontWeight: '700' },
  txPending: { color: '#0284c7' },
  txSuccess: { color: '#16a34a' },
  txCancelled: { color: '#dc2626' },
  txFailed: { color: '#dc2626' },
  txAmount: { fontSize: 14, fontWeight: '800' },
  txAmountPlus: { color: t.primary },
  txAmountMinus: { color: t.danger },
});
