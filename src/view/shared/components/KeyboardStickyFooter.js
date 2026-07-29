import { StyleSheet, View } from 'react-native';

import { useKeyboardInset } from '../../../hooks/useKeyboardInset';

/**
 * Footer cố định (nút hành động) nổi phía trên bàn phím.
 */
export default function KeyboardStickyFooter({ children, style, suppressHideRef }) {
  const { composerBottom, isKeyboardVisible, screenInsets } = useKeyboardInset({
    suppressHideRef,
  });

  return (
    <View
      style={[
        styles.footer,
        isKeyboardVisible ? { bottom: composerBottom } : styles.footerClosed,
        !isKeyboardVisible && { paddingBottom: Math.max(screenInsets.bottomSpacing, 12) },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 2,
    elevation: 8,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  footerClosed: {
    bottom: 0,
  },
});
