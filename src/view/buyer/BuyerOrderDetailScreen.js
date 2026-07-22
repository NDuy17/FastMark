import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import CircularBackButton from '../shared/components/CircularBackButton';
import DisputeLocationMeta from '../shared/components/DisputeLocationMeta';
import ReservationDisputeModal from '../shared/components/ReservationDisputeModal';
import {
  cancelBuyerReservationOnBackend,
  forfeitBuyerDepositOnBackend,
  getBuyerReservationOnBackend,
  getReservationDisputeReportsOnBackend,
  reportBuyerReservationOnBackend,
} from '../../api/buyerOpsApi';
import {
  RESERVATION_DISPUTE_REASON_LABELS,
  RESERVATION_STATUS,
  RESERVATION_STATUS_LABELS,
  getCancelledReservationReason,
} from '../../constants/sellerOrders';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { formatOrderCode } from '../../core/utils/orderCode';
import { formatPrice } from '../../core/utils/productFormat';

function formatDateTime(iso) {
  if (!iso) {
    return '—';
  }
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isPastPickup(item) {
  if (!item?.pickupTime) {
    return true;
  }
  const pickup = new Date(item.pickupTime);
  return !Number.isFinite(pickup.getTime()) || Date.now() >= pickup.getTime();
}

function isWithinDepositDecisionWindow(item) {
  if (item?.withinDepositDecisionWindow === true) return true;
  if (item?.withinDepositDecisionWindow === false) return false;
  const deadlineRaw = item?.depositDecisionDeadline || item?.autoReleaseAt || item?.reviewDeadlineAt;
  if (deadlineRaw) {
    const deadline = new Date(deadlineRaw);
    return Number.isFinite(deadline.getTime()) && Date.now() < deadline.getTime();
  }
  if (!item?.pickupTime) return false;
  const pickup = new Date(item.pickupTime);
  if (!Number.isFinite(pickup.getTime())) return false;
  return Date.now() < pickup.getTime() + 24 * 60 * 60 * 1000;
}

function formatDepositStatus(reservation) {
  const amount = Number(reservation.depositAmount) || 0;
  if (amount <= 0) {
    return 'Không có cọc';
  }
  const price = formatPrice(amount);
  const settleTo = Number(reservation.depositSettleTo);
  if (
    settleTo === 2 ||
    reservation.depositReleasedAt ||
    reservation.depositReleasedToSellerAt
  ) {
    return `${price} (đã chuyển shop)`;
  }
  if (settleTo === 1 || reservation.depositRefundedAt) {
    return `${price} (đã hoàn)`;
  }
  if (reservation.depositPaidAt) {
    if (reservation.status === RESERVATION_STATUS.DISPUTED) {
      return `${price} (đang giữ chờ admin)`;
    }
    return `${price} (đang giữ)`;
  }
  return price;
}

function isDepositAlreadySettled(reservation) {
  const settleTo = Number(reservation?.depositSettleTo);
  return (
    settleTo === 1 ||
    settleTo === 2 ||
    Boolean(reservation?.depositSettledAt) ||
    Boolean(reservation?.depositReleasedAt) ||
    Boolean(reservation?.depositRefundedAt)
  );
}

function DetailRow({ label, value, emphasize = false }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, emphasize && styles.rowValueEmphasize]}>{value}</Text>
    </View>
  );
}

function pickStoreName(...candidates) {
  for (const value of candidates) {
    const text = String(value || '').trim();
    if (text) {
      return text;
    }
  }
  return '—';
}

function mergeLoadedItem(previous, next) {
  if (!next) {
    return previous;
  }
  const prev = previous || {};
  return {
    ...prev,
    ...next,
    id: next.id || prev.id,
    shopId: next.shopId || prev.shopId || '',
    storeName: pickStoreName(next.storeName, prev.storeName, next.shopUsername, prev.shopUsername),
    shopUsername: next.shopUsername || prev.shopUsername || '',
    productName: next.productName || prev.productName || next.product?.productName || '',
    product: next.product || prev.product || null,
    variant: next.variant || prev.variant || null,
  };
}

export default function BuyerOrderDetailScreen({
  orderId,
  initialItem = null,
  onBack,
  onChanged,
  onNavigatePickup,
  onOpenShopScan,
  onReviewStore,
  onViewReview,
  canReview = false,
  canViewReview = false,
  existingReview = null,
}) {
  const resolvedId = String(orderId || initialItem?.id || '').trim();
  const [item, setItem] = useState(initialItem);
  const [isLoading, setIsLoading] = useState(!initialItem);
  const [error, setError] = useState('');
  const [isActing, setIsActing] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReports, setDisputeReports] = useState([]);

  const loadDisputeReports = useCallback(async (reservationId) => {
    try {
      const idToken = await getCurrentUserIdToken();
      const reports = await getReservationDisputeReportsOnBackend(idToken, reservationId);
      setDisputeReports(Array.isArray(reports) ? reports : []);
    } catch {
      setDisputeReports([]);
    }
  }, []);

  const load = useCallback(async () => {
    if (!resolvedId) {
      setError('Thiếu mã đơn hàng.');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const idToken = await getCurrentUserIdToken();
      const reservation = await getBuyerReservationOnBackend(idToken, resolvedId);
      setItem((prev) => mergeLoadedItem(prev, reservation));
      await loadDisputeReports(resolvedId);
    } catch (loadError) {
      setError(loadError.message || 'Không tải được chi tiết đơn.');
      setItem((prev) => prev || initialItem);
    } finally {
      setIsLoading(false);
    }
  }, [resolvedId, initialItem, loadDisputeReports]);

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading && !item) {
    return (
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <CircularBackButton onPress={onBack} variant="light" />
          <Text style={styles.title}>Chi tiết đơn hàng</Text>
          <View style={styles.topBarSpacer} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator color="#076F32" size="large" />
        </View>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <CircularBackButton onPress={onBack} variant="light" />
          <Text style={styles.title}>Chi tiết đơn hàng</Text>
          <View style={styles.topBarSpacer} />
        </View>
        <Text style={styles.errorText}>{error || 'Không tìm thấy đơn.'}</Text>
      </View>
    );
  }

  const reservation = item;
  const pastPickup = isPastPickup(reservation);
  const withinDecision = isWithinDepositDecisionWindow(reservation);
  const canCancel =
    reservation.canCancel === true ||
    reservation.status === RESERVATION_STATUS.PENDING_SELLER_CONFIRMATION;
  const canScanShopQr =
    reservation.canScanShopQr === true ||
    reservation.canConfirmReceived === true ||
    (reservation.status === RESERVATION_STATUS.WAITING_PICKUP && !pastPickup);
  const canReportShop =
    reservation.canComplaint === true ||
    reservation.canReportShop === true ||
    (((reservation.status === RESERVATION_STATUS.WAITING_PICKUP &&
      pastPickup &&
      withinDecision) ||
      reservation.status === RESERVATION_STATUS.DISPUTED) &&
      !reservation.disputeByBuyer);
  const canForfeitDeposit =
    reservation.canForfeitDeposit === true ||
    ((reservation.status === RESERVATION_STATUS.WAITING_PICKUP ||
      reservation.status === RESERVATION_STATUS.DISPUTED) &&
      pastPickup &&
      withinDecision &&
      !isDepositAlreadySettled(reservation));
  const sellerReport = disputeReports.find((report) => report.reporterSide === 'seller');
  const buyerReport = disputeReports.find((report) => report.reporterSide === 'buyer');
  const canNavigate =
    reservation.status === RESERVATION_STATUS.WAITING_PICKUP && !pastPickup;

  async function handleCancel() {
    Alert.alert('Hủy giữ hàng', 'Bạn có chắc muốn hủy yêu cầu giữ hàng này?', [
      { text: 'Không', style: 'cancel' },
      {
        text: 'Hủy đơn',
        style: 'destructive',
        onPress: async () => {
          setIsActing(true);
          try {
            const idToken = await getCurrentUserIdToken();
            await cancelBuyerReservationOnBackend(idToken, reservation.id);
            onChanged?.();
            onBack?.();
          } catch (actionError) {
            Alert.alert('Lỗi', actionError.message || 'Không hủy được đơn.');
          } finally {
            setIsActing(false);
          }
        },
      },
    ]);
  }

  function handleScanShopQr() {
    onOpenShopScan?.(reservation);
  }

  function handleReportShop() {
    setShowDisputeModal(true);
  }

  async function handleSubmitDispute(payload) {
    setIsActing(true);
    try {
      const idToken = await getCurrentUserIdToken();
      const updated = await reportBuyerReservationOnBackend(idToken, {
        reservationId: reservation.id,
        reason: payload.reason,
        description: payload.description,
        latitude: payload.latitude,
        longitude: payload.longitude,
        address: payload.address,
        images: payload.images,
      });
      setItem((prev) => mergeLoadedItem(prev, updated));
      setShowDisputeModal(false);
      await loadDisputeReports(reservation.id);
      onChanged?.();
      Alert.alert('Đã gửi', 'Khiếu nại đã gửi. Admin sẽ xử lý, cọc tạm giữ.');
    } catch (actionError) {
      Alert.alert('Lỗi', actionError.message || 'Không gửi được khiếu nại.');
      throw actionError;
    } finally {
      setIsActing(false);
    }
  }

  function handleForfeitDeposit() {
    Alert.alert(
      'Đồng ý mất cọc',
      'Bạn xác nhận không khiếu nại và đồng ý chuyển tiền cọc cho người bán?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đồng ý mất cọc',
          style: 'destructive',
          onPress: async () => {
            setIsActing(true);
            try {
              const idToken = await getCurrentUserIdToken();
              const updated = await forfeitBuyerDepositOnBackend(idToken, reservation.id);
              setItem((prev) => mergeLoadedItem(prev, updated));
              onChanged?.();
              Alert.alert('Xong', 'Cọc đã chuyển cho người bán.');
            } catch (actionError) {
              Alert.alert('Lỗi', actionError.message || 'Không xử lý được mất cọc.');
            } finally {
              setIsActing(false);
            }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <CircularBackButton onPress={onBack} variant="light" />
        <Text style={styles.title}>Chi tiết đơn hàng</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <View style={styles.card}>
          <Text style={styles.codeLabel}>Mã đơn hàng</Text>
          <Text style={styles.code}>{formatOrderCode(reservation.id || resolvedId)}</Text>

          <DetailRow
            label="Trạng thái"
            value={RESERVATION_STATUS_LABELS[reservation.status] || 'Không rõ'}
          />
          <DetailRow label="Sản phẩm" value={reservation.product?.productName || '—'} />
          <DetailRow label="Phân loại" value={reservation.variant?.variantName || '—'} />
          <DetailRow
            label="Gian hàng"
            value={pickStoreName(
              reservation.storeName,
              reservation.shop?.shopName,
              reservation.shopUsername
            )}
          />
          <DetailRow label="Số lượng" value={String(reservation.quantity || 0)} />
          <DetailRow label="Đơn giá" value={formatPrice(reservation.agreedPrice)} />
          <DetailRow label="Tổng tiền" value={formatPrice(reservation.totalAmount)} emphasize />
          <DetailRow label="Tiền cọc" value={formatDepositStatus(reservation)} />
          <DetailRow label="Giờ lấy hàng" value={formatDateTime(reservation.pickupTime)} />
          <DetailRow label="Tạo lúc" value={formatDateTime(reservation.createdAt)} />
          {reservation.confirmedAt || reservation.sellerConfirmedAt ? (
            <DetailRow
              label="Shop xác nhận"
              value={formatDateTime(reservation.confirmedAt || reservation.sellerConfirmedAt)}
            />
          ) : null}
          {reservation.completedAt ? (
            <DetailRow label="Hoàn thành" value={formatDateTime(reservation.completedAt)} />
          ) : null}
          {reservation.cancelledAt ? (
            <DetailRow label="Hủy lúc" value={formatDateTime(reservation.cancelledAt)} />
          ) : null}
          {getCancelledReservationReason(reservation) ? (
            <DetailRow
              label="Lý do hủy"
              value={getCancelledReservationReason(reservation)}
            />
          ) : null}
          {reservation.disputeReasonLabel || reservation.disputeReason ? (
            <DetailRow
              label="Lý do báo cáo"
              value={
                reservation.disputeReasonLabel ||
                RESERVATION_DISPUTE_REASON_LABELS[reservation.disputeReason] ||
                reservation.disputeReason
              }
            />
          ) : null}
          {reservation.note ? <DetailRow label="Ghi chú" value={reservation.note} /> : null}
        </View>

        {sellerReport ? (
          <View style={styles.evidenceCard}>
            <Text style={styles.evidenceTitle}>Người bán đã tố cáo bạn không đến lấy hàng</Text>
            <Text style={styles.evidenceBody}>
              {sellerReport.sellerContent || sellerReport.content || 'Không có mô tả.'}
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
              Lúc: {formatDateTime(sellerReport.createdAt)} · Cọc đang giữ chờ admin xử lý
            </Text>
            {Array.isArray(sellerReport.images) && sellerReport.images.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.evidencePhotos}>
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

        {buyerReport ? (
          <View style={styles.evidenceCardSelf}>
            <Text style={styles.evidenceTitle}>Báo cáo của bạn</Text>
            <Text style={styles.evidenceBody}>
              {buyerReport.reasonLabel || buyerReport.title || 'Đã gửi báo cáo'}
              {buyerReport.content ? `\n${buyerReport.content}` : ''}
            </Text>
            {(buyerReport.latitude != null || buyerReport.address) ? (
              <DisputeLocationMeta
                latitude={buyerReport.latitude}
                longitude={buyerReport.longitude}
                address={buyerReport.address || ''}
                style={styles.evidenceMeta}
              />
            ) : null}
            <Text style={styles.evidenceMeta}>
              Lúc: {formatDateTime(buyerReport.createdAt)}
            </Text>
            {Array.isArray(buyerReport.images) && buyerReport.images.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.evidencePhotos}>
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

        {reservation.status === RESERVATION_STATUS.WAITING_PICKUP && !pastPickup ? (
          <View style={styles.hintCard}>
            <Text style={styles.hintTitle}>Đến lấy hàng</Text>
            <Text style={styles.hintText}>
              Đến shop đúng giờ, rồi quét QR cố định của cửa hàng để xác nhận đã nhận hàng và
              chuyển cọc.
            </Text>
          </View>
        ) : null}

        {reservation.status === RESERVATION_STATUS.WAITING_PICKUP && pastPickup ? (
          <View style={styles.hintCardWarn}>
            <Text style={styles.hintTitleWarn}>Đã quá giờ nhận hàng</Text>
            <Text style={styles.hintText}>
              {withinDecision
                ? 'Trong 24 giờ bạn có thể khiếu nại (admin xử lý) hoặc đồng ý mất cọc (chuyển cọc cho người bán).'
                : 'Đã quá 24 giờ. Cọc mặc định đã chuyển cho người bán.'}
            </Text>
          </View>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.actionCol}>
          {canNavigate ? (
            <Pressable
              style={[styles.actionBtn, styles.actionBtnPrimary]}
              disabled={isActing}
              onPress={() =>
                onNavigatePickup?.({
                  shopId: reservation.shopId,
                  reservationId: String(reservation.id),
                  storeName: reservation.storeName,
                })
              }
            >
              <Text style={styles.actionBtnText}>🧭 Đến lấy hàng</Text>
            </Pressable>
          ) : null}
          {canScanShopQr ? (
            <Pressable
              style={[styles.actionBtn, styles.actionBtnPrimary]}
              disabled={isActing}
              onPress={handleScanShopQr}
            >
              <Text style={styles.actionBtnText}>Quét mã Shop</Text>
            </Pressable>
          ) : null}
          {canReportShop ? (
            <Pressable
              style={[styles.actionBtn, styles.actionBtnDanger]}
              disabled={isActing}
              onPress={handleReportShop}
            >
              <Text style={styles.actionBtnTextDanger}>Khiếu nại</Text>
            </Pressable>
          ) : null}
          {canForfeitDeposit ? (
            <Pressable
              style={[styles.actionBtn, styles.actionBtnPrimary]}
              disabled={isActing}
              onPress={handleForfeitDeposit}
            >
              <Text style={styles.actionBtnText}>Đồng ý mất cọc</Text>
            </Pressable>
          ) : null}
          {canCancel ? (
            <Pressable
              style={[styles.actionBtn, styles.actionBtnDanger]}
              disabled={isActing}
              onPress={handleCancel}
            >
              <Text style={styles.actionBtnTextDanger}>Hủy giữ hàng</Text>
            </Pressable>
          ) : null}
          {canReview ? (
            <Pressable
              style={[styles.actionBtn, styles.actionBtnSecondary]}
              disabled={isActing}
              onPress={() =>
                onReviewStore?.({
                  shopId: reservation.shopId ? String(reservation.shopId) : '',
                  storeId: reservation.shopId ? String(reservation.shopId) : '',
                  storeName: reservation.storeName,
                  productId: reservation.product?.id
                    ? String(reservation.product.id)
                    : '',
                  productName: reservation.product?.productName,
                  reservationId: reservation.id ? String(reservation.id) : '',
                  orderCode: reservation.id ? String(reservation.id) : '',
                })
              }
            >
              <Text style={styles.actionBtnTextSecondary}>⭐ Đánh giá</Text>
            </Pressable>
          ) : null}
          {canViewReview ? (
            <Pressable
              style={[styles.actionBtn, styles.actionBtnSecondary]}
              disabled={isActing}
              onPress={() =>
                onViewReview?.(
                  existingReview || {
                    reservationId: reservation.id ? String(reservation.id) : '',
                    orderCode: reservation.id ? String(reservation.id) : '',
                    storeName: reservation.storeName,
                    productName: reservation.product?.productName,
                    shopId: reservation.shopId ? String(reservation.shopId) : '',
                  }
                )
              }
            >
              <Text style={styles.actionBtnTextSecondary}>Xem đánh giá</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <ReservationDisputeModal
        visible={showDisputeModal}
        mode="buyer"
        onClose={() => setShowDisputeModal(false)}
        onSubmit={handleSubmitDispute}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: '#076F32',
  },
  title: {
    flex: 1,
    marginHorizontal: 12,
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  topBarSpacer: { width: 36 },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 16,
    paddingBottom: 28,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  hintCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#A7D9B8',
    marginBottom: 12,
  },
  hintCardWarn: {
    backgroundColor: '#fff7ed',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fdba74',
    marginBottom: 12,
  },
  hintTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#055528',
    marginBottom: 6,
  },
  hintTitleWarn: {
    fontSize: 16,
    fontWeight: '900',
    color: '#c2410c',
    marginBottom: 6,
  },
  hintText: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
    fontWeight: '600',
  },
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
  evidenceTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
  },
  evidenceBody: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
    lineHeight: 18,
  },
  evidenceMeta: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  evidencePhotos: {
    marginTop: 4,
  },
  evidencePhoto: {
    width: 72,
    height: 72,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#e2e8f0',
  },
  codeLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  code: {
    marginTop: 4,
    marginBottom: 12,
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  rowLabel: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  rowValue: {
    flex: 1,
    textAlign: 'right',
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
  rowValueEmphasize: {
    color: '#076F32',
    fontWeight: '900',
  },
  actionCol: {
    marginTop: 16,
    gap: 10,
  },
  actionBtn: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  actionBtnPrimary: {
    backgroundColor: '#076F32',
  },
  actionBtnSecondary: {
    backgroundColor: '#E6F4EC',
    borderWidth: 1,
    borderColor: '#A7D9B8',
  },
  actionBtnDanger: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  actionBtnTextSecondary: {
    color: '#076F32',
    fontSize: 14,
    fontWeight: '800',
  },
  actionBtnTextDanger: {
    color: '#b91c1c',
    fontSize: 14,
    fontWeight: '800',
  },
  errorText: {
    marginTop: 12,
    color: '#b91c1c',
    fontWeight: '700',
  },
});
