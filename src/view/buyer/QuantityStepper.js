import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 1,
  disabled = false,
  compact = false,
}) {
  const safeMax = Math.max(0, Number(max) || 0);
  const safeMin = Math.max(1, Math.min(Number(min) || 1, safeMax || 1));
  const current = Math.max(safeMin, Math.min(Number(value) || safeMin, safeMax || safeMin));
  const canDecrease = !disabled && current > safeMin;
  const canIncrease = !disabled && safeMax > 0 && current < safeMax;

  function setValue(next) {
    if (disabled || safeMax <= 0) {
      return;
    }
    const clamped = Math.max(safeMin, Math.min(next, safeMax));
    onChange?.(clamped);
  }

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Pressable
        style={[styles.btn, compact && styles.btnCompact, !canDecrease && styles.btnDisabled]}
        onPress={() => setValue(current - 1)}
        disabled={!canDecrease}
        accessibilityRole="button"
        accessibilityLabel="Giảm số lượng"
      >
        <Text
          style={[
            styles.btnText,
            compact && styles.btnTextCompact,
            !canDecrease && styles.btnTextDisabled,
          ]}
        >
          −
        </Text>
      </Pressable>
      <Text style={[styles.value, compact && styles.valueCompact]}>
        {safeMax > 0 ? current : 0}
      </Text>
      <Pressable
        style={[styles.btn, compact && styles.btnCompact, !canIncrease && styles.btnDisabled]}
        onPress={() => setValue(current + 1)}
        disabled={!canIncrease}
        accessibilityRole="button"
        accessibilityLabel="Tăng số lượng"
      >
        <Text
          style={[
            styles.btnText,
            compact && styles.btnTextCompact,
            !canIncrease && styles.btnTextDisabled,
          ]}
        >
          +
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#E6F4EC',
    borderWidth: 1,
    borderColor: '#A7D9B8',
  },
  wrapCompact: {
    gap: 6,
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderRadius: 8,
  },
  btn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#076F32',
  },
  btnCompact: {
    width: 26,
    height: 26,
    borderRadius: 6,
  },
  btnDisabled: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  btnText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
  },
  btnTextCompact: {
    fontSize: 16,
    lineHeight: 18,
  },
  btnTextDisabled: {
    color: '#94a3b8',
  },
  value: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '900',
    color: '#076F32',
  },
  valueCompact: {
    minWidth: 22,
    fontSize: 14,
  },
});
