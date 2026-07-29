import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { submitReportOnBackend } from '../../../api/reportApi';
import { getCurrentUserIdToken } from '../../../repository/authRepository';
import ReportComposeModal from './ReportComposeModal';
import ReportSheet from './ReportSheet';
import StarRating from '../../store/components/StarRating';

const REVIEW_REPORT_REASONS = [
  'Ngôn từ xúc phạm',
  'Đánh giá không đúng sự thật',
  'Thông tin sai lệch',
  'Spam / quảng cáo',
  'Khác',
];

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

export default function SellerOrderReviewSection({
  review,
  shopId = '',
  shopName = '',
  buyerName = 'Khách hàng',
  disabled = false,
}) {
  const [reportVisible, setReportVisible] = useState(false);
  const [composeVisible, setComposeVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');

  if (!review?.id) {
    return null;
  }

  const images = getReviewImages(review);
  const reviewerName =
    review.userName || review.user_name || review.fullName || buyerName || 'Khách hàng';

  function handleMenuPress() {
    setReportVisible(true);
  }

  function handleReportReason(reason) {
    setReportVisible(false);
    setReportReason(reason);
    setComposeVisible(true);
  }

  async function handleReportComposeSubmit({ title, content, images: reportImages }) {
    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        Alert.alert('Thông báo', 'Vui lòng đăng nhập để gửi báo cáo.');
        return;
      }

      await submitReportOnBackend({
        idToken,
        reportType: 1,
        reviewId: String(review.id),
        reviewerName,
        shopId: review.shopId || review.storeId || shopId,
        shopName,
        title,
        content,
        images: reportImages,
      });

      setComposeVisible(false);
      setReportReason('');
      Alert.alert('Đã gửi báo cáo', 'Cảm ơn bạn. Chúng tôi đã ghi nhận tố cáo.');
    } catch (submitError) {
      Alert.alert('Không gửi được báo cáo', submitError.message || 'Vui lòng thử lại sau.');
    }
  }

  return (
    <>
      <View style={styles.section}>
        <View style={styles.divider} />
        <View style={styles.headingRow}>
          <Text style={styles.heading}>ĐÁNH GIÁ CỦA KHÁCH</Text>
          <Pressable
            style={styles.menuBtn}
            disabled={disabled}
            onPress={handleMenuPress}
            accessibilityRole="button"
            accessibilityLabel="Tố cáo đánh giá"
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

      <ReportSheet
        visible={reportVisible}
        title="Tố cáo đánh giá"
        reasons={REVIEW_REPORT_REASONS}
        onClose={() => setReportVisible(false)}
        onSubmit={handleReportReason}
      />
      <ReportComposeModal
        visible={composeVisible}
        headerTitle="Chi tiết tố cáo đánh giá"
        reasonTitle={reportReason}
        onClose={() => {
          setComposeVisible(false);
          setReportReason('');
        }}
        onSubmit={handleReportComposeSubmit}
      />
    </>
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
