import { StyleSheet, Text, View } from 'react-native';

import CircularBackButton from './CircularBackButton';

/**
 * Header màn phụ — giống Đăng ký người bán:
 * nút back tròn + title căn trái.
 */
export default function SubScreenHeader({ title, onBack }) {
  return (
    <View style={styles.header}>
      <CircularBackButton onPress={onBack} variant="plain" style={styles.backButton} />
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: '#f1f5f9',
  },
  backButton: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'left',
  },
});
