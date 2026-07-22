import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { Ionicons } from '@expo/vector-icons';
import {
  confirmSellerReservationOnBackend,
  getReservationDisputeReportsOnBackend,
  getSellerReservationDetailOnBackend,
  rejectSellerReservationOnBackend,
  reportBuyerNoShowOnBackend,
} from '../../api/sellerOpsApi';
import {
  RESERVATION_DISPUTE_REASON_LABELS,
  RESERVATION_STATUS,
  RESERVATION_STATUS_LABELS,
  getCancelledReservationReason,
} from '../../constants/sellerOrders';
import { formatPrice } from '../../core/utils/productFormat';
import { formatOrderCode } from '../../core/utils/orderCode';
import AvatarBadge from '../shared/components/AvatarBadge';
import DisputeLocationMeta from '../shared/components/DisputeLocationMeta';
import ReservationDisputeModal from '../shared/components/ReservationDisputeModal';
import ProfileSubScreen from '../profile/ProfileSubScreen';

function formatDepositLine(reservation) {
  const amount = Number(reservation.depositAmount) || 0;
  if (amount <= 0) {
    return null;
  }
  const settleTo = Number(reservation.depositSettleTo);
  if (
    settleTo === 2 ||
    reservation.depositReleasedAt ||
    reservation.depositReleasedToSellerAt
  ) {
    return `Đã nhận cọc ${formatPrice(amount)}`;
  }
  if (settleTo === 1 || reservation.depositRefundedAt) {
    return `Đã hoàn cọc ${formatPrice(amount)}`;
  }
  if (Number(reservation.status) === RESERVATION_STATUS.DISPUTED) {
    return `Cọc đang giữ chờ admin ${formatPrice(amount)}`;
  }
  return `Cọc đang giữ ${formatPrice(amount)}`;
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN');
}

function isPastPickup(item, now) {
  if (!item?.pickupTime) return false;
  const pickup = new Date(item.pickupTime);
  return Number.isFinite(pickup.getTime()) && now >= pickup.getTime();
}

export default function SellerOrderDetailScreen({ reservationId, onBack, onChanged }) {
  const [reservation, setReservation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [error, setError] = useState('');
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReports, setDisputeReports] = useState([]);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const loadDisputeReports = useCallback(async () => {
    try {
      const idToken = await getCurrentUserIdToken();
      const reports = await getReservationDisputeReportsOnBackend(idToken, reservationId);
      setDisputeReports(Array.isArray(reports) ? reports : []);
    } catch {
      setDisputeReports([]);
    }
  }, [reservationId]);

  const loadDetail = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const idToken = await getCurrentUserIdToken();
      const data = await getSellerReservationDetailOnBackend(idToken, reservationId);
      setReservation(data);
      await loadDisputeReports();
    } catch (loadError) {
      setError(loadError.message || 'Không tải được chi tiết đơn.');
    } finally {
      setIsLoading(false);
    }
  }, [reservationId, loadDisputeReports]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    const pickupAt = new Date(reservation?.pickupTime).getTime();
    if (!Number.isFinite(pickupAt) || pickupAt <= currentTime) {
      return undefined;
    }
    const timer = setTimeout(
      () => setCurrentTime(Date.now()),
      Math.min(pickupAt - currentTime + 50, 2_147_483_647)
    );
    return () => clearTimeout(timer);
  }, [reservation?.pickupTime, currentTime]);

  async function runAction(action) {
    setIsActing(true);
    try {
      const idToken = await getCurrentUserIdToken();
      let updated;
      if (action === 'confirm') {
        updated = await confirmSellerReservationOnBackend(idToken, reservationId);
      } else if (action === 'reject') {
        updated = await rejectSellerReservationOnBackend({
          idToken,
          reservationId,
          reason: 'Shop hủy',
        });
      }
      setReservation(updated);
      onChanged?.();
    } catch (actionError) {
      Alert.alert('Lỗi', actionError.message || 'Không thực hiện được thao tác.');
    } finally {
      setIsActing(false);
    }
  }

  function handleConfirm() {
    const depositNote =
      Number(reservation?.depositAmount) > 0
        ? `\n\nSau khi đồng ý, đưa QR gian hàng cho khách quét khi nhận hàng. Khi đó bạn nhận cọc ${formatPrice(reservation.depositAmount)}.`
        : '\n\nSau khi đồng ý, đưa QR gian hàng cho khách quét khi nhận hàng để hoàn tất đơn.';
    Alert.alert('Đồng ý giữ hàng', `Bạn xác nhận giữ hàng cho khách này?${depositNote}`, [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Đồng ý', onPress: () => runAction('confirm') },
    ]);
  }

  function handleReject() {
    Alert.alert('Từ chối giữ hàng', 'Bạn chắc chắn từ chối yêu cầu giữ hàng này?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Từ chối',
        style: 'destructive',
        onPress: () => runAction('reject'),
      },
    ]);
  }

  function handleCallBuyer() {
    const phone = reservation?.buyer?.phone;
    if (!phone) {
      Alert.alert('Thông báo', 'Khách chưa có số điện thoại.');
      return;
    }
    Linking.openURL(`tel:${String(phone).replace(/\s/g, '')}`);
  }

  async function handleSubmitBuyerNoShow(payload) {
    setIsActing(true);
    try {
      const idToken = await getCurrentUserIdToken();
      const result = await reportBuyerNoShowOnBackend({
        idToken,
        reservationId,
        title: payload.title,
        description: payload.description,
        note: payload.note,
        latitude: payload.latitude,
        longitude: payload.longitude,
        address: payload.address,
        images: payload.images,
      });
      setReservation(result?.reservation || result);
      setShowDisputeModal(false);
      await loadDisputeReports();
      onChanged?.();
      Alert.alert('Đã gửi', 'Đã báo cáo người mua không đến. Cọc đang giữ chờ admin.');
    } catch (actionError) {
      Alert.alert('Lỗi', actionError.message || 'Không gửi được báo cáo.');
      throw actionError;
    } finally {
      setIsActing(false);
    }
  }

  if (isLoading) {
    return (
      <ProfileSubScreen title="Chi tiết đơn giữ hàng" onBack={onBack}>
        <View style={styles.centered}>
          <ActivityIndicator color="#076F32" size="large" />
        </View>
      </ProfileSubScreen>
    );
  }

  if (!reservation) {
    return (
      <ProfileSubScreen title="Chi tiết đơn giữ hàng" onBack={onBack}>
        <Text style={styles.errorText}>{error || 'Không tìm thấy đơn.'}</Text>
      </ProfileSubScreen>
    );
  }

  const canConfirm = reservation.status === RESERVATION_STATUS.PENDING_SELLER_CONFIRMATION;
  const pastPickup = isPastPickup(reservation, currentTime);
  const canReportBuyer =
    reservation.canReportBuyer === true ||
    ((reservation.status === RESERVATION_STATUS.WAITING_PICKUP ||
      reservation.status === RESERVATION_STATUS.DISPUTED) &&
      pastPickup &&
      !reservation.disputeBySeller);
  const buyerName = reservation.buyer?.fullName || 'Khách';
  const statusLabel = RESERVATION_STATUS_LABELS[reservation.status] || 'Không rõ';
  const depositLine = formatDepositLine(reservation);
  const cashDue = Math.max(
    0,
    (Number(reservation.totalAmount) || 0) - (Number(reservation.depositAmount) || 0)
  );
  const buyerReport = disputeReports.find((report) => report.reporterSide === 'buyer');
  const sellerReport = disputeReports.find((report) => report.reporterSide === 'seller');

  return (
    <ProfileSubScreen title="Chi tiết đơn giữ hàng" onBack={onBack}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Khách hàng</Text>
        <View style={styles.buyerRow}>
          <AvatarBadge name={buyerName} uri={reservation.buyer?.avatar || ''} size={48} />
          <Text style={styles.buyerName} numberOfLines={1}>
            {buyerName}
          </Text>
          <Pressable
            onPress={handleCallBuyer}
            style={({ pressed }) => [styles.callIconBtn, pressed && styles.callIconBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Gọi khách"
            hitSlop={8}
          >
            <Ionicons name="call" size={20} color="#076F32" />
          </Pressable>
        </View>

        <View style={styles.divider} />

        <View style={styles.orderMetaRow}>
          <Text style={styles.orderCode} numberOfLines={1}>
            {formatOrderCode(reservation.id || reservationId)}
          </Text>
          <Text style={styles.statusChip} numberOfLines={2}>
            {statusLabel}
          </Text>
        </View>

        <View style={styles.productRow}>
          <View style={styles.productThumbWrap}>
            {reservation.product?.thumbnail ? (
              <Image
                source={{ uri: reservation.product.thumbnail }}
                style={styles.productThumb}
              />
            ) : (
              <Text style={styles.productThumbEmoji}>📦</Text>
            )}
          </View>
          <View style={styles.productInfo}>
            <Text style={styles.value} numberOfLines={2}>
              {reservation.product?.productName || 'Sản phẩm'}
            </Text>
            {reservation.variant?.variantName ? (
              <Text style={styles.meta}>{reservation.variant.variantName}</Text>
            ) : null}
            <Text style={styles.meta}>Số lượng: {reservation.quantity}</Text>
            <Text style={styles.price}>Tổng tiền: {formatPrice(reservation.totalAmount)}</Text>
            {depositLine ? <Text style={styles.depositBadge}>{depositLine}</Text> : null}
            {Number(reservation.depositAmount) > 0 ? (
              <Text style={styles.cashDue}>Còn: {formatPrice(cashDue)}</Text>
            ) : null}
          </View>
        </View>
        {reservation.pickupTime ? (
          <Text style={styles.meta}>
            Giờ lấy hàng: {new Date(reservation.pickupTime).toLocaleString('vi-VN')}
          </Text>
        ) : null}
        {reservation.note ? <Text style={styles.meta}>Ghi chú: {reservation.note}</Text> : null}
        {getCancelledReservationReason(reservation) ? (
          <Text style={styles.meta}>
            Lý do hủy: {getCancelledReservationReason(reservation)}
          </Text>
        ) : null}
        {canConfirm ? (
          <Text style={styles.lockHint}>
            Sau khi đồng ý, đưa QR gian hàng cho khách quét khi nhận hàng để hoàn tất đơn
            {Number(reservation.depositAmount) > 0
              ? ` — khi đó bạn nhận cọc ${formatPrice(reservation.depositAmount)}`
              : ''}
            .
          </Text>
        ) : null}
        {reservation.status === RESERVATION_STATUS.WAITING_PICKUP ? (
          <Text style={styles.waitHint}>
            Đã xác nhận. Đưa QR gian hàng cho khách quét trên đơn của họ để hoàn tất.
          </Text>
        ) : null}
      </View>

      {buyerReport ? (
        <View style={styles.evidenceCard}>
          <Text style={styles.evidenceTitle}>Người mua đã tố cáo bạn không có mặt</Text>
          <Text style={styles.evidenceBody}>
            {buyerReport.reasonLabel ||
              RESERVATION_DISPUTE_REASON_LABELS[buyerReport.reason] ||
              buyerReport.title ||
              'Đã gửi báo cáo'}
          </Text>
          {buyerReport.content ? (
            <Text style={styles.evidenceBody}>{buyerReport.content}</Text>
          ) : null}
          {(buyerReport.latitude != null || buyerReport.address) ? (
            <DisputeLocationMeta
              latitude={buyerReport.latitude}
              longitude={buyerReport.longitude}
              address={buyerReport.address || ''}
              style={styles.evidenceMeta}
            />
          ) : null}
          <Text style={styles.evidenceMeta}>
            Lúc: {formatDateTime(buyerReport.createdAt)} · Cọc đang giữ chờ admin
          </Text>
          {Array.isArray(buyerReport.images) && buyerReport.images.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {buyerReport.images.map((image) => (
                <Image
                  key={image.id || image.imageUrl}
                  source={{ uri: image.imageUrl }}
                  style={styles.evidencePhoto}
                />
              ))}
            </ScrollView>
          ) : null}
        </View>
      ) : null}

      {sellerReport ? (
        <View style={styles.evidenceCardSelf}>
          <Text style={styles.evidenceTitle}>Báo cáo của bạn</Text>
          <Text style={styles.evidenceBody}>
            {sellerReport.sellerContent || sellerReport.content || 'Đã gửi báo cáo'}
          </Text>
          {(sellerReport.sellerLatitude != null ||
            sellerReport.latitude != null ||
            sellerReport.sellerAddress ||
            sellerReport.address) ? (
            <DisputeLocationMeta
              latitude={sellerReport.sellerLatitude ?? sellerReport.latitude}
              longitude={sellerReport.sellerLongitude ?? sellerReport.longitude}
              address={sellerReport.sellerAddress || sellerReport.address || ''}
              style={styles.evidenceMeta}
            />
          ) : null}
          <Text style={styles.evidenceMeta}>
            Lúc: {formatDateTime(sellerReport.createdAt)}
          </Text>
          {Array.isArray(sellerReport.images) && sellerReport.images.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {sellerReport.images.map((image) => (
                <Image
                  key={image.id || image.imageUrl}
                  source={{ uri: image.imageUrl }}
                  style={styles.evidencePhoto}
                />
              ))}
            </ScrollView>
          ) : null}
        </View>
      ) : null}

      <View style={styles.actionRow}>
        {canConfirm ? (
          <>
            <Pressable
              disabled={isActing}
              onPress={handleConfirm}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>Đồng ý</Text>
            </Pressable>
            <Pressable
              disabled={isActing}
              onPress={handleReject}
              style={styles.dangerBtn}
            >
              <Text style={styles.dangerBtnText}>Từ chối</Text>
            </Pressable>
          </>
        ) : null}
        {canReportBuyer ? (
          <Pressable
            disabled={isActing}
            onPress={() => setShowDisputeModal(true)}
            style={styles.reportBtn}
          >
            <Text style={styles.reportBtnText}>Báo cáo người mua không đến</Text>
          </Pressable>
        ) : null}
      </View>

      <ReservationDisputeModal
        visible={showDisputeModal}
        mode="seller"
        onClose={() => setShowDisputeModal(false)}
        onSubmit={handleSubmitBuyerNoShow}
      />
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', paddingVertical: 40 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  orderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  orderCode: {
    flexShrink: 0,
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  statusChip: {
    flex: 1,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '800',
    color: '#076F32',
  },
  buyerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  buyerName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  callIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E6F4EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callIconBtnPressed: {
    opacity: 0.8,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 12,
  },
  productRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  productThumbWrap: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  productThumb: { width: '100%', height: '100%' },
  productThumbEmoji: { fontSize: 28 },
  productInfo: { flex: 1, gap: 2 },
  value: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  meta: { fontSize: 13, color: '#64748b', marginTop: 2 },
  price: { fontSize: 15, fontWeight: '800', color: '#076F32', marginTop: 4 },
  depositBadge: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '800',
    color: '#b45309',
  },
  cashDue: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  lockHint: { color: '#b45309', fontSize: 12, fontWeight: '700', marginTop: 8 },
  waitHint: { color: '#076F32', fontSize: 12, fontWeight: '700', marginTop: 8 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  primaryBtn: {
    flex: 1,
    minWidth: '40%',
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#076F32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#ffffff', fontWeight: '800' },
  dangerBtn: {
    flex: 1,
    minWidth: '40%',
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBtnText: { color: '#b91c1c', fontWeight: '800' },
  reportBtn: {
    width: '100%',
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fdba74',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  reportBtnText: { color: '#c2410c', fontWeight: '800', textAlign: 'center' },
  evidenceCard: {
    backgroundColor: '#fef2f2',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: 12,
    gap: 6,
  },
  evidenceCardSelf: {
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 12,
    gap: 6,
  },
  evidenceTitle: { fontSize: 15, fontWeight: '900', color: '#0f172a' },
  evidenceBody: { fontSize: 13, color: '#334155', fontWeight: '600', lineHeight: 18 },
  evidenceMeta: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  evidencePhoto: {
    width: 72,
    height: 72,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#e2e8f0',
  },
  errorText: { color: '#b91c1c', fontWeight: '700', padding: 16 },
});
