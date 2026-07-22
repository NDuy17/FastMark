import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import StarRating from '../../store/components/StarRating';

function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('vi-VN');
}

function getReviewImages(review) {
  if (Array.isArray(review?.images) && review.images.length > 0) {
    return review.images
      .map((image) => image.imageUrl || image.ImageUrl || image)
      .filter((uri) => typeof uri === 'string' && uri);
  }
  const single = review?.imageUrl || review?.image_url || '';
  return single ? [single] : [];
}

export default function MyReviewDetailModal({
  visible,
  review,
  onClose,
  onDelete,
}) {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 12);

  if (!review) {
    return null;
  }

  const images = getReviewImages(review);

  function handleMenuPress() {
    Alert.alert('Gỡ bỏ đánh giá', 'Bạn có chắc muốn gỡ đánh giá này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Gỡ bỏ',
        style: 'destructive',
        onPress: () => onDelete?.(review),
      },
    ]);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: bottomInset }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Đánh giá của bạn</Text>
            {review.id ? (
              <Pressable
                onPress={handleMenuPress}
                style={({ pressed }) => [styles.menuBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Gỡ bỏ đánh giá"
                hitSlop={8}
              >
                <Ionicons name="ellipsis-vertical" size={18} color="#0f172a" />
              </Pressable>
            ) : (
              <View style={styles.menuBtnSpacer} />
            )}
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.reviewCard}>
              <View style={styles.ratingRow}>
                <StarRating rating={Number(review.rating) || 0} size={16} />
                <Text style={styles.date}>{formatDateTime(review.createdAt || review.created_at)}</Text>
              </View>
              {review.comment ? (
                <Text style={styles.comment}>{review.comment}</Text>
              ) : (
                <Text style={styles.commentMuted}>Không có nội dung.</Text>
              )}
              {images.length > 0 ? (
                <View style={styles.imagesRow}>
                  {images.map((uri, index) => (
                    <Image
                      key={`${review.id}-img-${index}`}
                      source={{ uri }}
                      style={styles.image}
                      resizeMode="cover"
                    />
                  ))}
                </View>
              ) : null}
            </View>
          </ScrollView>

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Đóng</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#cbd5e1',
    paddingHorizontal: 16,
    paddingTop: 14,
    maxHeight: '78%',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  menuBtnSpacer: {
    width: 36,
    height: 36,
  },
  pressed: { opacity: 0.75 },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    paddingBottom: 8,
  },
  reviewCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  date: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  comment: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 21,
    color: '#334155',
  },
  commentMuted: {
    marginTop: 12,
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  imagesRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  image: {
    width: 96,
    height: 96,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
  },
  closeBtn: {
    marginTop: 12,
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  closeBtnText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '800',
  },
});
