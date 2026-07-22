import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { formatPrice } from '../../core/utils/productFormat';
import { buyerTheme as t } from '../../core/theme/buyerTheme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { WALLET_TX_STATUS } from '../../model/walletModel';
import { loadWalletTransactionsViewModel } from '../../viewmodel/wallet/walletViewModel';
import SubScreenHeader from '../shared/components/SubScreenHeader';
import WalletTransactionDetailScreen from './WalletTransactionDetailScreen';

function formatTxTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN');
}

export default function WalletTransactionsScreen({ onBack }) {
  const insets = useScreenInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await loadWalletTransactionsViewModel({ limit: 50 });
      setTransactions(data.transactions || []);
    } catch {
      setTransactions([]);
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
      <SubScreenHeader title="Lịch sử giao dịch" onBack={onBack} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={t.primary} />
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.nestedScrollPaddingBottom }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          ListEmptyComponent={<Text style={styles.empty}>Chưa có giao dịch.</Text>}
          renderItem={({ item }) => {
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
                onPress={() => setSelectedTransaction(item)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={[styles.icon, isCredit ? styles.iconPlus : styles.iconMinus]}>
                  <Ionicons
                    name={isCredit ? 'add' : 'remove'}
                    size={20}
                    color={isCredit ? t.primary : t.danger}
                  />
                </View>
                <View style={styles.body}>
                  <Text style={styles.title} numberOfLines={1}>
                    {item.description || item.typeLabel}
                  </Text>
                  <Text style={styles.meta}>{formatTxTime(item.createdAt)}</Text>
                  {statusText ? (
                    <Text
                      style={[
                        styles.status,
                        pending && styles.pending,
                        success && styles.success,
                        cancelled && styles.cancelled,
                        failed && styles.failed,
                      ]}
                    >
                      {statusText}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.amount, isCredit ? styles.plus : styles.minus]}>
                  {isCredit ? '+' : '-'}
                  {formatPrice(item.amount)}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16 },
  empty: { textAlign: 'center', color: t.textMuted, marginTop: 40, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  rowPressed: { backgroundColor: '#f8fafc' },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPlus: { backgroundColor: t.primarySoft },
  iconMinus: { backgroundColor: t.dangerSoft },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: '700', color: t.text },
  meta: { fontSize: 12, color: t.textMuted },
  status: { fontSize: 11, fontWeight: '700' },
  pending: { color: '#0284c7' },
  success: { color: '#16a34a' },
  cancelled: { color: '#dc2626' },
  failed: { color: '#dc2626' },
  amount: { fontSize: 14, fontWeight: '800' },
  plus: { color: t.primary },
  minus: { color: t.danger },
});
