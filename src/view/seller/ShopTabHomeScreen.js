import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';

import { buyerTheme as t } from '../../core/theme/buyerTheme';
import { formatPrice } from '../../core/utils/productFormat';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import {
  selectAuthProfile,
  selectCanSwitchToSeller,
  selectIsSeller,
  selectSellerVerification,
  selectUserRole,
} from '../../viewmodel/auth/authSelectors';
import { getSellerRegisterButtonLabel } from './sellerRegistrationFlow';
import { SELLER_VERIFICATION_STATUS } from '../../constants/sellerVerification';

const HUB_ITEMS = [
  { key: 'stats', label: 'Thống kê', icon: 'stats-chart-outline', action: 'stats' },
  { key: 'post', label: 'Đăng bài sản phẩm', icon: 'add-circle-outline', action: 'post' },
  { key: 'products', label: 'Sản phẩm', icon: 'cube-outline', action: 'products' },
  { key: 'orders', label: 'Đơn bán', icon: 'receipt-outline', action: 'orders' },
  { key: 'pickup-qr', label: 'QR nhận hàng', icon: 'qr-code-outline', action: 'pickup-qr' },
  { key: 'reviews', label: 'Đánh giá', icon: 'star-outline', action: 'reviews' },
  { key: 'settings', label: 'Cài đặt shop', icon: 'storefront-outline', action: 'settings' },
  { key: 'subscription', label: 'Gói bán', icon: 'diamond-outline', action: 'subscription' },
  { key: 'banner', label: 'Banner', icon: 'images-outline', action: 'banner' },
];

export default function ShopTabHomeScreen({
  shopSettings = null,
  unreadNotificationsCount = 0,
  onStartRegister,
  onOpenHub,
  onOpenWallet,
  onOpenWalletTopUp,
}) {
  const insets = useScreenInsets();
  const profile = useSelector(selectAuthProfile);
  const role = useSelector(selectUserRole);
  const isSeller = useSelector(selectIsSeller);
  const canSwitchToSeller = useSelector(selectCanSwitchToSeller);
  const verification = useSelector(selectSellerVerification);
  const registerLabel = getSellerRegisterButtonLabel({ role, verification });

  const isPending = verification?.status === SELLER_VERIFICATION_STATUS.PENDING;
  const isRejected = verification?.status === SELLER_VERIFICATION_STATUS.REJECTED;
  const showManageHub = Boolean(canSwitchToSeller && isSeller);
  const notificationBadgeCount = Math.max(0, Number(unreadNotificationsCount) || 0);
  const shopName = profile?.fullName || shopSettings?.shopName || 'Gian hàng của bạn';
  const subscriptionActive = Boolean(
    shopSettings?.subscriptionActive || profile?.subscriptionActive
  );
  const purchasedAt = shopSettings?.ngayMua || profile?.ngayMua || null;
  const expiresAt =
    shopSettings?.subscriptionExpiresAt ||
    shopSettings?.ngayHetHan ||
    profile?.subscriptionExpiresAt ||
    null;

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '—';
    return date.toLocaleDateString('vi-VN');
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.contentPaddingTop }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.tabRootScrollPaddingBottom },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="storefront" size={22} color="#ffffff" />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Gian hàng</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {showManageHub ? shopName : 'Mở gian hàng và bán hàng trên FastMark'}
            </Text>
          </View>
          {showManageHub ? (
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => onOpenHub?.('preview')}
                style={({ pressed }) => [styles.headerActionBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Xem shop"
                hitSlop={8}
              >
                <Ionicons name="eye-outline" size={18} color="#64748b" />
              </Pressable>
              <Pressable
                onPress={() => onOpenHub?.('notifications')}
                style={({ pressed }) => [styles.headerActionBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Thông báo"
                hitSlop={8}
              >
                <Ionicons name="notifications-outline" size={18} color="#64748b" />
                {notificationBadgeCount > 0 ? (
                  <View style={styles.headerBadge}>
                    <Text style={styles.headerBadgeText}>
                      {notificationBadgeCount > 9 ? '9+' : String(notificationBadgeCount)}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            </View>
          ) : null}
        </View>

        {!showManageHub ? (
          <View style={styles.registerBanner}>
            <View style={styles.registerBannerIcon}>
              <Ionicons name="storefront-outline" size={28} color={t.primary} />
            </View>
            <Text style={styles.registerBannerTitle}>
              {isPending
                ? 'Hồ sơ đang chờ duyệt'
                : isRejected
                  ? 'Hồ sơ cần chỉnh sửa'
                  : 'Đăng ký bán hàng'}
            </Text>
            <Text style={styles.registerBannerBody}>
              {isPending
                ? 'Admin đang xét duyệt. Bạn có thể xem trạng thái hoặc chỉnh sửa hồ sơ nếu được yêu cầu.'
                : isRejected
                  ? 'Hồ sơ bị từ chối. Hãy cập nhật lại thông tin để gửi duyệt lần nữa.'
                  : 'Tạo gian hàng, đăng sản phẩm và nhận đơn gần bạn. Ví FastMark dùng chung với tài khoản mua hàng.'}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.registerCta, pressed && styles.pressed]}
              onPress={onStartRegister}
            >
              <Text style={styles.registerCtaText}>
                {registerLabel || 'Đăng ký người bán'}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#ffffff" />
            </Pressable>
          </View>
        ) : (
          <>
            <Pressable
              style={({ pressed }) => [styles.statusCard, pressed && styles.pressed]}
              onPress={() => onOpenHub?.('subscription')}
            >
              <View style={styles.statusCardHeader}>
                <Text style={styles.statusTitle}>{shopName}</Text>
                <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
              </View>
              {subscriptionActive ? (
                <View style={styles.planMeta}>
                  <Text style={styles.statusMeta}>Ngày mua: {formatDate(purchasedAt)}</Text>
                  <Text style={styles.statusMeta}>Hết hạn: {formatDate(expiresAt)}</Text>
                  <Text style={styles.statusLink}>Xem chi tiết các gói đã mua</Text>
                </View>
              ) : (
                <Text style={styles.statusSub}>
                  Chưa có gói — gian hàng đang ẩn công khai
                </Text>
              )}
            </Pressable>

            <Text style={styles.sectionTitle}>Quản lý gian hàng</Text>

            <Pressable
              style={({ pressed }) => [styles.walletCard, pressed && styles.pressed]}
              onPress={() => onOpenWallet?.()}
            >
              <View style={styles.walletCardTop}>
                <Ionicons name="wallet-outline" size={18} color="#fff" />
                <Text style={styles.walletCardTitle}>Ví FastMark</Text>
              </View>
              <Text style={styles.walletCardBalance}>
                {formatPrice(profile?.walletBalance || 0)}
              </Text>
              <Pressable
                onPress={(event) => {
                  event?.stopPropagation?.();
                  onOpenWalletTopUp?.();
                }}
                hitSlop={8}
              >
                <Text style={styles.walletCardCta}>Nạp tiền ngay →</Text>
              </Pressable>
            </Pressable>

            <View style={styles.hubGrid}>
              {HUB_ITEMS.map((item) => (
                <Pressable
                  key={item.key}
                  style={({ pressed }) => [styles.hubItem, pressed && styles.pressed]}
                  onPress={() => onOpenHub?.(item.action)}
                >
                  <View style={styles.hubIconWrap}>
                    <Ionicons name={item.icon} size={22} color={t.primary} />
                  </View>
                  <Text style={styles.hubLabel}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafb',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  pressed: {
    opacity: 0.88,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: t.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  headerBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  headerBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  registerBanner: {
    backgroundColor: t.primarySoft,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#A7D9B8',
  },
  registerBannerIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  registerBannerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: t.primaryDark,
    marginBottom: 8,
  },
  registerBannerBody: {
    fontSize: 14,
    lineHeight: 21,
    color: '#334155',
    marginBottom: 18,
  },
  registerCta: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: t.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  registerCtaText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  statusCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 18,
  },
  statusCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  planMeta: {
    marginTop: 6,
    gap: 2,
  },
  statusSub: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: t.primaryDark,
    fontWeight: '700',
  },
  statusMeta: {
    fontSize: 13,
    lineHeight: 18,
    color: '#475569',
    fontWeight: '600',
  },
  statusLink: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: t.primary,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
  },
  walletCard: {
    marginBottom: 14,
    backgroundColor: t.primaryDark,
    borderRadius: 16,
    padding: 16,
  },
  walletCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  walletCardTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  walletCardBalance: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 8,
  },
  walletCardCta: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    fontWeight: '700',
  },
  hubGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  hubItem: {
    width: '31%',
    flexGrow: 1,
    minWidth: '30%',
    maxWidth: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 8,
  },
  hubIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: t.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
});
