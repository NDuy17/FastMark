import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useScreenInsets } from '../../hooks/useScreenInsets';
import SubScreenHeader from '../shared/components/SubScreenHeader';

export default function ProfileSubScreen({
  title,
  onBack,
  embedded = false,
  refreshControl,
  children,
}) {
  const insets = useScreenInsets();

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {embedded ? (
        <View style={styles.headerPlain}>
          <Text style={styles.titlePlain}>{title}</Text>
        </View>
      ) : (
        <SubScreenHeader title={title} onBack={onBack} />
      )}
      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, { paddingBottom: insets.nestedScrollPaddingBottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  headerPlain: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#f1f5f9',
  },
  titlePlain: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
});
