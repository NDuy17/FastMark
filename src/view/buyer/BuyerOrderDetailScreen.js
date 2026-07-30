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
import { Ionicons } from '@expo/vector-icons';

import SubScreenHeader from '../shared/components/SubScreenHeader';
import { showErrorAlert } from '../../core/utils/appAlert';
import AvatarBadge from '../shared/components/AvatarBadge';
import ReservationDisputeModal from '../shared/components/ReservationDisputeModal';
import ReservationDisputeSection from '../shared/components/ReservationDisputeSection';
import ReservationAdminResolutionSection from '../shared/components/ReservationAdminResolutionSection';
import BuyerOrderReviewSection from '../shared/components/BuyerOrderReviewSection';
import {
  cancelBuyerReservationOnBackend,
  forfeitBuyerDepositOnBackend,
  getBuyerReservationOnBackend,
  getReservationDisputeReportsOnBackend,
  reportBuyerReservationOnBackend,
} from '../../api/buyerOpsApi';
import { deleteBuyerReviewOnBackend } from '../../api/reviewApi';
import {
  RESERVATION_STATUS,
  RESERVATION_STATUS_LABELS,
  getCancelledReservationReason,
  getSellerCancelNote,
  hasAdminDisputeResolution,
  hasDisputeReportHistory,
  isActiveDisputeOrder,
  isCancelledReservationStatus,
  VIEWER_ROLE,
} from '../../constants/sellerOrders';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { getOrderCodeValue } from '../../core/utils/orderCode';
import { formatPrice } from '../../core/utils/productFormat';
import { getBuyerCancelConfirmMessage } from '../../core/utils/buyerCancelReservation';
import {
  buildViewReviewPayload,
  canShowReviewButton,
  canViewExistingReview,
} from '../../core/utils/orderReview';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { useOrderSocket } from '../../hooks/useOrderSocket';

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

function formatPickupSchedule(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return {
    time: `${hours}:${minutes}`,
    date: `${day}/${month}/${year}`,
  };
}

function PaymentRow({ label, value, valueStyle }) {
  return (
    <View style={styles.paymentRow}>
      <Text style={styles.paymentLabel}>{label}</Text>
      <Text style={[styles.paymentValue, valueStyle]}>{value}</Text>
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
  const merged = {
    ...prev,
    ...next,
    id: next.id || prev.id,
    shopId: next.shopId || prev.shopId || '',
    storeName: pickStoreName(next.storeName, prev.storeName, next.shopUsername, prev.shopUsername),
    shopUsername: next.shopUsername || prev.shopUsername || '',
    productName: next.productName || prev.productName || next.product?.productName || '',
    shop: next.shop
      ? { ...(prev.shop || {}), ...next.shop }
      : prev.shop || null,
    product: next.product || prev.product || null,
    variant: next.variant || prev.variant || null,
  };

  const prevReason = getCancelledReservationReason(prev, VIEWER_ROLE.BUYER);
  const nextReason = getCancelledReservationReason(merged, VIEWER_ROLE.BUYER);
  if (prevReason && !nextReason) {
    merged.cancelReason = prev.cancelReason || merged.cancelReason;
    merged.reasonCode = prev.reasonCode || merged.reasonCode;
    merged.reasonLabelBuyer = prev.reasonLabelBuyer || merged.reasonLabelBuyer;
    merged.reasonLabelSeller = prev.reasonLabelSeller || merged.reasonLabelSeller;
    merged.cancelledBy = prev.cancelledBy || merged.cancelledBy;
    merged.cancelledAt = prev.cancelledAt || merged.cancelledAt;
    merged.depositSettleTo =
      prev.depositSettleTo != null ? prev.depositSettleTo : merged.depositSettleTo;
    merged.cancelNote = prev.cancelNote || merged.cancelNote;
    merged.sellerCancelImages =
      Array.isArray(prev.sellerCancelImages) && prev.sellerCancelImages.length
        ? prev.sellerCancelImages
        : merged.sellerCancelImages;
    merged.cancelledBySellerAfterAccept =
      prev.cancelledBySellerAfterAccept ?? merged.cancelledBySellerAfterAccept;
  }

  return merged;
}

export default function BuyerOrderDetailScreen({
  orderId,
  initialItem = null,
  listCancelReasonText = '',
  onBack,
  onChanged,
  onNavigatePickup,
  onOpenShopScan,
  onReviewStore,
  onReviewDeleted,
}) {
  const resolvedId = String(orderId || initialItem?.id || '').trim();
  const [item, setItem] = useState(initialItem);
  const [isLoading, setIsLoading] = useState(!initialItem);
  const [isActing, setIsActing] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReports, setDisputeReports] = useState([]);
  const insets = useScreenInsets();

  const loadDisputeReports = useCallback(async (reservationId) => {
    try {
      const idToken = await getCurrentUserIdToken();
      const reports = await getReservationDisputeReportsOnBackend(idToken, reservationId);
      setDisputeReports(Array.isArray(reports) ? reports : []);
    } catch {
      setDisputeReports([]);
    }
  }, []);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!resolvedId) {
        showErrorAlert('Thiếu mã đơn hàng.');
        setIsLoading(false);
        return;
      }
      if (!silent) {
        setIsLoading(true);
      }
      try {
        const idToken = await getCurrentUserIdToken();
        const reservation = await getBuyerReservationOnBackend(idToken, resolvedId);
        setItem((prev) => mergeLoadedItem(prev, reservation));
        await loadDisputeReports(resolvedId);
      } catch (loadError) {
        if (!silent) {
          showErrorAlert(loadError.message || 'Không tải được chi tiết đơn.');
        }
        setItem((prev) => prev || initialItem);
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [resolvedId, initialItem, loadDisputeReports]
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleOrderUpdated = useCallback(
    (payload) => {
      if (!payload?.reservationId || String(payload.reservationId) !== String(resolvedId)) {
        return;
      }
      // Cập nhật im lặng: không bật spinner, không nhấp nháy nội dung đang xem.
      load({ silent: true });
    },
    [load, resolvedId]
  );

  useOrderSocket({
    enabled: Boolean(resolvedId),
    onOrderUpdated: handleOrderUpdated,
  });

  if (isLoading && !item) {
    return (
      <View style={styles.screen}>
        <SubScreenHeader title="Chi tiết đơn hàng" onBack={onBack} />
        <View style={styles.centered}>
          <ActivityIndicator color="#076F32" size="large" />
        </View>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.screen}>
        <SubScreenHeader title="Chi tiết đơn hàng" onBack={onBack} />
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Không tìm thấy đơn hàng.</Text>
        </View>
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
    !reservation.disputeByBuyer &&
    (reservation.canForfeitDeposit === true ||
      ((reservation.status === RESERVATION_STATUS.WAITING_PICKUP ||
        reservation.status === RESERVATION_STATUS.DISPUTED) &&
        pastPickup &&
        withinDecision &&
        !isDepositAlreadySettled(reservation)));
  const sellerReport = disputeReports.find((report) => report.reporterSide === 'seller');
  const buyerReport = disputeReports.find((report) => report.reporterSide === 'buyer');
  const canNavigate =
    reservation.status === RESERVATION_STATUS.WAITING_PICKUP && !pastPickup;
  const storeName = pickStoreName(
    reservation.storeName,
    reservation.shop?.shopName,
    reservation.shopUsername
  );
  const statusLabel = RESERVATION_STATUS_LABELS[reservation.status] || 'Không rõ';
  const cancelReasonText =
    String(listCancelReasonText || '').trim() ||
    getCancelledReservationReason(reservation, VIEWER_ROLE.BUYER);
  const sellerCancelNote = getSellerCancelNote(reservation);
  const sellerCancelImages = Array.isArray(reservation.sellerCancelImages)
    ? reservation.sellerCancelImages.filter(Boolean)
    : [];
  const hideSellerCancelDetails =
    hasDisputeReportHistory(reservation) && !isActiveDisputeOrder(reservation);
  const showAdminResolutionSection = hasAdminDisputeResolution(reservation, disputeReports);
  const showCancelReasonSection =
    !isActiveDisputeOrder(reservation) &&
    !showAdminResolutionSection &&
    (Boolean(cancelReasonText) ||
      (!hideSellerCancelDetails && Boolean(sellerCancelNote)) ||
      (!hideSellerCancelDetails && sellerCancelImages.length > 0));
  const statusChipStyle = isCancelledReservationStatus(reservation.status)
    ? styles.statusChipCancelled
    : reservation.status === RESERVATION_STATUS.PENDING_SELLER_CONFIRMATION ||
        reservation.status === RESERVATION_STATUS.WAITING_PICKUP
      ? styles.statusChipPending
      : styles.statusChip;
  const pickupDisplay = formatPickupSchedule(reservation.pickupTime);
  const totalAmount = Number(reservation.totalAmount) || 0;
  const depositAmount = Number(reservation.depositAmount) || 0;
  const depositPercent = Math.max(0, Math.min(100, Number(reservation.depositPercent) || 0));
  const cashDue = Math.max(0, totalAmount - depositAmount);
  const qty = Number(reservation.quantity) || 0;
  const unitPrice =
    reservation.agreedPrice != null
      ? Number(reservation.agreedPrice)
      : reservation.variant?.price != null
        ? Number(reservation.variant.price)
        : qty > 0
          ? Math.round(totalAmount / qty)
          : 0;

  const showHoldingPrimaryActions =
    reservation.status === RESERVATION_STATUS.WAITING_PICKUP && !pastPickup;
  const isCompletedOrder =
    reservation.status === RESERVATION_STATUS.COMPLETED ||
    reservation.status === RESERVATION_STATUS.AUTO_COMPLETED;
  const canReview = isCompletedOrder && canShowReviewButton(reservation);
  const canViewReview = isCompletedOrder && canViewExistingReview(reservation);
  const existingReview = canViewReview
    ? buildViewReviewPayload(reservation, null, {
        storeName: reservation.storeName,
        productName: reservation.product?.productName,
      })
    : null;

  async function handleCancel() {
    Alert.alert('Hủy đơn hàng?', getBuyerCancelConfirmMessage(reservation), [
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

  function handleCallShop() {
    const phone = reservation.shop?.phone;
    if (!phone) {
      Alert.alert('Thông báo', 'Cửa hàng chưa có số điện thoại.');
      return;
    }
    Linking.openURL(`tel:${String(phone).replace(/\s/g, '')}`);
  }

  function handleHoldingMoreMenu() {
    handleCancel();
  }

  async function handleDeleteReview(review) {
    const reviewId = String(review?.id || reservation.buyerReviewId || '').trim();
    if (!reviewId) {
      Alert.alert('Lỗi', 'Không xác định được đánh giá.');
      return;
    }

    setIsActing(true);
    try {
      const idToken = await getCurrentUserIdToken();
      await deleteBuyerReviewOnBackend(idToken, reviewId);
      const updated = await getBuyerReservationOnBackend(idToken, resolvedId);
      setItem((prev) => mergeLoadedItem(prev, updated));
      onReviewDeleted?.(reservation);
      onChanged?.();
      Alert.alert('Đã gỡ', 'Đánh giá đã được gỡ bỏ. Bạn không thể đánh giá lại đơn này.');
    } catch (actionError) {
      Alert.alert('Lỗi', actionError.message || 'Không gỡ được đánh giá.');
    } finally {
      setIsActing(false);
    }
  }

  return (
    <View style={styles.screen}>
      <SubScreenHeader title="Chi tiết đơn hàng" onBack={onBack} />

      <ScrollView
        style={styles.body}
        contentContainerStyle={[
          styles.bodyContent,
          { paddingBottom: Math.max(insets.nestedScrollPaddingBottom, 28) },
        ]}
      >
        <View style={styles.card}>
          <View style={styles.orderMetaRow}>
            <Text style={styles.orderCode} numberOfLines={1}>
              Đơn hàng: {getOrderCodeValue(reservation.id || resolvedId)}
            </Text>
            <View style={styles.orderMetaTrailing}>
              <Text style={statusChipStyle} numberOfLines={2}>
                {statusLabel}
              </Text>
              {showHoldingPrimaryActions ? (
                <Pressable
                  style={styles.itemMoreBtn}
                  disabled={isActing}
                  onPress={handleHoldingMoreMenu}
                  accessibilityRole="button"
                  accessibilityLabel="Hủy đơn hàng"
                  hitSlop={8}
                >
                  <Ionicons name="ellipsis-vertical" size={18} color="#64748b" />
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionHeading}>THÔNG TIN CỬA HÀNG</Text>
          <View style={styles.shopRow}>
            <AvatarBadge name={storeName} uri={reservation.shop?.avatar || ''} size={52} />
            <View style={styles.shopInfo}>
              <Text style={styles.shopName} numberOfLines={1}>
                {storeName}
              </Text>
            </View>
            <Pressable
              onPress={handleCallShop}
              style={({ pressed }) => [styles.callIconBtn, pressed && styles.callIconBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Gọi cửa hàng"
              hitSlop={8}
            >
              <Ionicons name="call" size={20} color="#076F32" />
            </Pressable>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionHeading}>THÔNG TIN SẢN PHẨM</Text>
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
              <Text style={styles.productName} numberOfLines={2}>
                {reservation.product?.productName || 'Sản phẩm'}
              </Text>
              {reservation.variant?.variantName ? (
                <Text style={styles.productMeta}>
                  Loại: {reservation.variant.variantName}
                </Text>
              ) : null}
              <View style={styles.productPriceRow}>
                <Text style={styles.productMeta}>Giá: {formatPrice(unitPrice)}</Text>
                <Text style={styles.productQtyMark}>x{qty || 1}</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionHeading}>CHI TIẾT THANH TOÁN</Text>
          <PaymentRow label="Tổng tiền hàng:" value={formatPrice(totalAmount)} />
          <PaymentRow
            label={`Đặt cọc ${depositPercent}%:`}
            value={formatPrice(depositAmount)}
          />
          <PaymentRow
            label="Thanh toán khi nhận hàng:"
            value={formatPrice(cashDue)}
            valueStyle={styles.paymentValueDanger}
          />

          <View style={styles.divider} />

          <Text style={styles.sectionHeading}>THỜI GIAN NHẬN HÀNG</Text>
          <View style={styles.pickupTimeRow}>
            <Ionicons name="time-outline" size={18} color="#64748b" />
            {pickupDisplay ? (
              <Text style={styles.pickupTimeText}>
                Giờ: <Text style={styles.pickupTimeValue}>{pickupDisplay.time}</Text>
                {' · '}
                Ngày: <Text style={styles.pickupTimeValue}>{pickupDisplay.date}</Text>
              </Text>
            ) : (
              <Text style={styles.pickupTimeText}>Giờ: — · Ngày: —</Text>
            )}
          </View>

          {reservation.note ? (
            <Text style={styles.noteLine}>Ghi chú: {reservation.note}</Text>
          ) : null}

          {reservation.status === RESERVATION_STATUS.WAITING_PICKUP && !pastPickup ? (
            <>
              <View style={styles.divider} />
              <View style={styles.pickupNoticeBlock}>
                <Text style={styles.pickupNoticeTitle}>ĐẾN LẤY HÀNG</Text>
                <Text style={styles.pickupNoticeBody}>
                  Đến shop đúng giờ, rồi quét QR cố định của cửa hàng để xác nhận đã nhận hàng và
                  chuyển cọc.
                </Text>
              </View>
            </>
          ) : null}

          {reservation.status === RESERVATION_STATUS.WAITING_PICKUP && pastPickup ? (
            <>
              <View style={styles.divider} />
              <View style={styles.pickupNoticeBlock}>
                <Text style={styles.pickupOverdueTitle}>ĐÃ QUÁ GIỜ NHẬN HÀNG</Text>
                <Text style={styles.pickupNoticeBody}>
                  {withinDecision
                    ? 'Trong 24h bạn có thể khiếu nại và chờ admin xử lý hoặc đồng ý mất cọc (chuyển cọc cho người bán).'
                    : 'Đã quá 24 giờ sau giờ nhận. Cọc mặc định đã chuyển cho người bán.'}
                </Text>
              </View>
            </>
          ) : null}

          <ReservationDisputeSection
            reservation={reservation}
            buyerReport={buyerReport}
            sellerReport={sellerReport}
            viewerRole={VIEWER_ROLE.BUYER}
          />

          <ReservationAdminResolutionSection
            reservation={reservation}
            reports={disputeReports}
            viewerRole={VIEWER_ROLE.BUYER}
          />

          {showCancelReasonSection ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.cancelReasonHeading}>LÝ DO</Text>
              {cancelReasonText ? (
                <Text style={styles.cancelReasonBody}>{cancelReasonText}</Text>
              ) : null}
              {!hideSellerCancelDetails && sellerCancelNote ? (
                <View style={styles.cancelDetailBlock}>
                  <Text style={styles.cancelDetailLabel}>Lý do hủy hàng:</Text>
                  <Text style={styles.cancelDetailBody}>{sellerCancelNote}</Text>
                </View>
              ) : null}
              {!hideSellerCancelDetails && sellerCancelImages.length ? (
                <View style={styles.cancelEvidenceBlock}>
                  <Text style={styles.cancelDetailLabel}>Ảnh chứng minh từ shop:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {sellerCancelImages.map((uri) => (
                      <Image key={uri} source={{ uri }} style={styles.evidencePhoto} />
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </>
          ) : null}

          {canViewReview && existingReview ? (
            <BuyerOrderReviewSection
              review={existingReview}
              onDelete={handleDeleteReview}
              disabled={isActing}
            />
          ) : null}
        </View>

        <View style={styles.actionCol}>
          {showHoldingPrimaryActions ? (
            <View style={styles.holdingActionRow}>
              <Pressable
                style={[styles.actionBtn, styles.actionBtnPrimary, styles.actionBtnHalf]}
                disabled={isActing}
                onPress={() =>
                  onNavigatePickup?.({
                    shopId: reservation.shopId,
                    reservationId: String(reservation.id),
                    storeName: reservation.storeName,
                  })
                }
              >
                <Text style={styles.actionBtnText}>Đến lấy hàng</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, styles.actionBtnPrimary, styles.actionBtnHalf]}
                disabled={isActing}
                onPress={handleScanShopQr}
              >
                <Text style={styles.actionBtnText}>Quét mã shop</Text>
              </Pressable>
            </View>
          ) : null}
          {!showHoldingPrimaryActions && canNavigate ? (
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
          {!showHoldingPrimaryActions && canScanShopQr ? (
            <Pressable
              style={[styles.actionBtn, styles.actionBtnPrimary]}
              disabled={isActing}
              onPress={handleScanShopQr}
            >
              <Text style={styles.actionBtnText}>Quét mã Shop</Text>
            </Pressable>
          ) : null}
          {!showHoldingPrimaryActions && (canReportShop || canForfeitDeposit) ? (
            <View style={styles.holdingActionRow}>
              {canReportShop ? (
                <Pressable
                  style={[styles.actionBtn, styles.actionBtnDanger, styles.actionBtnHalf]}
                  disabled={isActing}
                  onPress={handleReportShop}
                >
                  <Text style={styles.actionBtnTextDanger}>Khiếu nại</Text>
                </Pressable>
              ) : null}
              {canForfeitDeposit ? (
                <Pressable
                  style={[styles.actionBtn, styles.actionBtnPrimary, styles.actionBtnHalf]}
                  disabled={isActing}
                  onPress={handleForfeitDeposit}
                >
                  <Text style={styles.actionBtnText}>Đồng ý mất cọc</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {!showHoldingPrimaryActions && canCancel ? (
            <Pressable
              style={[styles.actionBtn, styles.actionBtnDanger]}
              disabled={isActing}
              onPress={handleCancel}
            >
              <Text style={styles.actionBtnTextDanger}>Hủy đơn</Text>
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
              <Text style={styles.actionBtnTextSecondary}>Đánh giá đơn đã nhận</Text>
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
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.3,
    marginBottom: 10,
  },
  orderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  orderMetaTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  itemMoreBtn: {
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  orderCode: {
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
  },
  statusChip: {
    flexShrink: 0,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '800',
    color: '#076F32',
  },
  statusChipPending: {
    flexShrink: 0,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '800',
    color: '#b45309',
  },
  statusChipCancelled: {
    flexShrink: 0,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '800',
    color: '#dc2626',
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shopInfo: {
    flex: 1,
    minWidth: 0,
  },
  shopName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  callIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    marginVertical: 14,
  },
  productRow: { flexDirection: 'row', gap: 12 },
  productThumbWrap: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  productThumb: { width: '100%', height: '100%' },
  productThumbEmoji: { fontSize: 28 },
  productInfo: { flex: 1, gap: 4, paddingTop: 2 },
  productName: { fontSize: 15, fontWeight: '800', color: '#0f172a', lineHeight: 20 },
  productMeta: { fontSize: 14, color: '#334155', fontWeight: '600' },
  productPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  productQtyMark: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  paymentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  paymentValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  paymentValueDanger: {
    color: '#dc2626',
  },
  pickupTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickupTimeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    lineHeight: 20,
  },
  pickupTimeValue: {
    fontWeight: '800',
    color: '#0f172a',
  },
  noteLine: {
    marginTop: 8,
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  noteLineDanger: {
    marginTop: 4,
    fontSize: 14,
    color: '#b91c1c',
    fontWeight: '700',
    lineHeight: 22,
  },
  cancelReasonHeading: {
    fontSize: 13,
    fontWeight: '900',
    color: '#b91c1c',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  cancelReasonBody: {
    fontSize: 13,
    color: '#b91c1c',
    lineHeight: 20,
    fontWeight: '600',
  },
  cancelDetailBlock: {
    marginTop: 10,
    gap: 4,
  },
  cancelDetailLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 20,
  },
  cancelDetailBody: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
    fontWeight: '600',
  },
  pickupNoticeBlock: {
    gap: 8,
  },
  pickupNoticeTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.2,
  },
  pickupOverdueTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#b91c1c',
    letterSpacing: 0.2,
  },
  pickupNoticeBody: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
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
  cancelEvidenceBlock: {
    marginTop: 10,
    gap: 6,
  },
  actionCol: {
    marginTop: 16,
    gap: 10,
  },
  holdingActionRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'stretch',
  },
  actionBtnHalf: {
    flex: 1,
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
  emptyText: {
    padding: 24,
    textAlign: 'center',
    color: '#64748b',
    fontWeight: '600',
  },
});
