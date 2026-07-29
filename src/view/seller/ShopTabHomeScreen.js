import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';

import { getSellerStatsOnBackend, uploadShopAvatarOnBackend } from '../../api/sellerOpsApi';
import { buyerTheme as t } from '../../core/theme/buyerTheme';
import { formatPrice } from '../../core/utils/productFormat';
import { isRemoteAvatarUrl } from '../../core/utils/avatarInitial';
import { pickImageBase64 } from '../../core/utils/pickImageBase64';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import {
  selectAuthProfile,
  selectCanSwitchToSeller,
  selectIsSeller,
  selectSellerVerification,
  selectUserRole,
} from '../../viewmodel/auth/authSelectors';
import { applyShopSettingsToProfile } from '../../viewmodel/auth/authSlice';
import AvatarBadge from '../shared/components/AvatarBadge';
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

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleDateString('vi-VN');
}

function OverviewStatCard({ icon, label, value, subValue }) {
  return (
    <View style={styles.overviewStatCard}>
      <View style={styles.overviewStatIcon}>
        <Ionicons name={icon} size={16} color={t.primary} />
      </View>
      <Text style={styles.overviewStatValue}>{value}</Text>
      <Text style={styles.overviewStatLabel}>{label}</Text>
      {subValue ? <Text style={styles.overviewStatSub}>{subValue}</Text> : null}
    </View>
  );
}

function EditableShopAvatar({ name, uri, onPress, isUploading }) {
  return (
    <View style={styles.shopAvatarWrap}>
      <AvatarBadge name={name} uri={uri} size={88} />
      <Pressable
        disabled={isUploading}
        onPress={onPress}
        style={({ pressed }) => [styles.shopAvatarEditBtn, pressed && styles.avatarEditPressed]}
      >
        {isUploading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name="camera" size={14} color="#fff" />
        )}
      </Pressable>
    </View>
  );
}

export default function ShopTabHomeScreen({
  shopSettings = null,
  unreadNotificationsCount = 0,
  isVisible = false,
  onStartRegister,
  onOpenHub,
  onOpenWallet,
  onShopSettingsUpdated,
}) {
  const dispatch = useDispatch();
  const insets = useScreenInsets();
  const profile = useSelector(selectAuthProfile);
  const role = useSelector(selectUserRole);
  const isSeller = useSelector(selectIsSeller);
  const canSwitchToSeller = useSelector(selectCanSwitchToSeller);
  const verification = useSelector(selectSellerVerification);
  const registerLabel = getSellerRegisterButtonLabel({ role, verification });

  const [stats, setStats] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isUploadingShopAvatar, setIsUploadingShopAvatar] = useState(false);

  const isPending = verification?.status === SELLER_VERIFICATION_STATUS.PENDING;
  const isRejected = verification?.status === SELLER_VERIFICATION_STATUS.REJECTED;
  const showManageHub = Boolean(canSwitchToSeller && isSeller);
  const notificationBadgeCount = Math.max(0, Number(unreadNotificationsCount) || 0);
  const shopName = shopSettings?.shopName || profile?.shopName || 'Gian hàng của bạn';
  const shopUsername = shopSettings?.shopUsername || profile?.shopUsername || '';
  const purchasedAt = shopSettings?.ngayMua || profile?.ngayMua || null;
  const expiresAt =
    shopSettings?.subscriptionExpiresAt ||
    shopSettings?.ngayHetHan ||
    profile?.subscriptionExpiresAt ||
    null;
  const avatarUrl =
    (isRemoteAvatarUrl(shopSettings?.shopAvatar) && shopSettings.shopAvatar) ||
    (isRemoteAvatarUrl(profile?.shopAvatar) && profile.shopAvatar) ||
    '';

  const loadStats = useCallback(async () => {
    if (!showManageHub) {
      return;
    }

    setIsLoadingStats(true);
    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        return;
      }
      const data = await getSellerStatsOnBackend(idToken);
      setStats(data);
    } catch {
      setStats(null);
    } finally {
      setIsLoadingStats(false);
    }
  }, [showManageHub]);

  async function handlePickShopAvatar() {
    try {
      const picked = await pickImageBase64();
      if (!picked) {
        return;
      }

      setIsUploadingShopAvatar(true);
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        throw new Error('Phiên đăng nhập đã hết hạn.');
      }

      const updated = await uploadShopAvatarOnBackend({
        idToken,
        imageBase64: picked.imageBase64,
        mimeType: picked.mimeType,
      });

      if (updated) {
        dispatch(applyShopSettingsToProfile(updated));
        onShopSettingsUpdated?.(updated);
      }

      Alert.alert('Thành công', 'Đã cập nhật ảnh gian hàng.');
    } catch (pickError) {
      Alert.alert('Lỗi', pickError.message || 'Không upload được ảnh gian hàng.');
    } finally {
      setIsUploadingShopAvatar(false);
    }
  }

  useEffect(() => {
    if (!isVisible || !showManageHub) {
      return;
    }
    loadStats();
  }, [isVisible, showManageHub, loadStats]);

  const reservations = stats?.reservations || {};
  const orderCount = String(reservations.total ?? 0);
  const productCount = String(stats?.totalProducts ?? profile?.totalProducts ?? 0);
  const ratingValue =
    Number(stats?.averageRating ?? profile?.averageRating ?? 0) > 0
      ? Number(stats?.averageRating ?? profile?.averageRating).toFixed(1)
      : '—';
  const reviewCount = stats?.totalReviews ?? profile?.totalReviews ?? 0;

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: 8,
            paddingBottom: insets.tabRootScrollPaddingBottom,
          },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="storefront" size={22} color="#ffffff" />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Gian hàng</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {showManageHub ? 'Quản lý cửa hàng của bạn' : 'Mở gian hàng và bán hàng trên FastMark'}
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
                      {notificationBadgeCount > 99 ? '99+' : String(notificationBadgeCount)}
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
            <View style={styles.shopCard}>
              <View style={styles.shopCardMain}>
                <EditableShopAvatar
                  name={shopName}
                  uri={avatarUrl}
                  onPress={handlePickShopAvatar}
                  isUploading={isUploadingShopAvatar}
                />

                <View style={styles.shopCardInfo}>
                  <Text style={styles.shopName} numberOfLines={1}>
                    {shopName}
                  </Text>
                  {shopUsername ? (
                    <Text style={styles.shopUsername} numberOfLines={1}>
                      @{shopUsername}
                    </Text>
                  ) : null}
                  <View style={styles.shopMetaRow}>
                    <Ionicons name="calendar-outline" size={13} color="#64748b" />
                    <Text style={styles.shopMetaText}>
                      Ngày tham gia: {formatDate(purchasedAt)}
                    </Text>
                  </View>
                  <View style={styles.shopMetaRow}>
                    <Ionicons name="time-outline" size={13} color="#64748b" />
                    <Text style={styles.shopMetaText}>Hết hạn: {formatDate(expiresAt)}</Text>
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.shopWalletRow, pressed && styles.pressed]}
                    onPress={() => onOpenWallet?.()}
                  >
                    <Ionicons name="wallet-outline" size={13} color={t.primary} />
                    <Text style={styles.shopWalletRowLabel}>Ví FastMark:</Text>
                    <Text style={styles.shopWalletRowBalance}>
                      {formatPrice(profile?.walletBalance || 0)}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [styles.packagesRow, pressed && styles.pressed]}
                onPress={() => onOpenHub?.('subscription')}
              >
                <Ionicons name="bag-handle-outline" size={18} color={t.primary} />
                <Text style={styles.packagesRowText}>Xem chi tiết các gói đã mua</Text>
                <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
              </Pressable>
            </View>

            <View style={styles.overviewSection}>
              <Text style={styles.sectionTitle}>Tổng quan gian hàng</Text>

              {isLoadingStats && !stats ? (
                <ActivityIndicator color={t.primary} style={styles.statsLoader} />
              ) : (
                <View style={styles.overviewGrid}>
                  <OverviewStatCard icon="bag-handle-outline" label="Đơn hàng" value={orderCount} />
                  <OverviewStatCard icon="cube-outline" label="Sản phẩm" value={productCount} />
                  <OverviewStatCard
                    icon="star-outline"
                    label={reviewCount ? `Đánh giá (${reviewCount})` : 'Đánh giá'}
                    value={ratingValue}
                  />
                </View>
              )}
            </View>

            <Text style={styles.sectionTitle}>Quản lý gian hàng</Text>

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
    backgroundColor: '#f4f7f6',
  },
  content: {
    paddingHorizontal: 16,
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
    width: 40,
    height: 40,
    borderRadius: 20,
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
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  headerBadgeText: {
    color: '#ffffff',
    fontSize: 10,
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
  shopCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e8f0eb',
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  shopCardMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 14,
  },
  shopAvatarWrap: {
    width: 88,
    height: 88,
    position: 'relative',
  },
  shopAvatarEditBtn: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#076F32',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  avatarEditPressed: {
    opacity: 0.85,
  },
  shopCardInfo: {
    flex: 1,
    minWidth: 0,
  },
  shopName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  shopUsername: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  shopMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  shopMetaText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    flexShrink: 1,
  },
  shopWalletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  shopWalletRowLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  shopWalletRowBalance: {
    fontSize: 12,
    fontWeight: '800',
    color: t.primary,
  },
  packagesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  packagesRowText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  overviewSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
  },
  statsLoader: {
    paddingVertical: 24,
  },
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  overviewStatCard: {
    width: '31%',
    flexGrow: 1,
    minWidth: '30%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e8f0eb',
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  overviewStatIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: t.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  overviewStatValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  overviewStatLabel: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textAlign: 'center',
  },
  overviewStatSub: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
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
