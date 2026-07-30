import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function ListPaginationFooter({ loadingMore, hasMore, emptyLabel = '' }) {
  if (loadingMore) {
    return (
      <View style={styles.wrap}>
        <ActivityIndicator size="small" color="#076F32" />
      </View>
    );
  }

  if (!hasMore && emptyLabel) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.doneText}>{emptyLabel}</Text>
      </View>
    );
  }

  return <View style={styles.spacer} />;
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: {
    height: 8,
  },
  doneText: {
    fontSize: 12,
    color: '#8A8F98',
  },
});
