import { StyleSheet, Text, View } from 'react-native';

export const ORDER_TAB_EMPTY_MESSAGE = 'Chưa có đơn trong mục này';
export const ORDER_TAB_SEARCH_EMPTY_MESSAGE = 'Không tìm thấy đơn phù hợp.';

export default function OrderTabEmptyState({
  message = ORDER_TAB_EMPTY_MESSAGE,
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon} accessibilityLabel="Chưa có đơn">
        📦
      </Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 280,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  icon: {
    fontSize: 56,
    marginBottom: 16,
  },
  message: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 22,
  },
});
