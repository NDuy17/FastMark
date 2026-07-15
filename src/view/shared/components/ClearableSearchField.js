import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ClearableSearchField({
  value,
  onChangeText,
  placeholder,
  style,
  inputStyle,
  returnKeyType = 'search',
  onSubmitEditing,
  autoCapitalize = 'none',
  autoCorrect = false,
}) {
  const hasValue = String(value || '').length > 0;

  return (
    <View style={[styles.searchWrap, style]}>
      <Ionicons name="search" size={18} color="#94a3b8" style={styles.searchIcon} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        style={[styles.searchInput, inputStyle]}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
      />
      {hasValue ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Xóa tìm kiếm"
          hitSlop={8}
          onPress={() => onChangeText?.('')}
          style={styles.clearButton}
        >
          <Ionicons name="close-circle" size={20} color="#94a3b8" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1f2937',
    paddingVertical: 12,
  },
  clearButton: {
    marginLeft: 6,
    padding: 2,
  },
});
