import { StyleSheet, View } from 'react-native';

import SubScreenHeader from '../../shared/components/SubScreenHeader';
import KeyboardAwareScrollView from '../../shared/components/KeyboardAwareScrollView';
import { AUTH_COLORS } from './authTheme';

export default function AuthFormScreen({ title, onBack, children, contentContainerStyle }) {
  return (
    <View style={styles.screen}>
      <SubScreenHeader title={title} onBack={onBack} />
      <KeyboardAwareScrollView
        nestedScrollPadding={false}
        contentContainerStyle={[styles.content, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>{children}</View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AUTH_COLORS.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  body: {
    flexGrow: 1,
  },
});
