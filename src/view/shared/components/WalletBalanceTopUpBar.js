import { Pressable, StyleSheet, Text, View } from 'react-native';

import { buyerTheme as t } from '../../../core/theme/buyerTheme';
import { formatPrice } from '../../../core/utils/productFormat';

export default function WalletBalanceTopUpBar({ balance = 0, onTopUp }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        Số dư ví:{' '}
        <Text style={styles.balance}>{formatPrice(balance)}</Text>
      </Text>
      <Pressable
        style={({ pressed }) => [styles.topUpBtn, pressed && styles.topUpBtnPressed]}
        onPress={onTopUp}
      >
        <Text style={styles.topUpBtnText}>Nạp tiền</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  balance: {
    color: t.primary,
    fontWeight: '800',
  },
  topUpBtn: {
    borderRadius: 999,
    backgroundColor: t.primarySoft,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  topUpBtnPressed: {
    opacity: 0.88,
  },
  topUpBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: t.primaryDark,
  },
});
