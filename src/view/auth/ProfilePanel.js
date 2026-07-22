import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import {
  selectAuthProfile,
  selectAuthUser,
  selectIsSeller,
} from '../../viewmodel/auth/authSelectors';
import {
  applyShopSettingsToProfile,
  loadUserProfile,
  logoutUser,
  syncSellerAccess,
} from '../../viewmodel/auth/authSlice';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { getSellerShopSettingsOnBackend } from '../../api/sellerOpsApi';
import AccountProfileScreen from '../profile/AccountProfileScreen';
import EditAccountScreen from '../profile/EditAccountScreen';
import FollowConnectionsScreen from '../profile/FollowConnectionsScreen';
import MyActivityScreen from '../profile/MyActivityScreen';
import NotificationSettingsScreen from '../profile/NotificationSettingsScreen';
import PurchasedProductsScreen from '../profile/PurchasedProductsScreen';
import ReservationHistoryScreen from '../profile/ReservationHistoryScreen';
import VisitedStoresScreen from '../profile/VisitedStoresScreen';
import SellerPhoneSetupScreen from '../seller/SellerPhoneSetupScreen';
import SellerRegistrationScreen from '../seller/SellerRegistrationScreen';
import SellerVerificationStatusScreen from '../seller/SellerVerificationStatusScreen';
import SellerProductDetailScreen from '../seller/SellerProductDetailScreen';
import ProductDetailScreen from '../store/ProductDetailScreen';
import SellerShopSettingsScreen from '../seller/SellerShopSettingsScreen';
import SellerReviewsManageScreen from '../seller/SellerReviewsManageScreen';
import SellerOrdersScreen from '../seller/SellerOrdersScreen';
import SellerOrderDetailScreen from '../seller/SellerOrderDetailScreen';
import SellerStatsScreen from '../seller/SellerStatsScreen';
import SellerProductsTabScreen from '../seller/SellerProductsTabScreen';
import SellerSubscriptionScreen from '../seller/SellerSubscriptionScreen';
import SellerBannerScreen from '../seller/SellerBannerScreen';
import BuyerOrdersScreen from '../buyer/BuyerOrdersScreen';
import FavoriteProductsScreen from '../buyer/FavoriteProductsScreen';
import AccountReportScreen from '../profile/AccountReportScreen';
import StoreDetailScreen from '../store/StoreDetailScreen';
import InboxScreen from '../inbox/InboxScreen';
import TopUpScreen from '../wallet/TopUpScreen';
import TopUpSuccessScreen from '../wallet/TopUpSuccessScreen';
import WalletTransactionsScreen from '../wallet/WalletTransactionsScreen';
import WithdrawScreen from '../wallet/WithdrawScreen';
import WalletScreen from '../wallet/WalletScreen';
import { getSellerRegistrationStep } from '../seller/sellerRegistrationFlow';
import { SELLER_VERIFICATION_STATUS } from '../../constants/sellerVerification';
import { RESERVATION_TAB } from '../../constants/sellerOrders';
import { resolveTopupReturnViewModel } from '../../viewmodel/wallet/walletViewModel';
import { subscribeTopupDeepLink } from '../../viewmodel/wallet/topupSession';

export default function ProfilePanel({
  profileMode = 'buyer',
  showSellerHub = false,
  onOpenStore,
  onNavigateToStore,
  onOpenInbox,
  onOpenChat,
  onNavigatePickup,
  sellerRegisterRequest = 0,
  isProfileVisible = false,
  productDetailId = null,
  productRefreshKey = 0,
  onOpenProductDetail,
  onProductChanged,
  onSwitchToSellerMode,
  onSwitchToBuyerMode,
  canSwitchToSeller = false,
  profileNavRequest = null,
  onStartSellerRegister,
  onOpenShopTab,
  onContinueReservationAfterTopUp,
  onNavigationStateChange,
}) {
  const dispatch = useDispatch();
  const profile = useSelector(selectAuthProfile);
  const user = useSelector(selectAuthUser);
  const isSeller = useSelector(selectIsSeller);
  const [profileNav, setProfileNav] = useState(null);
  const [followConnectionsTab, setFollowConnectionsTab] = useState('following');
  const [sellerStep, setSellerStep] = useState(null);
  const [sellerVerification, setSellerVerification] = useState(null);
  const [selectedReservationId, setSelectedReservationId] = useState(null);
  const [ordersRefreshKey, setOrdersRefreshKey] = useState(0);
  const [phoneChangeReturn, setPhoneChangeReturn] = useState(null);
  const [shopContactRefreshKey, setShopContactRefreshKey] = useState(0);
  const [shopSettings, setShopSettings] = useState(null);
  const [topUpResult, setTopUpResult] = useState(null);
  const [topUpReturnNav, setTopUpReturnNav] = useState('wallet');
  const [buyerOrdersTab, setBuyerOrdersTab] = useState(RESERVATION_TAB.HOLDING);
  const [buyerOrdersTabKey, setBuyerOrdersTabKey] = useState(0);
  const [productStoreId, setProductStoreId] = useState(null);
  const [chatOpenRequest, setChatOpenRequest] = useState(null);

  const handleOpenChatLocal = useCallback(({ shopId, shopName }) => {
    if (!shopId) {
      return;
    }
    setChatOpenRequest({
      shopId: String(shopId),
      shopName: shopName || 'Gian hàng',
      at: Date.now(),
    });
  }, []);
  const handledProfileNavRef = useRef(0);
  const handledRegisterRequestRef = useRef(0);

  const loadShopSettings = useCallback(async () => {
    if (!isProfileVisible || (!isSeller && !showSellerHub)) {
      return;
    }

    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        return;
      }

      const shop = await getSellerShopSettingsOnBackend(idToken);
      setShopSettings(shop);
      dispatch(applyShopSettingsToProfile(shop));
    } catch {
      // Keep the last known shop settings on transient failures.
    }
  }, [dispatch, isProfileVisible, isSeller, showSellerHub]);

  useEffect(() => {
    loadShopSettings();
  }, [loadShopSettings, shopContactRefreshKey]);

  useEffect(() => {
    if (!user) {
      return;
    }
    // Luôn refresh khi mở lại tab Tài khoản để số follow/following mới nhất.
    if (isProfileVisible) {
      dispatch(loadUserProfile());
    }
  }, [dispatch, user, isProfileVisible]);

  async function startSellerRegistration() {
    if (canSwitchToSeller) {
      return;
    }

    try {
      const result = await dispatch(syncSellerAccess()).unwrap();
      const latestProfile = result?.profile || profile;
      const verification = result?.verification || null;
      const nextStep = getSellerRegistrationStep(latestProfile, verification);
      setSellerVerification(verification);
      setSellerStep(nextStep);
    } catch {
      const nextStep = getSellerRegistrationStep(profile, null);
      setSellerVerification(null);
      setSellerStep(nextStep);
    }
  }

  useEffect(() => {
    if (!isProfileVisible) {
      setProfileNav(null);
      setSellerStep(null);
      setSelectedReservationId(null);
      setPhoneChangeReturn(null);
      return;
    }
  }, [isProfileVisible]);

  useEffect(() => {
    if (!isProfileVisible || !sellerRegisterRequest) {
      return;
    }
    if (handledRegisterRequestRef.current === sellerRegisterRequest) {
      return;
    }
    handledRegisterRequestRef.current = sellerRegisterRequest;
    startSellerRegistration();
  }, [isProfileVisible, sellerRegisterRequest]);

  useEffect(() => {
    if (!isProfileVisible || !profileNavRequest?.screen) {
      return;
    }
    const requestAt = profileNavRequest.at || 0;
    if (handledProfileNavRef.current === requestAt && requestAt) {
      return;
    }
    if (requestAt) {
      handledProfileNavRef.current = requestAt;
    }
    if (profileNavRequest.screen === 'wallet-topup') {
      setTopUpReturnNav('wallet');
    }
    setProfileNav(profileNavRequest.screen);
  }, [isProfileVisible, profileNavRequest]);

  useEffect(() => {
    return subscribeTopupDeepLink(async (parsed) => {
      if (parsed?.cancelled || !isProfileVisible) {
        return;
      }
      try {
        const resolved = await resolveTopupReturnViewModel(parsed);
        if (resolved?.transaction?.status === 1) {
          setTopUpResult({
            amount: resolved.transaction.amount,
            orderCode: resolved.transaction.orderCode,
            balance: resolved.wallet?.balance,
          });
          dispatch(loadUserProfile());
          setProfileNav('wallet-success');
        }
      } catch {
        // User can sync manually from wallet history.
      }
    });
  }, [dispatch, isProfileVisible]);

  function openTopUp(returnNav = 'wallet') {
    setTopUpReturnNav(returnNav || 'wallet');
    setProfileNav('wallet-topup');
  }

  useEffect(() => {
    // Hub Tài khoản: hiện bottom nav. Mọi màn phụ: ẩn.
    const nested = Boolean(
      isProfileVisible &&
        (sellerStep || profileNav || productDetailId || productStoreId || chatOpenRequest)
    );
    onNavigationStateChange?.(nested);
  }, [
    chatOpenRequest,
    isProfileVisible,
    onNavigationStateChange,
    productDetailId,
    productStoreId,
    profileNav,
    sellerStep,
  ]);

  useEffect(() => {
    if (!productDetailId) {
      setProductStoreId(null);
    }
  }, [productDetailId]);

  const openBuyerPreview = useCallback(async () => {
    let shop = shopSettings;

    if (!shop?.id && !shop?.shopId) {
      try {
        const idToken = await getCurrentUserIdToken();
        if (!idToken) {
          throw new Error('Phiên đăng nhập đã hết hạn.');
        }

        shop = await getSellerShopSettingsOnBackend(idToken);
        setShopSettings(shop);
        dispatch(applyShopSettingsToProfile(shop));
      } catch (error) {
        Alert.alert('Không mở được chế độ xem', error.message || 'Vui lòng thử lại sau.');
        return;
      }
    }

    const storeId = shop?.id || shop?.shopId;
    if (!storeId) {
      Alert.alert('Không mở được chế độ xem', 'Chưa tìm thấy cửa hàng của bạn.');
      return;
    }

    setProfileNav('buyer-preview');
  }, [dispatch, shopSettings]);

  if (sellerStep === 'phone' || sellerStep === 'verify') {
    return (
      <SellerPhoneSetupScreen
        mode={phoneChangeReturn ? 'change' : 'register'}
        onBack={() => {
          const returnNav = phoneChangeReturn;
          setPhoneChangeReturn(null);
          setSellerStep(null);
          if (returnNav) {
            setProfileNav(returnNav);
          }
        }}
        onVerified={async () => {
          if (phoneChangeReturn) {
            await dispatch(syncSellerAccess());
            const returnNav = phoneChangeReturn;
            setPhoneChangeReturn(null);
            setSellerStep(null);
            setShopContactRefreshKey((value) => value + 1);
            setProfileNav(returnNav);
            return;
          }
          try {
            const result = await dispatch(syncSellerAccess()).unwrap();
            setSellerVerification(result?.verification || null);
          } catch {
            setSellerVerification(null);
          }
          setSellerStep('register');
        }}
      />
    );
  }

  if (sellerStep === 'pending') {
    return (
      <SellerVerificationStatusScreen
        verification={sellerVerification}
        onBack={() => setSellerStep(null)}
        onEdit={() => setSellerStep('register')}
      />
    );
  }

  if (sellerStep === 'register') {
    return (
      <SellerRegistrationScreen
        initialVerification={sellerVerification}
        onBack={() => {
          if (
            sellerVerification?.status === SELLER_VERIFICATION_STATUS.PENDING ||
            sellerVerification?.status === SELLER_VERIFICATION_STATUS.REJECTED
          ) {
            setSellerStep('pending');
            return;
          }
          setSellerStep(null);
        }}
        onSubmitted={async (verification) => {
          let latestVerification = verification || sellerVerification;

          try {
            const result = await dispatch(syncSellerAccess()).unwrap();
            latestVerification = verification || result?.verification || sellerVerification;
          } catch {
            // Giữ verification từ response submit nếu sync thất bại tạm thời.
          }

          setSellerVerification(latestVerification);
          setSellerStep('pending');
        }}
      />
    );
  }

  if (profileNav === 'seller-shop-settings') {
    return (
      <SellerShopSettingsScreen
        onBack={() => {
          setShopContactRefreshKey((value) => value + 1);
          setProfileNav(null);
        }}
        onSaved={(shop) => {
          if (shop) {
            setShopSettings(shop);
          }
          setShopContactRefreshKey((value) => value + 1);
        }}
        onChangePhone={() => {
          setPhoneChangeReturn('seller-shop-settings');
          setProfileNav(null);
          setSellerStep('phone');
        }}
      />
    );
  }

  if (profileNav === 'seller-reviews') {
    return <SellerReviewsManageScreen onBack={() => setProfileNav(null)} />;
  }

  if (profileNav === 'seller-orders') {
    return (
      <SellerOrdersScreen
        onBack={() => setProfileNav(null)}
        onRefreshKey={ordersRefreshKey}
        onOpenReservation={(reservationId) => {
          setSelectedReservationId(reservationId);
          setProfileNav('seller-order-detail');
        }}
      />
    );
  }

  if (profileNav === 'seller-order-detail' && selectedReservationId) {
    return (
      <SellerOrderDetailScreen
        reservationId={selectedReservationId}
        onBack={() => setProfileNav('seller-orders')}
        onChanged={() => setOrdersRefreshKey((value) => value + 1)}
      />
    );
  }

  if (profileNav === 'seller-stats') {
    return <SellerStatsScreen onBack={() => setProfileNav(null)} />;
  }

  if (profileNav === 'seller-subscription') {
    return (
      <SellerSubscriptionScreen
        onBack={() => setProfileNav(null)}
        onOpenWallet={() => openTopUp('seller-subscription')}
        onOpenBanner={() => setProfileNav('seller-banner')}
      />
    );
  }

  if (profileNav === 'seller-banner') {
    return (
      <SellerBannerScreen
        onBack={() => setProfileNav(null)}
        onOpenWallet={() => openTopUp('seller-banner')}
        onOpenSubscription={() => setProfileNav('seller-subscription')}
      />
    );
  }

  if (profileNav === 'seller-products') {
    return (
      <View style={{ flex: 1 }}>
        <SellerProductsTabScreen
          productRefreshKey={productRefreshKey}
          onProductChanged={onProductChanged}
          onBack={() => setProfileNav(null)}
        />
      </View>
    );
  }

  if (profileNav === 'edit-account') {
    return (
      <EditAccountScreen
        onBack={() => setProfileNav(null)}
        onChangePhone={() => {
          setPhoneChangeReturn('edit-account');
          setSellerStep('phone');
        }}
      />
    );
  }

  if (profileNav === 'follow-connections') {
    return (
      <FollowConnectionsScreen
        initialTab={followConnectionsTab}
        mode={
          profileMode === 'seller' || followConnectionsTab === 'followers'
            ? 'followers'
            : 'following'
        }
        onBack={() => {
          setProfileNav(null);
          dispatch(loadUserProfile());
        }}
        onOpenStore={onOpenStore}
      />
    );
  }

  if (profileNav === 'my-activity') {
    return (
      <MyActivityScreen
        onBack={() => setProfileNav(null)}
        onOpenStore={onOpenStore}
      />
    );
  }

  if (profileNav === 'notification-settings') {
    return <NotificationSettingsScreen onBack={() => setProfileNav(null)} />;
  }

  if (profileNav === 'reservation-history') {
    return (
      <ReservationHistoryScreen
        onBack={() => setProfileNav(null)}
        onOpenStore={onOpenStore}
      />
    );
  }

  if (profileNav === 'visited-stores') {
    return (
      <VisitedStoresScreen
        onBack={() => setProfileNav(null)}
        onOpenStore={onOpenStore}
      />
    );
  }

  if (profileNav === 'purchased-products') {
    return (
      <PurchasedProductsScreen
        onBack={() => setProfileNav(null)}
        onOpenStore={onOpenStore}
      />
    );
  }

  if (profileNav === 'buyer-orders') {
    return (
      <BuyerOrdersScreen
        onBack={() => setProfileNav(null)}
        onNavigatePickup={onNavigatePickup}
        initialTab={buyerOrdersTab}
        tabRequestKey={buyerOrdersTabKey}
      />
    );
  }

  if (profileNav === 'favorite-products') {
    return (
      <View style={styles.screen}>
        <FavoriteProductsScreen
          title="Quản lý sản phẩm yêu thích"
          onBack={() => setProfileNav(null)}
          onOpenProduct={(productId) => onOpenProductDetail?.(productId)}
        />
      </View>
    );
  }

  if (profileNav === 'account-report') {
    return (
      <View style={styles.screen}>
        <AccountReportScreen onBack={() => setProfileNav(null)} />
      </View>
    );
  }

  if (profileNav === 'wallet') {
    return (
      <WalletScreen
        onBack={() => setProfileNav(null)}
        onTopUp={() => openTopUp('wallet')}
        onWithdraw={() => setProfileNav('wallet-withdraw')}
        onSeeAllTransactions={() => setProfileNav('wallet-transactions')}
      />
    );
  }

  if (profileNav === 'wallet-withdraw') {
    return (
      <WithdrawScreen
        balance={Number(profile?.walletBalance) || 0}
        onBack={() => setProfileNav('wallet')}
        onSuccess={() => {
          dispatch(loadUserProfile());
        }}
      />
    );
  }

  if (profileNav === 'wallet-topup') {
    return (
      <TopUpScreen
        balance={Number(profile?.walletBalance) || 0}
        onBack={() => setProfileNav(topUpReturnNav || 'wallet')}
        onSuccess={(result) => {
          setTopUpResult(result || null);
          dispatch(loadUserProfile());
          setProfileNav('wallet-success');
        }}
      />
    );
  }

  if (profileNav === 'wallet-transactions') {
    return <WalletTransactionsScreen onBack={() => setProfileNav('wallet')} />;
  }

  if (profileNav === 'wallet-success') {
    return (
      <TopUpSuccessScreen
        amount={topUpResult?.amount || 0}
        orderCode={topUpResult?.orderCode}
        onContinueReservation={(payload) => {
          setTopUpResult(null);
          setProfileNav(null);
          onContinueReservationAfterTopUp?.(payload);
        }}
        onBackHome={() => {
          setTopUpResult(null);
          setProfileNav(topUpReturnNav || 'wallet');
        }}
        onViewHistory={() => {
          setTopUpResult(null);
          setProfileNav('wallet-transactions');
        }}
      />
    );
  }

  if (profileNav === 'buyer-preview') {
    const storeId = shopSettings?.id || shopSettings?.shopId;

    return (
      <View style={styles.screen}>
        <View style={styles.previewBanner}>
          <View style={styles.previewBannerTextWrap}>
            <Text style={styles.previewBannerTitle}>Chế độ xem</Text>
            <Text style={styles.previewBannerSubtitle}>Góc nhìn người mua</Text>
          </View>
          <Pressable
            onPress={() => setProfileNav(null)}
            style={({ pressed }) => [styles.previewExitButton, pressed && styles.previewExitButtonPressed]}
          >
            <Text style={styles.previewExitButtonText}>Thoát</Text>
          </Pressable>
        </View>
        {storeId ? (
          <StoreDetailScreen
            key={String(storeId)}
            storeId={String(storeId)}
            onBack={() => setProfileNav(null)}
            onNavigateDirections={onNavigateToStore}
            onOpenChat={handleOpenChatLocal}
            previewMode
          />
        ) : (
          <View style={styles.previewFallback}>
            <Text style={styles.previewFallbackText}>Không tải được cửa hàng.</Text>
            <Pressable onPress={() => setProfileNav(null)} style={styles.previewExitButton}>
              <Text style={styles.previewExitButtonText}>Thoát</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  if (chatOpenRequest) {
    return (
      <InboxScreen
        buyerView
        messagesOnly
        chatRequest={chatOpenRequest}
        onBack={() => setChatOpenRequest(null)}
        onViewShop={(shopId) => {
          setChatOpenRequest(null);
          setProductStoreId(String(shopId));
          onOpenStore?.(String(shopId));
        }}
      />
    );
  }

  if (productDetailId) {
    if (profileMode === 'buyer') {
      if (productStoreId) {
        return (
          <StoreDetailScreen
            storeId={productStoreId}
            onBack={() => setProductStoreId(null)}
            onProductPress={(nextProductId) => {
              setProductStoreId(null);
              onOpenProductDetail?.(nextProductId);
            }}
            onNavigateDirections={onNavigateToStore}
            onOpenChat={handleOpenChatLocal}
          />
        );
      }

      return (
        <ProductDetailScreen
          productId={productDetailId}
          onBack={() => {
            setProductStoreId(null);
            onOpenProductDetail?.(null);
          }}
          onStorePress={(storeId) => setProductStoreId(String(storeId))}
          onOpenChat={handleOpenChatLocal}
          onOpenTopUp={() => openTopUp('wallet')}
        />
      );
    }

    return (
      <SellerProductDetailScreen
        productId={productDetailId}
        onBack={() => onOpenProductDetail?.(null)}
        onChanged={onProductChanged}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <AccountProfileScreen
        profileMode={profileMode}
        isProfileVisible={isProfileVisible}
        productRefreshKey={productRefreshKey}
        shopContactRefreshKey={shopContactRefreshKey}
        shopSettings={shopSettings}
        onOpenProduct={(productId) => onOpenProductDetail?.(productId)}
        onEditAccount={() => setProfileNav('edit-account')}
        onOpenActivity={() => setProfileNav('my-activity')}
        onOpenNotificationSettings={() => setProfileNav('notification-settings')}
        onOpenInbox={onOpenInbox}
        onOpenBuyerOrders={() => {
          setBuyerOrdersTab(RESERVATION_TAB.HOLDING);
          setBuyerOrdersTabKey(Date.now());
          setProfileNav('buyer-orders');
        }}
        onOpenFavoriteProducts={() => setProfileNav('favorite-products')}
        onOpenReport={() => setProfileNav('account-report')}
        onOpenWallet={() => setProfileNav('wallet')}
        onOpenWalletTopUp={() => openTopUp('wallet')}
        onOpenSellerShopSettings={() => setProfileNav('seller-shop-settings')}
        onOpenSellerReviews={() => setProfileNav('seller-reviews')}
        onOpenSellerOrders={() => setProfileNav('seller-orders')}
        onOpenSellerStats={() => setProfileNav('seller-stats')}
        onOpenSellerProducts={() => setProfileNav('seller-products')}
        onOpenSellerSubscription={() => setProfileNav('seller-subscription')}
        onOpenSellerBanner={() => setProfileNav('seller-banner')}
        showSellerHub={false}
        onOpenBuyerView={openBuyerPreview}
        onStartSellerRegister={() => {
          onStartSellerRegister?.();
        }}
        onOpenShopTab={onOpenShopTab}
        onSwitchToSellerMode={onSwitchToSellerMode}
        onSwitchToBuyerMode={onSwitchToBuyerMode}
        onLogout={() => dispatch(logoutUser())}
        onOpenFollowConnections={(tab = 'following') => {
          setFollowConnectionsTab(tab === 'followers' ? 'followers' : 'following');
          setProfileNav('follow-connections');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f7f6',
    minHeight: 0,
  },
  previewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#E6F4EC',
    borderBottomWidth: 1,
    borderBottomColor: '#A7D9B8',
  },
  previewBannerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  previewBannerTitle: {
    color: '#076F32',
    fontSize: 14,
    fontWeight: '800',
  },
  previewBannerSubtitle: {
    marginTop: 2,
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  previewExitButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#A7D9B8',
  },
  previewExitButtonPressed: {
    opacity: 0.75,
  },
  previewExitButtonText: {
    color: '#076F32',
    fontSize: 13,
    fontWeight: '800',
  },
  previewFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  previewFallbackText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
