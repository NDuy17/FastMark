import { StyleSheet, View } from 'react-native';

import KeyboardAwareScrollView from '../shared/components/KeyboardAwareScrollView';
import SubScreenHeader from '../shared/components/SubScreenHeader';

/**
 * @param {object} props
 * @param {boolean} [props.scroll=true] — false khi children tự scroll (FlatList), tránh nested VirtualizedList.
 */
export default function ProfileSubScreen({
  title,
  onBack,
  embedded = false,
  scroll = true,
  refreshControl,
  children,
}) {
  return (
    <View style={styles.screen}>
      <SubScreenHeader title={title} onBack={onBack} />
      {scroll ? (
        <KeyboardAwareScrollView
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          {children}
        </KeyboardAwareScrollView>
      ) : (
        <View style={[styles.bodyFlex, styles.bodyContent]}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  bodyContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  bodyFlex: {
    flex: 1,
    minHeight: 0,
  },
});
