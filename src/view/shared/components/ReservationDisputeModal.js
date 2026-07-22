import { useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

import {
  BUYER_DISPUTE_REASON_OPTIONS,
  RESERVATION_DISPUTE_REASON,
  RESERVATION_DISPUTE_REASON_LABELS,
} from '../../../constants/sellerOrders';
import { reverseGeocodeLocation } from '../../../viewmodel/map/mapViewModel';

const MAX_IMAGES = 5;

function assetToDataUri(asset) {
  if (asset?.base64) {
    const mimeType = asset.mimeType || 'image/jpeg';
    return `data:${mimeType};base64,${asset.base64}`;
  }
  return asset?.uri || '';
}

async function captureCurrentLocation() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Cần quyền vị trí để gửi báo cáo có tọa độ GPS.');
  }
  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const latitude = Number(position?.coords?.latitude);
  const longitude = Number(position?.coords?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('Không lấy được tọa độ GPS. Vui lòng thử lại.');
  }
  return { latitude, longitude };
}

/**
 * mode: 'buyer' | 'seller'
 */
export default function ReservationDisputeModal({
  visible,
  mode = 'buyer',
  onClose,
  onSubmit,
}) {
  const isBuyer = mode === 'buyer';
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [imageUris, setImageUris] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setReason(isBuyer ? RESERVATION_DISPUTE_REASON.SELLER_ABSENT : '');
      setNote('');
      setImageUris([]);
      setIsSubmitting(false);
    }
  }, [visible, isBuyer]);

  async function pickFromLibrary() {
    const remaining = MAX_IMAGES - imageUris.length;
    if (remaining <= 0) {
      Alert.alert('Giới hạn ảnh', `Tối đa ${MAX_IMAGES} ảnh chứng cứ.`);
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Thông báo', 'Cần quyền thư viện ảnh để đính kèm chứng cứ.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets?.length) {
      return;
    }
    const next = result.assets.map(assetToDataUri).filter(Boolean);
    setImageUris((current) => [...current, ...next].slice(0, MAX_IMAGES));
  }

  async function pickFromCamera() {
    if (imageUris.length >= MAX_IMAGES) {
      Alert.alert('Giới hạn ảnh', `Tối đa ${MAX_IMAGES} ảnh chứng cứ.`);
      return;
    }
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Thông báo', 'Cần quyền camera để chụp ảnh chứng cứ.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]) {
      return;
    }
    const uri = assetToDataUri(result.assets[0]);
    if (!uri) {
      return;
    }
    setImageUris((current) => [...current, uri].slice(0, MAX_IMAGES));
  }

  function handleAddPhoto() {
    Alert.alert('Thêm ảnh chứng cứ', 'Chọn nguồn ảnh', [
      { text: 'Chụp ảnh', onPress: () => pickFromCamera() },
      { text: 'Thư viện', onPress: () => pickFromLibrary() },
      { text: 'Hủy', style: 'cancel' },
    ]);
  }

  function removeImage(index) {
    setImageUris((current) => current.filter((_, imageIndex) => imageIndex !== index));
  }

  async function handleSubmit() {
    if (isBuyer && !reason) {
      Alert.alert('Thiếu lý do', 'Vui lòng chọn lý do báo cáo.');
      return;
    }
    const trimmedNote = note.trim();
    if (isBuyer && reason === RESERVATION_DISPUTE_REASON.OTHER && !trimmedNote) {
      Alert.alert('Thiếu mô tả', 'Vui lòng nhập giải thích khi chọn lý do Khác.');
      return;
    }
    if (!isBuyer && !trimmedNote) {
      Alert.alert('Thiếu mô tả', 'Vui lòng nhập ghi chú báo cáo người mua không đến.');
      return;
    }
    if (!imageUris.length) {
      Alert.alert('Thiếu ảnh', 'Vui lòng đính kèm ít nhất 1 ảnh chứng cứ.');
      return;
    }

    setIsSubmitting(true);
    try {
      const coords = await captureCurrentLocation();
      let address = '';
      try {
        address = (await reverseGeocodeLocation(coords.latitude, coords.longitude)) || '';
      } catch {
        address = '';
      }
      await onSubmit?.({
        reason: isBuyer ? reason : RESERVATION_DISPUTE_REASON.BUYER_NO_SHOW,
        description: trimmedNote,
        note: trimmedNote,
        title: isBuyer
          ? RESERVATION_DISPUTE_REASON_LABELS[reason]
          : 'Người mua không đến nhận hàng',
        images: imageUris,
        latitude: coords.latitude,
        longitude: coords.longitude,
        address,
      });
    } catch (error) {
      Alert.alert('Không gửi được báo cáo', error.message || 'Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.title}>
              {isBuyer ? 'Báo cáo người bán' : 'Báo cáo người mua không đến'}
            </Text>
            <Text style={styles.subtitle}>
              Gửi ảnh chứng cứ và vị trí GPS. Tiền cọc sẽ được giữ chờ admin xử lý.
            </Text>

            {isBuyer ? (
              <View style={styles.reasonBlock}>
                <Text style={styles.label}>Lý do</Text>
                {BUYER_DISPUTE_REASON_OPTIONS.map((option) => {
                  const selected = reason === option;
                  return (
                    <Pressable
                      key={option}
                      style={[styles.reasonChip, selected && styles.reasonChipActive]}
                      onPress={() => setReason(option)}
                    >
                      <Text
                        style={[styles.reasonChipText, selected && styles.reasonChipTextActive]}
                      >
                        {RESERVATION_DISPUTE_REASON_LABELS[option]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <Text style={styles.label}>
              {isBuyer
                ? reason === RESERVATION_DISPUTE_REASON.OTHER
                  ? 'Giải thích lý do *'
                  : 'Ghi chú thêm (tuỳ chọn)'
                : 'Ghi chú *'}
            </Text>
            <TextInput
              style={styles.input}
              value={note}
              onChangeText={setNote}
              placeholder={
                isBuyer
                  ? 'Mô tả tình huống tại điểm nhận hàng...'
                  : 'Mô tả: người mua không đến nhận hàng...'
              }
              placeholderTextColor="#94a3b8"
              multiline
              textAlignVertical="top"
            />

            <View style={styles.photoHeader}>
              <Text style={styles.label}>Ảnh chứng cứ ({imageUris.length}/{MAX_IMAGES})</Text>
              <Pressable style={styles.addPhotoBtn} onPress={handleAddPhoto}>
                <Ionicons name="camera-outline" size={16} color="#076F32" />
                <Text style={styles.addPhotoText}>Thêm ảnh</Text>
              </Pressable>
            </View>
            {imageUris.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
                {imageUris.map((uri, index) => (
                  <View key={`${index}-${uri.slice(0, 24)}`} style={styles.photoWrap}>
                    <Image source={{ uri }} style={styles.photo} />
                    <Pressable style={styles.removePhoto} onPress={() => removeImage(index)}>
                      <Ionicons name="close" size={14} color="#ffffff" />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.hint}>Cần ít nhất 1 ảnh. Có thể chụp hoặc chọn từ thư viện.</Text>
            )}

            <View style={styles.actions}>
              <Pressable
                style={[styles.btn, styles.btnGhost]}
                onPress={onClose}
                disabled={isSubmitting}
              >
                <Text style={styles.btnGhostText}>Huỷ</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnPrimary, isSubmitting && styles.btnDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Gửi báo cáo</Text>
                )}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    lineHeight: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  reasonBlock: {
    gap: 8,
  },
  reasonChip: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
  },
  reasonChipActive: {
    borderColor: '#076F32',
    backgroundColor: '#E6F4EC',
  },
  reasonChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  reasonChipTextActive: {
    color: '#076F32',
  },
  input: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  photoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addPhotoText: {
    color: '#076F32',
    fontWeight: '800',
    fontSize: 13,
  },
  photoRow: {
    marginTop: 4,
  },
  photoWrap: {
    width: 72,
    height: 72,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 8,
    backgroundColor: '#e2e8f0',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  removePhoto: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(15,23,42,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  btn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: {
    backgroundColor: '#f1f5f9',
  },
  btnGhostText: {
    color: '#475569',
    fontWeight: '800',
  },
  btnPrimary: {
    backgroundColor: '#076F32',
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  btnDisabled: {
    opacity: 0.7,
  },
});
