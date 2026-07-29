import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import {
  confirmSellerReservationOnBackend,
  getSellerOrdersOnBackend,
  rejectSellerReservationOnBackend,
  reportBuyerNoShowOnBackend,
} from '../../api/sellerOpsApi';
import { showErrorAlert } from '../../core/utils/appAlert';
import {
  RESERVATION_TAB,
  RESERVATION_STATUS,
  RESERVATION_STATUS_LABELS,
  ORDER_STATUS_TABS,
  getCancelledReservationReason,
  isActiveDisputeOrder,
  VIEWER_ROLE,
} from '../../constants/sellerOrders';
import ClearableSearchField from '../shared/components/ClearableSearchField';
import OrderItemHeader from '../shared/components/OrderItemHeader';
import OrderStatusTabBar from '../shared/components/OrderStatusTabBar';
import OrderTabEmptyState, {
  ORDER_TAB_EMPTY_MESSAGE,
  ORDER_TAB_SEARCH_EMPTY_MESSAGE,
} from '../shared/components/OrderTabEmptyState';
import OrderDisputeListHints from '../shared/components/OrderDisputeListHints';
import ReservationDisputeModal from '../shared/components/ReservationDisputeModal';
import SubScreenHeader from '../shared/components/SubScreenHeader';
import { formatPrice } from '../../core/utils/productFormat';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { useOrderSocket } from '../../hooks/useOrderSocket';

function getReservationStatusStyle(status) {
  if (status === RESERVATION_STATUS.WAITING_PICKUP) {
    return { badge: styles.statusBadgePending, text: styles.statusBadgeTextPending };
  }
  if (
    status === RESERVATION_STATUS.COMPLETED ||
    status === RESERVATION_STATUS.AUTO_COMPLETED
  ) {
    return { badge: styles.statusBadgeSuccess, text: styles.statusBadgeTextSuccess };
  }
  if (
    status === RESERVATION_STATUS.REJECTED ||
    status === RESERVATION_STATUS.REFUNDED ||
    status === RESERVATION_STATUS.DISPUTED ||
    status === RESERVATION_STATUS.DISPUTE_RESOLVED
  ) {
    return { badge: styles.statusBadgeDanger, text: styles.statusBadgeTextDanger };
  }
  return { badge: styles.statusBadgePending, text: styles.statusBadgeTextPending };
}

function isPastPickup(item, now) {
  if (!item?.pickupTime) return false;
  const pickup = new Date(item.pickupTime);
  return Number.isFinite(pickup.getTime()) && now >= pickup.getTime();
}

function isWithinDepositDecisionWindow(item, now = Date.now()) {
  if (item?.withinDepositDecisionWindow === true) return true;
  if (item?.withinDepositDecisionWindow === false) return false;
  const deadlineRaw = item?.depositDecisionDeadline || item?.autoReleaseAt || item?.reviewDeadlineAt;
  if (deadlineRaw) {
    const deadline = new Date(deadlineRaw);
    return Number.isFinite(deadline.getTime()) && now < deadline.getTime();
  }
  if (!item?.pickupTime) return false;
  const pickup = new Date(item.pickupTime);
  if (!Number.isFinite(pickup.getTime())) return false;
  return now < pickup.getTime() + 24 * 60 * 60 * 1000;
}

function canReportBuyerNoShow(item, now) {
  return (
    item.canReportBuyer === true ||
    ((item.status === RESERVATION_STATUS.WAITING_PICKUP ||
      item.status === RESERVATION_STATUS.DISPUTED) &&
      isPastPickup(item, now) &&
      !item.disputeBySeller)
  );
}

function formatOrderTime(iso) {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${hours}:${minutes} · ${day}/${month}/${year}`;
}

export default function SellerOrdersScreen({
  onBack,
  onOpenReservation,
  onRefreshKey = 0,
  embedded = false,
  activeTab: controlledActiveTab,
  onActiveTabChange,
}) {
  const insets = useScreenInsets();
  const [internalActiveTab, setInternalActiveTab] = useState(RESERVATION_TAB.PENDING);
  const activeTab = controlledActiveTab ?? internalActiveTab;
  const setActiveTab = useCallback(
    (next) => {
      const resolved = typeof next === 'function' ? next(activeTab) : next;
      if (controlledActiveTab === undefined) {
        setInternalActiveTab(resolved);
      }
      onActiveTabChange?.(resolved);
    },
    [activeTab, controlledActiveTab, onActiveTabChange]
  );
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [disputeTarget, setDisputeTarget] = useState(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const idToken = await getCurrentUserIdToken();
      const data = await getSellerOrdersOnBackend({ idToken, tab: activeTab });
      setItems(data.reservations || []);
    } catch (loadError) {
      showErrorAlert(loadError.message || 'Không tải được đơn hàng.');
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    setSearch('');
    loadOrders();
  }, [loadOrders, onRefreshKey]);

  const handleOrderUpdated = useCallback(() => {
    loadOrders();
  }, [loadOrders]);

  useOrderSocket({
    enabled: true,
    onOrderUpdated: handleOrderUpdated,
  });

  useEffect(() => {
    const nextPickupAt = items.reduce((nearest, item) => {
      const pickupAt = new Date(item.pickupTime).getTime();
      if (!Number.isFinite(pickupAt) || pickupAt <= currentTime) {
        return nearest;
      }
      return nearest == null || pickupAt < nearest ? pickupAt : nearest;
    }, null);
    if (nextPickupAt == null) {
      return undefined;
    }
    const timer = setTimeout(
      () => setCurrentTime(Date.now()),
      Math.min(nextPickupAt - currentTime + 50, 2_147_483_647)
    );
    return () => clearTimeout(timer);
  }, [items, currentTime]);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return items;
    }
    return items.filter((item) => {
      const productName = String(
        item.product?.productName || item.productName || ''
      ).toLowerCase();
      const variantName = String(
        item.variant?.variantName || item.variantName || ''
      ).toLowerCase();
      const buyerName = String(
        item.buyer?.fullName || item.buyer?.name || item.buyerName || ''
      ).toLowerCase();
      const id = String(item.id || item.orderCode || '').toLowerCase();
      const note = String(item.note || '').toLowerCase();
      return (
        productName.includes(keyword) ||
        variantName.includes(keyword) ||
        buyerName.includes(keyword) ||
        id.includes(keyword) ||
        note.includes(keyword)
      );
    });
  }, [items, search]);

  function handleConfirmReservation(reservation) {
    const depositNote =
      Number(reservation.depositAmount) > 0
        ? `\n\nSau khi xác nhận, đưa QR gian hàng cho khách quét khi nhận hàng. Khi đó bạn nhận cọc ${formatPrice(reservation.depositAmount)}.`
        : '\n\nSau khi xác nhận, đưa QR gian hàng cho khách quét khi nhận hàng để hoàn tất.';
    Alert.alert('Xác nhận giữ hàng', `Bạn xác nhận giữ hàng cho khách này?${depositNote}`, [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xác nhận',
        onPress: async () => {
          try {
            const idToken = await getCurrentUserIdToken();
            await confirmSellerReservationOnBackend(idToken, reservation.id);
            Alert.alert(
              'Thành công',
              'Đã xác nhận giữ hàng. Đưa QR gian hàng cho khách quét khi nhận.'
            );
            loadOrders();
          } catch (actionError) {
            Alert.alert('Lỗi', actionError.message || 'Không xác nhận được đơn.');
          }
        },
      },
    ]);
  }

  function handleRejectReservation(reservation) {
    Alert.alert('Từ chối giữ hàng', 'Bạn chắc chắn từ chối yêu cầu giữ hàng này?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Từ chối',
        style: 'destructive',
        onPress: async () => {
          try {
            const idToken = await getCurrentUserIdToken();
            await rejectSellerReservationOnBackend({
              idToken,
              reservationId: reservation.id,
              reason: 'Shop hủy',
            });
            loadOrders();
          } catch (actionError) {
            Alert.alert('Lỗi', actionError.message || 'Không từ chối được đơn.');
          }
        },
      },
    ]);
  }

  async function handleSubmitBuyerNoShow(payload) {
    if (!disputeTarget) {
      return;
    }
    try {
      const idToken = await getCurrentUserIdToken();
      await reportBuyerNoShowOnBackend({
        idToken,
        reservationId: disputeTarget.id,
        title: payload.title,
        description: payload.description,
        note: payload.note,
        latitude: payload.latitude,
        longitude: payload.longitude,
        address: payload.address,
        images: payload.images,
      });
      setDisputeTarget(null);
      Alert.alert('Đã gửi', 'Đã báo cáo người mua không đến. Cọc đang giữ chờ admin.');
      loadOrders();
    } catch (actionError) {
      Alert.alert('Lỗi', actionError.message || 'Không gửi được báo cáo.');
      throw actionError;
    }
  }

  function renderReservationItem({ item }) {
    const statusLabel = RESERVATION_STATUS_LABELS[item.status] || 'Không rõ';
    const statusStyle = getReservationStatusStyle(item.status);
    const productName = item.product?.productName || 'Sản phẩm';
    const thumb = item.product?.thumbnail || '';
    const qty = Number(item.quantity) || 0;
    const canConfirm = item.status === RESERVATION_STATUS.PENDING_SELLER_CONFIRMATION;
    const pastPickup = isPastPickup(item, currentTime);
    const useBlackOrderCode =
      canConfirm ||
      activeTab === RESERVATION_TAB.HOLDING ||
      activeTab === RESERVATION_TAB.COMPLETED ||
      activeTab === RESERVATION_TAB.CANCELLED;
    const useBlackUnitPrice =
      canConfirm || activeTab === RESERVATION_TAB.HOLDING;
    const canReportBuyer = canReportBuyerNoShow(item, currentTime);
    const cancelReasonText = getCancelledReservationReason(item, VIEWER_ROLE.SELLER);
    const showActiveDisputeHint = isActiveDisputeOrder(item);
    const unitPrice =
      item.agreedPrice != null
        ? Number(item.agreedPrice)
        : item.variant?.price != null
          ? Number(item.variant.price)
          : qty > 0
            ? Math.round(Number(item.totalAmount || 0) / qty)
            : 0;

    return (
      <View style={styles.card}>
        <Pressable
          onPress={() =>
            onOpenReservation?.({
              item,
              listCancelReasonText: cancelReasonText,
              fromTab: activeTab,
            })
          }
        >
          <OrderItemHeader
            id={item.id}
            statusLabel={statusLabel}
            statusBadgeStyle={statusStyle.badge}
            statusTextStyle={statusStyle.text}
            orderCodeStyle={useBlackOrderCode ? styles.orderCodeBlack : undefined}
            unitPriceStyle={useBlackUnitPrice ? styles.unitPriceBlack : undefined}
            thumbnail={thumb}
            productName={productName}
            variantName={item.variant?.variantName || ''}
            quantity={qty}
            unitPriceText={formatPrice(unitPrice)}
            lineTotalText={formatPrice(item.totalAmount)}
            priceRowMeta
          >
            {item.pickupTime ? (
              <Text style={styles.infoLinePickup}>
                Giờ nhận hàng: {formatOrderTime(item.pickupTime)}
              </Text>
            ) : (
              <Text style={styles.infoLinePickup}>Giữ: {formatOrderTime(item.createdAt)}</Text>
            )}
            {item.status === RESERVATION_STATUS.WAITING_PICKUP &&
            pastPickup &&
            !showActiveDisputeHint ? (
              <Text style={styles.infoLineDanger}>
                {isWithinDepositDecisionWindow(item, currentTime)
                  ? 'Trong 24h bạn có thể khiếu nại và chờ admin xử lý hoặc hoàn cọc cho người mua.'
                  : 'Đã quá 24 giờ sau giờ nhận. Cọc mặc định đã chuyển cho bạn.'}
              </Text>
            ) : null}
            <OrderDisputeListHints item={item} viewerRole={VIEWER_ROLE.SELLER} />
            {!showActiveDisputeHint && cancelReasonText ? (
              <Text style={styles.infoLineDanger}>{cancelReasonText}</Text>
            ) : null}
          </OrderItemHeader>
        </Pressable>

        {canConfirm ? (
          <View style={styles.actionRow}>
            <Pressable
              style={[styles.actionButton, styles.actionButtonFlex]}
              onPress={() => handleConfirmReservation(item)}
            >
              <Text style={styles.actionButtonText}>Đồng ý</Text>
            </Pressable>
            <Pressable
              style={[styles.actionButton, styles.actionButtonDanger, styles.actionButtonFlex]}
              onPress={() => handleRejectReservation(item)}
            >
              <Text style={styles.actionButtonTextDanger}>Từ chối</Text>
            </Pressable>
          </View>
        ) : null}

        {canReportBuyer ? (
          <Pressable
            style={styles.reportButton}
            onPress={() => setDisputeTarget(item)}
          >
            <Text style={styles.reportButtonText}>Báo cáo người mua không đến</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SubScreenHeader title="Đơn hàng" onBack={onBack} />

      <OrderStatusTabBar
        tabs={ORDER_STATUS_TABS}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
      />

      <View style={styles.searchBar}>
        <ClearableSearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm theo sản phẩm, khách, mã đơn..."
        />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#076F32" />
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.nestedScrollPaddingBottom },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={renderReservationItem}
          ListEmptyComponent={
            <OrderTabEmptyState
              message={
                search.trim() ? ORDER_TAB_SEARCH_EMPTY_MESSAGE : ORDER_TAB_EMPTY_MESSAGE
              }
            />
          }
        />
      )}

      <ReservationDisputeModal
        visible={Boolean(disputeTarget)}
        mode="seller"
        onClose={() => setDisputeTarget(null)}
        onSubmit={handleSubmitBuyerNoShow}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f1f5f9' },
  header: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
  },
  listContent: { padding: 16, flexGrow: 1 },
  searchBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: '#f1f5f9',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  orderCodeBlack: {
    color: '#0f172a',
  },
  unitPriceBlack: {
    color: '#0f172a',
  },
  statusBadgePending: {
    backgroundColor: '#fef3c7',
  },
  statusBadgeTextPending: {
    color: '#b45309',
  },
  statusBadgeSuccess: {
    backgroundColor: '#E6F4EC',
  },
  statusBadgeTextSuccess: {
    color: '#076F32',
  },
  statusBadgeInfo: {
    backgroundColor: '#e0f2fe',
  },
  statusBadgeTextInfo: {
    color: '#0369a1',
  },
  statusBadgeDanger: {
    backgroundColor: '#fee2e2',
  },
  statusBadgeTextDanger: {
    color: '#b91c1c',
  },
  infoLineStrong: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
  infoLineDeposit: {
    color: '#055528',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
  infoLinePickup: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  infoLineMuted: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  infoLineDanger: {
    color: '#b91c1c',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  sectionHeading: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.4,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    minHeight: 40,
    borderRadius: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#076F32',
  },
  actionButtonFlex: {
    flexGrow: 1,
    flexBasis: '30%',
  },
  actionButtonDanger: {
    backgroundColor: '#fee2e2',
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
  actionButtonTextDanger: {
    color: '#b91c1c',
    fontWeight: '800',
    fontSize: 13,
  },
  reportButton: {
    marginTop: 12,
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fdba74',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  reportButtonText: {
    color: '#c2410c',
    fontWeight: '800',
    fontSize: 13,
    textAlign: 'center',
  },
  centered: { alignItems: 'center', paddingVertical: 40 },
  errorText: {
    color: '#b91c1c',
    paddingHorizontal: 16,
    paddingTop: 8,
    fontWeight: '700',
  },
});
