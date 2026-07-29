import { View, StyleSheet, Text } from 'react-native';

import SellerPostForm from '../home/SellerPostForm';
import SubScreenHeader from '../shared/components/SubScreenHeader';

export default function SellerPostTabScreen({ onBack, onProductCreated, onProductChanged }) {
  return (
    <View style={styles.screen}>
      <SubScreenHeader title="Đăng tin" onBack={onBack} />
      <Text style={styles.subtitle}>Tạo sản phẩm mới cho gian hàng của bạn</Text>
      <SellerPostForm
        onProductCreated={(productId) => {
          onProductChanged?.();
          onProductCreated?.(productId);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f7f6',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: '#ffffff',
  },
});
