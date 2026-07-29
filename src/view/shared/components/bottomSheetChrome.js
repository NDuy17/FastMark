import { Pressable, StyleSheet, View } from 'react-native';

/** Viền xanh cạnh trên bottom sheet — tách rõ khỏi nền mờ phía sau. */
export const BOTTOM_SHEET_BORDER = {
  borderTopWidth: 3,
  borderTopColor: '#076F32',
};

const handleStyles = StyleSheet.create({
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    marginBottom: 14,
  },
  handleCompact: {
    marginBottom: 10,
  },
});

const overlayStyles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
});

export function BottomSheetHandle({ compact = false, style }) {
  return (
    <View style={[handleStyles.handle, compact && handleStyles.handleCompact, style]} />
  );
}

/** Bấm vùng tối bên ngoài panel để đóng bottom sheet. */
export function BottomSheetDismissOverlay({ onClose, style, children }) {
  return (
    <Pressable
      style={[overlayStyles.root, style]}
      onPress={onClose}
      accessibilityRole="button"
      accessibilityLabel="Đóng"
    >
      {children}
    </Pressable>
  );
}

/** Panel bottom sheet — giữ touch bên trong, không kích hoạt đóng overlay. */
export function BottomSheetPanel({ style, children }) {
  return (
    <View style={style} onStartShouldSetResponder={() => true}>
      {children}
    </View>
  );
}
