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
import {
  RESERVATION_TAB,
  RESERVATION_STATUS,
  RESERVATION_STATUS_LABELS,
  getCancelledReservationReason,
} from '../../constants/sellerOrders';
import ClearableSearchField from '../shared/components/ClearableSearchField';
import OrderItemHeader from '../shared/components/OrderItemHeader';
import ReservationDisputeModal from '../shared/components/ReservationDisputeModal';
import SubScreenHeader from '../shared/components/SubScreenHeader';
import { formatPrice } from '../../core/utils/productFormat';
import { useScreenInsets } from '../../hooks/useScreenInsets';

const TABS = [
  { key: RESERVATION_TAB.HOLDING, label: 'Giữ hàng' },
  { key: RESERVATION_TAB.COMPLETED, label: 'Hoàn thành' },
  { key: RESERVATION_TAB.CANCELLED, label: 'Đã hủy' },
];

function getReservationStatusStyle(status) {
  if (status === RESERVATION_STATUS.WAITING_PICKUP) {
    return { badge: styles.statusBadgeSuccess, text: styles.statusBadgeTextSuccess };
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
}) {
  const insets = useScreenInsets();
  const [activeTab, setActiveTab] = useState(RESERVATION_TAB.HOLDING);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [disputeTarget, setDisputeTarget] = useState(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const idToken = await getCurrentUserIdToken();
      const data = await getSellerOrdersOnBackend({ idToken, tab: activeTab });
      setItems(data.reservations || []);
    } catch (loadError) {
      setError(loadError.message || 'Không tải được đơn hàng.');
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    setSearch('');
    loadOrders();
  }, [loadOrders, onRefreshKey]);

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
    const buyerName = item.buyer?.fullName || 'Khách';
    const canConfirm = item.status === RESERVATION_STATUS.PENDING_SELLER_CONFIRMATION;
    const canReportBuyer = canReportBuyerNoShow(item, currentTime);
    const cancelReasonText = getCancelledReservationReason(item);
    const showActiveDisputeHint = item.status === RESERVATION_STATUS.DISPUTED;
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
        <Pressable onPress={() => onOpenReservation?.(item.id)}>
          <OrderItemHeader
            id={item.id}
            statusLabel={statusLabel}
            statusBadgeStyle={statusStyle.badge}
            statusTextStyle={statusStyle.text}
            thumbnail={thumb}
            productName={productName}
            variantName={item.variant?.variantName || ''}
            quantity={qty}
            unitPriceText={formatPrice(unitPrice)}
            partyLine={`Khách: ${buyerName}`}
          >
            <Text style={styles.infoLineStrong}>
              Tổng tiền: {formatPrice(item.totalAmount)}
            </Text>
            {Number(item.depositAmount) > 0 ? (
              <Text style={styles.infoLineDeposit}>
                Đã cọc {formatPrice(item.depositAmount)}
                {item.depositPaidAt ? '' : ' (chưa trừ ví)'}
              </Text>
            ) : null}
            {item.pickupTime ? (
              <Text style={styles.infoLineMuted}>
                Giờ lấy: {formatOrderTime(item.pickupTime)}
              </Text>
            ) : (
              <Text style={styles.infoLineMuted}>Giữ: {formatOrderTime(item.createdAt)}</Text>
            )}
            {item.status === RESERVATION_STATUS.WAITING_PICKUP ? (
              <Text style={styles.infoLineMuted}>
                Đưa QR gian hàng cho khách quét để hoàn tất.
              </Text>
            ) : null}
            {showActiveDisputeHint ? (
              <Text style={styles.infoLineDanger}>
                {item.disputeByBuyer && item.disputeBySeller
                  ? 'Đang tranh chấp — cả hai bên đã báo cáo. Cọc đang giữ chờ admin.'
                  : item.disputeByBuyer
                    ? 'Người mua đã báo cáo. Cọc đang giữ chờ admin xử lý.'
                    : item.disputeBySeller
                      ? 'Bạn đã báo cáo người mua. Cọc đang giữ chờ admin xử lý.'
                      : 'Đang tranh chấp. Cọc đang giữ chờ admin xử lý.'}
              </Text>
            ) : null}
            {cancelReasonText ? (
              <Text style={styles.infoLineDanger}>Lý do: {cancelReasonText}</Text>
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
      {embedded ? (
        <View style={styles.header}>
          <Text style={styles.title}>Đơn hàng</Text>
        </View>
      ) : (
        <SubScreenHeader title="Đơn hàng" onBack={onBack} />
      )}

      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]} numberOfLines={1}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

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
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                {search.trim() ? 'Không tìm thấy đơn phù hợp.' : 'Chưa có đơn trong mục này.'}
              </Text>
            </View>
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
  tabRow: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'stretch',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tabItem: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minHeight: 38,
    marginHorizontal: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
  },
  tabItemActive: {
    borderColor: '#076F32',
    backgroundColor: '#E6F4EC',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textAlign: 'center',
  },
  tabTextActive: {
    color: '#076F32',
    fontWeight: '800',
  },
  listContent: { padding: 16 },
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
    marginTop: 2,
  },
  infoLineDeposit: {
    color: '#055528',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  infoLineMuted: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  infoLineDanger: {
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
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
  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: '#64748b', fontWeight: '600' },
  errorText: {
    color: '#b91c1c',
    paddingHorizontal: 16,
    paddingTop: 8,
    fontWeight: '700',
  },
});
