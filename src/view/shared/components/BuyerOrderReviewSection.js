import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import StarRating from '../../store/components/StarRating';

function formatDateTime(iso) {
  if (!iso) {
    return '';
  }
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

export default function BuyerOrderReviewSection({
  review,
  onDelete,
  disabled = false,
}) {
  if (!review?.id) {
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
    <View style={styles.section}>
      <View style={styles.divider} />
      <View style={styles.headingRow}>
        <Text style={styles.heading}>ĐÁNH GIÁ CỦA BẠN</Text>
        <Pressable
          style={styles.menuBtn}
          disabled={disabled}
          onPress={handleMenuPress}
          accessibilityRole="button"
          accessibilityLabel="Gỡ bỏ đánh giá"
          hitSlop={8}
        >
          <Ionicons name="ellipsis-vertical" size={18} color="#64748b" />
        </Pressable>
      </View>

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
        {images.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photos}>
            {images.map((uri, index) => (
              <Image
                key={`${review.id}-img-${index}`}
                source={{ uri }}
                style={styles.photo}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 14,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  heading: {
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.3,
  },
  menuBtn: {
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  reviewCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
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
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: '#334155',
    fontWeight: '600',
  },
  commentMuted: {
    marginTop: 8,
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  photos: {
    marginTop: 8,
  },
  photo: {
    width: 72,
    height: 72,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#e2e8f0',
  },
});
