import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { getSellerShopSettingsOnBackend } from '../../api/sellerOpsApi';
import { fetchReviewsFromNode } from '../../api/storeNodeApi';
import { submitReportOnBackend } from '../../api/reportApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import ProfileSubScreen from '../profile/ProfileSubScreen';
import StarRating from '../store/components/StarRating';
import AvatarBadge from '../shared/components/AvatarBadge';
import ReportSheet from '../shared/components/ReportSheet';
import ReportComposeModal from '../shared/components/ReportComposeModal';

const REVIEW_REPORT_REASONS = [
  'Ngôn từ xúc phạm',
  'Đánh giá không đúng sự thật',
  'Thông tin sai lệch',
  'Spam / quảng cáo',
  'Khác',
];

function formatReviewDate(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString('vi-VN');
}

export default function SellerReviewsManageScreen({ onBack }) {
  const [reviews, setReviews] = useState([]);
  const [shopName, setShopName] = useState('');
  const [shopId, setShopId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportVisible, setReportVisible] = useState(false);
  const [composeVisible, setComposeVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportingReview, setReportingReview] = useState(null);

  const loadReviews = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        throw new Error('Phiên đăng nhập đã hết hạn.');
      }

      const shop = await getSellerShopSettingsOnBackend(idToken);
      const nextShopId = shop?.id || shop?.shopId;
      setShopName(shop?.shopName || 'Gian hàng');
      setShopId(nextShopId ? String(nextShopId) : '');

      if (!nextShopId) {
        setReviews([]);
        return;
      }

      const data = await fetchReviewsFromNode(nextShopId);
      setReviews(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(loadError.message || 'Không tải được đánh giá.');
      setReviews([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  function openReport(review) {
    setReportingReview(review);
    setReportVisible(true);
  }

  function handleReportReason(reason) {
    setReportVisible(false);
    setReportReason(reason);
    setComposeVisible(true);
  }

  async function handleReportComposeSubmit({ title, content, images }) {
    const review = reportingReview;
    if (!review?.id && !review?._id) {
      Alert.alert('Lỗi', 'Không xác định được đánh giá cần báo cáo.');
      return;
    }

    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        Alert.alert('Thông báo', 'Vui lòng đăng nhập để gửi báo cáo.');
        return;
      }

      const reviewerName =
        review.userName || review.user_name || review.fullName || review.buyerName || 'Khách hàng';

      await submitReportOnBackend({
        idToken,
        reportType: 1,
        reviewId: String(review.id || review._id),
        reviewerName,
        shopId: review.shopId || review.storeId || shopId,
        shopName,
        title,
        content,
        images,
      });

      setComposeVisible(false);
      setReportReason('');
      setReportingReview(null);
      Alert.alert('Đã gửi báo cáo', 'Cảm ơn bạn. Chúng tôi đã ghi nhận tố cáo.');
    } catch (submitError) {
      Alert.alert('Không gửi được báo cáo', submitError.message || 'Vui lòng thử lại sau.');
    }
  }

  return (
    <ProfileSubScreen title="Quản lý đánh giá" onBack={onBack}>
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#076F32" size="large" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={loadReviews} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(item, index) => String(item.id || item._id || index)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Chưa có đánh giá</Text>
              <Text style={styles.emptyText}>
                Khi khách để lại đánh giá cho {shopName || 'gian hàng'}, chúng sẽ hiện tại đây.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const name = item.userName || item.fullName || item.buyerName || 'Khách hàng';
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <AvatarBadge
                    name={name}
                    uri={item.avatar || item.photoUrl || ''}
                    size={40}
                  />
                  <View style={styles.cardHeaderInfo}>
                    <Text style={styles.reviewerName} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={styles.reviewDate}>{formatReviewDate(item.createdAt)}</Text>
                  </View>
                  <StarRating rating={item.rating} size={13} />
                  <Pressable
                    onPress={() => openReport(item)}
                    style={({ pressed }) => [styles.menuBtn, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel="Báo cáo đánh giá"
                    hitSlop={8}
                  >
                    <Ionicons name="ellipsis-vertical" size={18} color="#64748b" />
                  </Pressable>
                </View>
                {item.comment ? (
                  <Text style={styles.comment}>{item.comment}</Text>
                ) : (
                  <Text style={styles.commentMuted}>Không có nội dung.</Text>
                )}
                {Array.isArray(item.images) && item.images.length > 0 ? (
                  <View style={styles.reviewImagesRow}>
                    {item.images.map((image, index) => {
                      const uri = image.imageUrl || image.ImageUrl || image;
                      if (!uri || typeof uri !== 'string') return null;
                      return (
                        <Image
                          key={`${item.id}-img-${index}`}
                          source={{ uri }}
                          style={styles.reviewImage}
                          resizeMode="cover"
                        />
                      );
                    })}
                  </View>
                ) : item.imageUrl || item.image_url ? (
                  <Image
                    source={{ uri: item.imageUrl || item.image_url }}
                    style={styles.reviewImage}
                    resizeMode="cover"
                  />
                ) : null}
              </View>
            );
          }}
        />
      )}

      <ReportSheet
        visible={reportVisible}
        title="Báo cáo đánh giá"
        reasons={REVIEW_REPORT_REASONS}
        onClose={() => {
          setReportVisible(false);
          setReportingReview(null);
        }}
        onSubmit={handleReportReason}
      />
      <ReportComposeModal
        visible={composeVisible}
        headerTitle="Chi tiết tố cáo đánh giá"
        reasonTitle={reportReason}
        onClose={() => {
          setComposeVisible(false);
          setReportReason('');
          setReportingReview(null);
        }}
        onSubmit={handleReportComposeSubmit}
      />
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  listContent: { paddingBottom: 8, gap: 10 },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },
  errorText: { color: '#b91c1c', fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  retryButton: {
    minHeight: 42,
    borderRadius: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#076F32',
  },
  retryButtonText: { color: '#ffffff', fontWeight: '800' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardHeaderInfo: { flex: 1, minWidth: 0 },
  reviewerName: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  reviewDate: { fontSize: 12, color: '#94a3b8', marginTop: 2, fontWeight: '600' },
  menuBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  comment: { marginTop: 10, fontSize: 14, color: '#334155', lineHeight: 20 },
  commentMuted: { marginTop: 10, fontSize: 13, color: '#94a3b8', fontStyle: 'italic' },
  reviewImage: {
    width: 96,
    height: 96,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
  },
  reviewImagesRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
