import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

import { formatTimeString, parseTimeString } from '../../../core/utils/timeFormat';

export default function TimePickerField({
  label,
  value,
  onChange,
  placeholder = '08:00',
  compact = false,
  style,
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [draftDate, setDraftDate] = useState(() => parseTimeString(value, placeholder));
  const displayValue = String(value || '').trim() || placeholder;
  const pickerDate = useMemo(
    () => parseTimeString(value, placeholder),
    [placeholder, value]
  );

  useEffect(() => {
    if (!showPicker) {
      setDraftDate(parseTimeString(value, placeholder));
    }
  }, [placeholder, showPicker, value]);

  function openPicker() {
    setDraftDate(parseTimeString(value, placeholder));
    setShowPicker(true);
  }

  function closePicker() {
    setShowPicker(false);
  }

  function confirmPicker() {
    onChange(formatTimeString(draftDate));
    closePicker();
  }

  function handleAndroidChange(event, selectedDate) {
    closePicker();
    if (event.type === 'dismissed' || !selectedDate) {
      return;
    }
    onChange(formatTimeString(selectedDate));
  }

  function handleIosChange(_event, selectedDate) {
    if (selectedDate) {
      setDraftDate(selectedDate);
    }
  }

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.field, compact && styles.fieldCompact, style]}>
        {label ? <Text style={[styles.label, compact && styles.labelCompact]}>{label}</Text> : null}
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          style={[styles.webInput, compact && styles.webInputCompact]}
        />
      </View>
    );
  }

  return (
    <View style={[styles.field, compact && styles.fieldCompact, style]}>
      {label ? <Text style={[styles.label, compact && styles.labelCompact]}>{label}</Text> : null}
      <Pressable
        onPress={openPicker}
        style={({ pressed }) => [
          styles.timeButton,
          compact && styles.timeButtonCompact,
          pressed && styles.timeButtonPressed,
        ]}
      >
        <Text style={[styles.timeValue, compact && styles.timeValueCompact]}>{displayValue}</Text>
        <View style={[styles.timeButtonIconWrap, compact && styles.timeButtonIconWrapCompact]}>
          <Ionicons name="time-outline" size={20} color="#076F32" />
        </View>
      </Pressable>

      {Platform.OS === 'android' && showPicker ? (
        <DateTimePicker
          value={pickerDate}
          mode="time"
          is24Hour
          display="clock"
          onChange={handleAndroidChange}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal visible={showPicker} transparent animationType="slide" onRequestClose={closePicker}>
          <Pressable style={styles.modalBackdrop} onPress={closePicker}>
            <Pressable style={styles.modalSheet} onPress={() => {}}>
              <View style={styles.modalHeader}>
                <Pressable onPress={closePicker} hitSlop={8}>
                  <Text style={styles.modalActionText}>Hủy</Text>
                </Pressable>
                <Text style={styles.modalTitle}>{label}</Text>
                <Pressable onPress={confirmPicker} hitSlop={8}>
                  <Text style={[styles.modalActionText, styles.modalActionPrimary]}>Xong</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={draftDate}
                mode="time"
                is24Hour
                display="spinner"
                onChange={handleIosChange}
                style={styles.iosPicker}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 12,
  },
  fieldCompact: {
    flex: 1,
    marginBottom: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  labelCompact: {
    fontSize: 11,
    color: '#64748b',
  },
  timeButton: {
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeButtonCompact: {
    minHeight: 48,
    borderWidth: 1,
  },
  timeButtonPressed: {
    opacity: 0.85,
  },
  timeValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.5,
  },
  timeValueCompact: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0,
  },
  timeButtonIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E6F4EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeButtonIconWrapCompact: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  webInput: {
    minHeight: 46,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  webInputCompact: {
    minHeight: 48,
    borderWidth: 1,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748b',
  },
  modalActionPrimary: {
    color: '#076F32',
  },
  iosPicker: {
    alignSelf: 'center',
  },
});
