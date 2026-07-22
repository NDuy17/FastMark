import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import CircularBackButton from '../shared/components/CircularBackButton';
import { useScreenInsets } from '../../hooks/useScreenInsets';

function CategoryTile({ label, active, onPress }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.categoryTile,
        active && styles.categoryTileActive,
        pressed && styles.categoryTilePressed,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.categoryTileName, active && styles.categoryTileNameActive]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function ProductCategoriesScreen({
  categories,
  selectedCategoryId,
  onSelectCategory,
  onBack,
}) {
  const insets = useScreenInsets();

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.headerPaddingTop }]}>
        <CircularBackButton onPress={onBack} variant="plain" />
        <Text style={styles.headerTitle}>Tất cả danh mục</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          <CategoryTile
            label="Tất cả sản phẩm"
            active={!selectedCategoryId}
            onPress={() => onSelectCategory('')}
          />
          {categories.map((category) => (
            <CategoryTile
              key={category.id}
              label={category.categoryName}
              active={selectedCategoryId === category.id}
              onPress={() => onSelectCategory(category.id)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f7f6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 36,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryTile: {
    width: '47%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  categoryTileActive: {
    borderColor: '#076F32',
    backgroundColor: '#E6F4EC',
  },
  categoryTilePressed: {
    opacity: 0.9,
  },
  categoryTileName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
    lineHeight: 18,
  },
  categoryTileNameActive: {
    color: '#076F32',
  },
});
