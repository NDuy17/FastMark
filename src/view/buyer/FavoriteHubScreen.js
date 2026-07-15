import { StyleSheet, View } from 'react-native';

import FavoriteProductsScreen from './FavoriteProductsScreen';

/** Yêu thích chỉ còn sản phẩm — theo dõi gian hàng dùng tính năng Follow. */
export default function FavoriteHubScreen({ onOpenProduct }) {
  return (
    <View style={styles.screen}>
      <FavoriteProductsScreen onOpenProduct={onOpenProduct} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f5f8f7',
  },
});
