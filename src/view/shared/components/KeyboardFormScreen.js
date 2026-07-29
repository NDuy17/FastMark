import { StyleSheet, View } from 'react-native';

import SubScreenHeader from './SubScreenHeader';
import KeyboardAwareScrollView from './KeyboardAwareScrollView';

/**
 * Màn form chuẩn: header + scroll có xử lý bàn phím.
 */
export default function KeyboardFormScreen({
  title,
  onBack,
  children,
  headerBelow,
  footer,
  footerHeight = 0,
  contentContainerStyle,
  nestedScrollPadding = true,
  backgroundColor = '#f1f5f9',
  scroll = true,
  refreshControl,
  suppressHideRef,
}) {
  return (
    <View style={[styles.screen, { backgroundColor }]}>
      <SubScreenHeader title={title} onBack={onBack} />
      {headerBelow}
      {scroll ? (
        <KeyboardAwareScrollView
          extraBottomInset={footer ? footerHeight : 0}
          nestedScrollPadding={nestedScrollPadding}
          contentContainerStyle={[styles.bodyContent, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          suppressHideRef={suppressHideRef}
        >
          {children}
        </KeyboardAwareScrollView>
      ) : (
        <View style={[styles.bodyFlex, styles.bodyContent]}>{children}</View>
      )}
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
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
