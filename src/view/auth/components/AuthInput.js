import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useKeyboardScroll } from '../../shared/components/KeyboardAwareScrollView';
import { AUTH_COLORS } from './authTheme';

export default function AuthInput({
  label,
  icon: _icon,
  rightLabel,
  onRightLabelPress,
  secureTextEntry = false,
  error = '',
  onFocus,
  ...props
}) {
  const [hidden, setHidden] = useState(Boolean(secureTextEntry));
  const inputRef = useRef(null);
  const keyboardScroll = useKeyboardScroll();

  function handleFocus(event) {
    onFocus?.(event);
    keyboardScroll?.scrollToInput?.(inputRef);
  }

  return (
    <View style={styles.field}>
      {rightLabel ? (
        <View style={styles.labelRow}>
          <Pressable onPress={onRightLabelPress} hitSlop={8}>
            <Text style={styles.rightLabel}>{rightLabel}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.inputWrap, error ? styles.inputWrapError : null]}>
        <TextInput
          {...props}
          ref={inputRef}
          onFocus={handleFocus}
          placeholder={label}
          secureTextEntry={hidden}
          placeholderTextColor="#6b7280"
          style={styles.input}
        />
        {secureTextEntry ? (
          <Pressable onPress={() => setHidden((v) => !v)} hitSlop={8} style={styles.eyeBtn}>
            <Ionicons
              name={hidden ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color="#94a3b8"
            />
          </Pressable>
        ) : null}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 2,
  },
  rightLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: AUTH_COLORS.primary,
  },
  inputWrap: {
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: AUTH_COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputWrapError: {
    borderBottomColor: '#dc2626',
  },
  errorText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#dc2626',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: AUTH_COLORS.text,
    paddingVertical: 12,
  },
  eyeBtn: {
    paddingLeft: 8,
  },
});
