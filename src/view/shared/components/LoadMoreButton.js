import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

function normalizeCount(value) {
  return Math.max(0, Number(value) || 0);
}

export default function LoadMoreButton({
  currentCount,
  totalCount,
  loading = false,
  onPress,
}) {
  const current = normalizeCount(currentCount);
  const total = Math.max(current, normalizeCount(totalCount));
  const hasMore = current < total;

  if (!hasMore) {
    return (
      <View style={styles.container}>
        <Text style={styles.doneText}>Đã hiển thị tất cả dữ liệu</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Xem thêm dữ liệu"
        disabled={loading}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          loading && styles.buttonDisabled,
          pressed && !loading && styles.buttonPressed,
        ]}
      >
        {loading ? (
          <>
            <ActivityIndicator size="small" color="#076F32" />
            <Text style={styles.buttonText}>Đang tải...</Text>
          </>
        ) : (
          <Text style={styles.buttonText}>Xem thêm</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  doneText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  button: {
    minWidth: 132,
    minHeight: 40,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#076F32',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonPressed: {
    backgroundColor: '#E6F4EC',
  },
  buttonText: {
    color: '#076F32',
    fontSize: 14,
    fontWeight: '800',
  },
});
