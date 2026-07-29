import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import KeyboardAwareTextInput from './KeyboardAwareTextInput';

export const ADMIN_APPEAL_MAX_IMAGES = 5;

async function assetToDataUri(asset) {
  const mimeType = asset?.mimeType || 'image/jpeg';
  if (asset?.base64) {
    return `data:${mimeType};base64,${asset.base64}`;
  }
  return '';
}

async function assetsToDataUris(assets = []) {
  const results = [];
  for (const asset of assets) {
    const dataUri = await assetToDataUri(asset);
    if (dataUri) {
      results.push(dataUri);
    }
  }
  return results;
}

export default function AdminAppealCompose({
  contentLabel = 'Nội dung khiếu nại',
  contentPlaceholder = 'Mô tả chi tiết vấn đề...',
  submitLabel = 'Gửi khiếu nại',
  cancelLabel = 'Hủy',
  showCancel = true,
  maxImages = ADMIN_APPEAL_MAX_IMAGES,
  onCancel,
  onSubmit,
}) {
  const [content, setContent] = useState('');
  const [imageUris, setImageUris] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  async function pickFromLibrary() {
    const remaining = maxImages - imageUris.length;
    if (remaining <= 0) {
      Alert.alert('Giới hạn ảnh', `Tối đa ${maxImages} ảnh.`);
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Thông báo', 'Cần quyền thư viện ảnh để đính kèm.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.55,
      base64: true,
    });
    if (result.canceled || !result.assets?.length) {
      return;
    }
    const next = await assetsToDataUris(result.assets);
    if (!next.length) {
      Alert.alert('Lỗi ảnh', 'Không đọc được ảnh. Vui lòng chọn lại.');
      return;
    }
    setImageUris((current) => [...current, ...next].slice(0, maxImages));
  }

  async function pickFromCamera() {
    if (imageUris.length >= maxImages) {
      Alert.alert('Giới hạn ảnh', `Tối đa ${maxImages} ảnh.`);
      return;
    }
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Thông báo', 'Cần quyền camera để chụp ảnh.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.55,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]) {
      return;
    }
    const next = await assetsToDataUris([result.assets[0]]);
    if (!next.length) {
      Alert.alert('Lỗi ảnh', 'Không đọc được ảnh. Vui lòng chụp lại.');
      return;
    }
    setImageUris((current) => [...current, ...next].slice(0, maxImages));
  }

  function handleAddPhoto() {
    Alert.alert('Thêm ảnh bằng chứng', 'Chọn nguồn ảnh', [
      { text: 'Chụp ảnh', onPress: () => pickFromCamera() },
      { text: 'Thư viện', onPress: () => pickFromLibrary() },
      { text: 'Hủy', style: 'cancel' },
    ]);
  }

  async function handleSubmit() {
    const trimmed = content.trim();
    if (!trimmed) {
      Alert.alert('Thiếu nội dung', 'Vui lòng nhập nội dung khiếu nại.');
      return;
    }
    const validImages = imageUris.filter((uri) => String(uri || '').startsWith('data:image/'));
    if (imageUris.length > 0 && validImages.length === 0) {
      Alert.alert('Lỗi ảnh', 'Ảnh đính kèm không hợp lệ. Vui lòng chọn lại.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit?.({ content: trimmed, images: validImages });
      setContent('');
      setImageUris([]);
    } catch (error) {
      Alert.alert('Không gửi được', error.message || 'Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.form}>
      <Text style={styles.label}>{contentLabel}</Text>
      <KeyboardAwareTextInput
        style={styles.input}
        multiline
        value={content}
        onChangeText={setContent}
        placeholder={contentPlaceholder}
        placeholderTextColor="#94a3b8"
        textAlignVertical="top"
      />
      <Text style={styles.label}>Ảnh bằng chứng (tối đa {maxImages})</Text>
      <View style={styles.imageRow}>
        {imageUris.map((uri, index) => (
          <Pressable
            key={`${index}-${uri.slice(0, 24)}`}
            onPress={() => setImageUris((current) => current.filter((_, i) => i !== index))}
          >
            <Image source={{ uri }} style={styles.thumb} />
          </Pressable>
        ))}
        {imageUris.length < maxImages ? (
          <Pressable style={styles.addThumb} onPress={handleAddPhoto}>
            <Ionicons name="camera-outline" size={22} color="#076F32" />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        style={[styles.primaryBtn, submitting && styles.btnDisabled]}
        disabled={submitting}
        onPress={handleSubmit}
      >
        <Text style={styles.primaryBtnText}>{submitting ? 'Đang gửi...' : submitLabel}</Text>
      </Pressable>
      {showCancel && onCancel ? (
        <Pressable style={styles.ghostBtn} onPress={onCancel} disabled={submitting}>
          <Text style={styles.ghostBtnText}>{cancelLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 10, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '700', color: '#334155' },
  input: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
    color: '#0f172a',
    fontSize: 14,
  },
  imageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: 64, height: 64, borderRadius: 10 },
  addThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#86efac',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fdf4',
  },
  primaryBtn: {
    backgroundColor: '#076F32',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnDisabled: { opacity: 0.6 },
  ghostBtn: { alignItems: 'center', paddingVertical: 10 },
  ghostBtnText: { color: '#64748b', fontWeight: '700' },
});
