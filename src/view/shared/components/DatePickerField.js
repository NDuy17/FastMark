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

import { formatDateString, formatIsoDateString, parseDateString } from '../../../core/utils/dateFormat';

export default function DatePickerField({
  label,
  value,
  onChange,
  placeholder = '16/07/2026',
  minimumDate,
  valueFormat = 'dmy',
  disabled = false,
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [draftDate, setDraftDate] = useState(() => parseDateString(value, new Date()));
  const formatValue = valueFormat === 'iso' ? formatIsoDateString : formatDateString;
  const displayPlaceholder =
    valueFormat === 'iso' && placeholder === '16/07/2026' ? '2026-07-16' : placeholder;
  const hasValue = Boolean(String(value || '').trim());
  const displayValue = hasValue
    ? formatDateString(parseDateString(value, new Date()))
    : displayPlaceholder;
  const pickerDate = useMemo(() => parseDateString(value, new Date()), [value]);

  useEffect(() => {
    if (!showPicker) {
      setDraftDate(parseDateString(value, new Date()));
    }
  }, [showPicker, value]);

  function openPicker() {
    if (disabled) return;
    setDraftDate(parseDateString(value, new Date()));
    setShowPicker(true);
  }

  function closePicker() {
    setShowPicker(false);
  }

  function confirmPicker() {
    onChange(formatValue(draftDate));
    closePicker();
  }

  function handleAndroidChange(event, selectedDate) {
    closePicker();
    if (event.type === 'dismissed' || !selectedDate) {
      return;
    }
    onChange(formatValue(selectedDate));
  }

  function handleIosChange(_event, selectedDate) {
    if (selectedDate) {
      setDraftDate(selectedDate);
    }
  }

  if (Platform.OS === 'web') {
    return (
      <View style={styles.field}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={displayPlaceholder}
          placeholderTextColor="#94a3b8"
          style={[styles.webInput, disabled && styles.disabled]}
          editable={!disabled}
        />
      </View>
    );
  }

  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        onPress={openPicker}
        disabled={disabled}
        style={({ pressed }) => [
          styles.dateButton,
          disabled && styles.disabled,
          pressed && !disabled && styles.dateButtonPressed,
        ]}
      >
        <Text style={[styles.dateValue, !hasValue && styles.datePlaceholder]}>
          {displayValue}
        </Text>
        <View style={styles.dateButtonIconWrap}>
          <Ionicons name="calendar-outline" size={20} color="#076F32" />
        </View>
      </Pressable>

      {Platform.OS === 'android' && showPicker ? (
        <DateTimePicker
          value={pickerDate}
          mode="date"
          display="calendar"
          minimumDate={minimumDate}
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
                <Text style={styles.modalTitle}>{label || 'Chọn ngày'}</Text>
                <Pressable onPress={confirmPicker} hitSlop={8}>
                  <Text style={[styles.modalActionText, styles.modalActionPrimary]}>Xong</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={draftDate}
                mode="date"
                display="spinner"
                minimumDate={minimumDate}
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
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 6,
  },
  dateButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateButtonPressed: {
    opacity: 0.85,
  },
  dateValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  datePlaceholder: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.55,
  },
  dateButtonIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E6F4EC',
    alignItems: 'center',
    justifyContent: 'center',
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
