import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';

import { discoverProductsOnBackend, getProductCategoriesOnBackend, listPromotionProductsOnBackend } from '../../api/productApi';
import {
  addFavoriteProductOnBackend,
  getFavoriteProductIdsOnBackend,
  removeFavoriteProductOnBackend,
} from '../../api/favoriteApi';
import { listActiveBannersOnBackend, recordBannerClickOnBackend } from '../../api/bannerApi';
import { formatDistance, hasValidLocation, normalizeExpoLocation, calculateDistanceMeters } from '../../core/utils/geo';
import { formatPriceRange, getProductPromoPriceLabels } from '../../core/utils/productFormat';
import { isRemoteAvatarUrl } from '../../core/utils/avatarInitial';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import SubScreenHeader from '../shared/components/SubScreenHeader';
import { loadNearbyRegisteredShops } from '../../viewmodel/map/mapViewModel';
import { normalizeProduct } from '../../model/productModel';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import {
  selectSellerVerification,
  selectUserRole,
} from '../../viewmodel/auth/authSelectors';
import { logoutUser } from '../../viewmodel/auth/authSlice';
import { getSellerRegisterButtonLabel } from '../seller/sellerRegistrationFlow';
import ProductDetailScreen from '../store/ProductDetailScreen';
import StoreDetailScreen from '../store/StoreDetailScreen';
import SearchScreen from './SearchScreen';
import InboxScreen from '../inbox/InboxScreen';
import AvatarBadge from '../shared/components/AvatarBadge';
import BuyerQuickMenu from '../shared/components/BuyerQuickMenu';

const NEARBY_RADIUS_METERS = 20000;
const ALL_PRODUCTS_RADIUS_METERS = 0;

function SectionHeader({ title, onSeeAll }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onSeeAll ? (
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text style={styles.seeAllText}>Xem tất cả</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function HomeProductCard({ product, isLiked, likeCount = 0, onToggleLike, onPress, grid = false }) {
  const distance = formatDistance(product.distanceMeters);
  const storeName = product.storeName || 'Gian hàng';
  const isPromotion = Boolean(product.isPromotion) && Number(product.discountPercent) > 0;
  const unit = product.donVi ? `/${product.donVi}` : '';
  const promoLabels = isPromotion ? getProductPromoPriceLabels(product) : null;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.productCard,
        grid && styles.productCardGrid,
        pressed && styles.pressed,
      ]}
      onPress={() => onPress?.(product.id)}
    >
      <View style={styles.productImageWrap}>
        {product.thumbnail ? (
          <Image source={{ uri: product.thumbnail }} style={styles.productImage} />
        ) : (
          <View style={styles.productImagePlaceholder}>
            <Text style={styles.productEmoji}>{product.image_emoji || '📦'}</Text>
          </View>
        )}
        {isPromotion ? (
          <View style={styles.promoBadge}>
            <Text style={styles.promoBadgeText}>-{product.discountPercent}%</Text>
          </View>
        ) : null}
        <Pressable
          style={styles.heartBtn}
          onPress={() => onToggleLike?.(product.id)}
          hitSlop={8}
        >
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={18}
            color={isLiked ? '#ef4444' : '#64748b'}
          />
          <Text style={styles.heartCountText}>{likeCount}</Text>
        </Pressable>
      </View>
      <Text style={styles.productName} numberOfLines={2}>
        {product.name}
      </Text>
      <View style={styles.productFooter}>
        {isPromotion && promoLabels ? (
          <View style={styles.promoPriceWrap}>
            <Text style={styles.productOriginalPrice} numberOfLines={1}>
              {promoLabels.originalLabel}
              {unit}
            </Text>
            <Text style={styles.productPrice} numberOfLines={1}>
              {promoLabels.saleLabel}
              {unit}
            </Text>
          </View>
        ) : (
          <Text style={styles.productPrice} numberOfLines={1}>
            {formatPriceRange(product.minPrice ?? product.price, product.maxPrice ?? product.price)}
            {unit}
          </Text>
        )}
      </View>
      <View style={styles.productMetaRow}>
        <Ionicons name="storefront-outline" size={11} color="#64748b" />
        <Text style={styles.productStore} numberOfLines={1}>
          {storeName}
        </Text>
      </View>
      <View style={styles.productMetaRow}>
        <Ionicons name="star" size={9} color="#076F32" />
        <Text style={styles.productRating}>
          Đã bán: {Number(product.soldCount) || 0}
        </Text>
        {distance && distance !== '--' ? (
          <View style={styles.productDistanceRow}>
            <Ionicons name="location" size={9} color="#64748b" />
            <Text style={styles.productDistanceText}>{distance}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function HomeShopCard({ shop, onPress, grid = false }) {
  const distance = formatDistance(shop.distance_meters);
  const rating = Number(shop.rating_avg) || 0;
  const isOpen = shop.is_open !== false;
  const categoryLabel = shop.category_name || 'Gian hàng';
  const avatar = isRemoteAvatarUrl(shop.image_url || shop.cover_image_url)
    ? shop.image_url || shop.cover_image_url
    : '';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.shopCard,
        grid && styles.shopCardGrid,
        pressed && styles.pressed,
      ]}
      onPress={() => onPress?.(shop.id)}
    >
      {avatar ? (
        <Image source={{ uri: avatar }} style={styles.shopAvatar} />
      ) : (
        <View style={styles.shopAvatarFallback}>
          <AvatarBadge name={shop.shop_name || shop.name || 'S'} size={42} />
        </View>
      )}
      <View style={styles.shopInfo}>
        <Text style={styles.shopName} numberOfLines={1}>
          {shop.shop_name || shop.name}
        </Text>
        <View style={styles.shopRatingRow}>
          <Ionicons name="star" size={11} color="#eab308" />
          <Text style={styles.shopRatingText}>
            {rating > 0 ? rating.toFixed(1) : 'Mới'}
          </Text>
        </View>
        <Text style={styles.shopCategory} numberOfLines={1}>
          {categoryLabel}
        </Text>
        <View style={styles.shopStatusRow}>
          <View style={[styles.shopStatusDot, !isOpen && styles.shopStatusDotClosed]} />
          <Text style={[styles.shopStatusText, !isOpen && styles.shopStatusTextClosed]}>
            {isOpen ? 'Đang mở cửa' : 'Đang đóng cửa'}
          </Text>
          {distance && distance !== '--' ? (
            <Text style={styles.shopDistance}>{distance}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const SEE_ALL_SECTIONS = {
  promotions: {
    title: 'Sản phẩm giảm giá',
    type: 'products',
  },
  nearbyProducts: {
    title: 'Sản phẩm gần bạn',
    type: 'products',
  },
  nearbyShops: {
    title: 'Cửa hàng gần bạn',
    type: 'shops',
  },
};

function CategoryChip({ category, label, onPress, active = false }) {
  const text = label || category?.categoryName || category?.name || '';
  return (
    <Pressable
      style={({ pressed }) => [
        styles.categoryChip,
        active && styles.categoryChipActive,
        pressed && styles.pressed,
      ]}
      onPress={() => onPress?.(category)}
    >
      <Text
        style={[styles.categoryLabel, active && styles.categoryLabelActive]}
        numberOfLines={1}
      >
        {text}
      </Text>
    </Pressable>
  );
}

const BANNER_AUTO_MS = 3000;
const BANNER_FALLBACK_WIDTH = Dimensions.get('window').width - 32;
/** Khớp bề ngang card “Sản phẩm gần bạn”; cao hơn một chút để ảnh banner rõ hơn. */
const NEARBY_BANNER_HEIGHT = 140;

function shuffleBannerList(items = []) {
  const next = Array.isArray(items) ? [...items] : [];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = next[i];
    next[i] = next[j];
    next[j] = temp;
  }
  return next;
}

function HomeBannerCarousel({ banners, onPressInterest }) {
  const scrollRef = useRef(null);
  const indexRef = useRef(0);
  const slideWidthRef = useRef(BANNER_FALLBACK_WIDTH);
  const resettingRef = useRef(false);
  const [slideWidth, setSlideWidth] = useState(BANNER_FALLBACK_WIDTH);
  const [shuffleKey, setShuffleKey] = useState(0);

  const orderedBanners = useMemo(
    () => shuffleBannerList(banners),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reshuffle khi đổi list hoặc mở lại app
    [banners, shuffleKey]
  );

  // Nhân bản slide đầu ở cuối để auto-scroll luôn trái → phải, rồi nhảy về đầu không animation.
  const loopBanners = useMemo(() => {
    if (orderedBanners.length <= 1) {
      return orderedBanners;
    }
    return [...orderedBanners, orderedBanners[0]];
  }, [orderedBanners]);

  const snapToIndex = useCallback((index, animated) => {
    indexRef.current = index;
    scrollRef.current?.scrollTo?.({
      x: index * slideWidthRef.current,
      animated,
    });
  }, []);

  const resetFromClone = useCallback(() => {
    if (orderedBanners.length <= 1) {
      return;
    }
    resettingRef.current = true;
    snapToIndex(0, false);
    requestAnimationFrame(() => {
      resettingRef.current = false;
    });
  }, [orderedBanners.length, snapToIndex]);

  useEffect(() => {
    indexRef.current = 0;
    resettingRef.current = false;
    scrollRef.current?.scrollTo?.({ x: 0, animated: false });
  }, [orderedBanners, slideWidth]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        setShuffleKey((value) => value + 1);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (orderedBanners.length <= 1 || slideWidth <= 0) return undefined;
    const timer = setInterval(() => {
      if (resettingRef.current) {
        return;
      }
      const nextIndex = indexRef.current + 1;
      snapToIndex(nextIndex, true);
      // Đã tới bản sao slide đầu → nhảy về slide thật (không animation) để lặp một chiều.
      if (nextIndex >= orderedBanners.length) {
        setTimeout(resetFromClone, 350);
      }
    }, BANNER_AUTO_MS);
    return () => clearInterval(timer);
  }, [orderedBanners.length, resetFromClone, slideWidth, snapToIndex]);

  if (!orderedBanners.length) {
    return null;
  }

  return (
    <View
      style={styles.bannerCarouselWrap}
      onLayout={(event) => {
        const nextWidth = Math.round(event.nativeEvent.layout.width);
        if (nextWidth > 0 && nextWidth !== slideWidthRef.current) {
          slideWidthRef.current = nextWidth;
          setSlideWidth(nextWidth);
        }
      }}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={[styles.bannerCarousel, { height: NEARBY_BANNER_HEIGHT }]}
        contentContainerStyle={styles.bannerCarouselContent}
        onMomentumScrollEnd={(event) => {
          if (resettingRef.current) {
            return;
          }
          const width = slideWidthRef.current || BANNER_FALLBACK_WIDTH;
          const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
          const maxIndex = loopBanners.length - 1;
          const safeIndex = Math.max(0, Math.min(maxIndex, nextIndex));
          indexRef.current = safeIndex;
          if (orderedBanners.length > 1 && safeIndex >= orderedBanners.length) {
            resetFromClone();
          }
        }}
      >
        {loopBanners.map((banner, slideIndex) => (
          <View
            key={slideIndex === orderedBanners.length ? `${banner.id}-loop` : banner.id}
            style={[
              styles.bannerSlide,
              {
                width: slideWidth,
                height: NEARBY_BANNER_HEIGHT,
              },
            ]}
          >
            {banner.image ? (
              <Image
                source={{ uri: banner.image }}
                style={styles.bannerImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.bannerFallback}>
                <Ionicons name="megaphone-outline" size={28} color="#ffffff" />
              </View>
            )}
            <Pressable
              style={({ pressed }) => [styles.interestBtn, pressed && styles.pressed]}
              onPress={() => onPressInterest?.(banner)}
              hitSlop={6}
            >
              <Text style={styles.interestBtnText}>Quan tâm</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export default function HomeScreen({
  onOpenMap,
  onOpenProducts,
  onOpenBuyerOrders,
  onEditAccount,
  onOpenWallet,
  onOpenFavoriteProducts,
  onOpenReport,
  onStartSellerRegister,
  onOpenShop,
  onOpenWalletTopUp,
  onOpenChat,
  onNavigateDirections,
  resumeReserveRequest = null,
  onResumeReserveHandled,
  isScreenActive = true,
  onNavigationStateChange,
  unreadMessagesCount = 0,
}) {
  const insets = useScreenInsets();
  const dispatch = useDispatch();
  const role = useSelector(selectUserRole);
  const sellerVerification = useSelector(selectSellerVerification);
  const sellerButtonLabel =
    getSellerRegisterButtonLabel({ role, verification: sellerVerification }) ||
    (Number(role) === 2 ? 'Gian hàng' : '');

  const [currentLocation, setCurrentLocation] = useState(null);
  const [products, setProducts] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [shops, setShops] = useState([]);
  const [categories, setCategories] = useState([]);
  const [banners, setBanners] = useState([]);
  const [promotionProducts, setPromotionProducts] = useState([]);
  const [likedProducts, setLikedProducts] = useState({});
  // Trạng thái tym ban đầu từ server — để hiển thị số tym không bị lệch khi user bấm tym.
  const initialLikedRef = useRef({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [locationChecked, setLocationChecked] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [selectedStoreId, setSelectedStoreId] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [showSearchScreen, setShowSearchScreen] = useState(false);
  const [showInboxScreen, setShowInboxScreen] = useState(false);
  const [chatOpenRequest, setChatOpenRequest] = useState(null);
  const [seeAllSection, setSeeAllSection] = useState(null);

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

  useEffect(() => {
    onNavigationStateChange?.(
      Boolean(
        isScreenActive &&
          (selectedProductId ||
            selectedStoreId ||
            showSearchScreen ||
            showInboxScreen ||
            chatOpenRequest ||
            seeAllSection)
      )
    );
  }, [
    chatOpenRequest,
    isScreenActive,
    onNavigationStateChange,
    seeAllSection,
    selectedProductId,
    selectedStoreId,
    showSearchScreen,
    showInboxScreen,
  ]);

  useEffect(() => {
    if (isScreenActive) {
      return;
    }
    setSelectedProductId(null);
    setSelectedStoreId(null);
    setShowSearchScreen(false);
    setShowInboxScreen(false);
    setChatOpenRequest(null);
  }, [isScreenActive]);

  useEffect(() => {
    if (!resumeReserveRequest?.productId || !resumeReserveRequest?.at) {
      return;
    }
    setSelectedStoreId(null);
    setSelectedProductId(String(resumeReserveRequest.productId));
  }, [resumeReserveRequest?.at, resumeReserveRequest?.productId]);

  const loadLocation = useCallback(async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setCurrentLocation(null);
        return null;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const nextLocation = normalizeExpoLocation(position);
      setCurrentLocation(nextLocation);
      return nextLocation;
    } catch {
      setCurrentLocation(null);
      return null;
    } finally {
      setLocationChecked(true);
    }
  }, []);

  const loadHomeMeta = useCallback(async () => {
    try {
      const [categoryRows, bannerRows] = await Promise.all([
        getProductCategoriesOnBackend().catch(() => []),
        listActiveBannersOnBackend({ limit: 8 }).catch(() => []),
      ]);
      setCategories(Array.isArray(categoryRows) ? categoryRows : []);
      setBanners(Array.isArray(bannerRows) ? bannerRows : []);
    } catch {
      setCategories([]);
      setBanners([]);
    }

    // Favorites không chặn load sản phẩm.
    (async () => {
      try {
        const idToken = await getCurrentUserIdToken(false);
        if (!idToken) {
          return;
        }
        const productIds = await getFavoriteProductIdsOnBackend(idToken).catch(() => []);
        const likedMap = {};
        (productIds || []).forEach((productId) => {
          likedMap[String(productId)] = true;
        });
        initialLikedRef.current = likedMap;
        setLikedProducts(likedMap);
      } catch {
        // Ignore favorite preload errors.
      }
    })();
  }, []);

  const loadNearbyContent = useCallback(
    async ({ refresh = false, location = currentLocation, ready = locationChecked } = {}) => {
      // Chưa xong GPS: giữ loading, đừng clear products (tránh race ghi đè []).
      if (!ready) {
        return;
      }

      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        if (!hasValidLocation(location)) {
          setProducts([]);
          setShops([]);
          setCatalogProducts([]);
          setPromotionProducts([]);
          return;
        }

        const [productRows, shopRows, catalogRows, promoRows] = await Promise.all([
          discoverProductsOnBackend({
            latitude: location.latitude,
            longitude: location.longitude,
            radiusMeters: NEARBY_RADIUS_METERS,
            categoryId: selectedCategoryId,
            limit: 20,
          }).catch(() => []),
          loadNearbyRegisteredShops({
            latitude: location.latitude,
            longitude: location.longitude,
            radiusMeters: NEARBY_RADIUS_METERS,
          }).catch(() => []),
          discoverProductsOnBackend({
            latitude: location.latitude,
            longitude: location.longitude,
            radiusMeters: ALL_PRODUCTS_RADIUS_METERS,
            categoryId: selectedCategoryId,
            limit: 24,
          }).catch(() => []),
          listPromotionProductsOnBackend({
            limit: 20,
            latitude: location.latitude,
            longitude: location.longitude,
          }).catch(() => []),
        ]);

        const promoById = new Map();
        (Array.isArray(promoRows) ? promoRows : []).forEach((row) => {
          const promo = normalizeProduct(row);
          if (promo.id && promo.isPromotion && Number(promo.discountPercent) > 0) {
            promoById.set(promo.id, promo);
          }
        });

        function withPromotionFields(product) {
          const promo = promoById.get(product.id);
          if (!promo) {
            return product;
          }
          return {
            ...product,
            isPromotion: true,
            discountPercent: promo.discountPercent,
            originalPrice: promo.originalPrice ?? product.minPrice,
            originalMaxPrice: promo.originalMaxPrice ?? product.maxPrice,
            promotionPrice: promo.promotionPrice,
            promotionMinPrice: promo.promotionMinPrice,
            promotionMaxPrice: promo.promotionMaxPrice,
            displayPrice: promo.displayPrice ?? promo.promotionPrice ?? product.displayPrice,
          };
        }

        setProducts(
          Array.isArray(productRows)
            ? productRows
                .map((row) => withPromotionFields(normalizeProduct(row)))
                .slice(0, 12)
            : []
        );
        setShops(Array.isArray(shopRows) ? shopRows.slice(0, 12) : []);
        const normalizedCatalog = Array.isArray(catalogRows)
          ? catalogRows
              .map((row) => withPromotionFields(normalizeProduct(row)))
              .filter((product) => !product.isOutOfStock && !product.isUnavailable)
              .slice(0, 12)
          : [];
        setCatalogProducts(normalizedCatalog);

        const distanceByProductId = new Map();
        const distanceByStoreId = new Map();
        const seedRows = [
          ...(Array.isArray(productRows) ? productRows : []),
          ...(Array.isArray(catalogRows) ? catalogRows : []),
        ];
        seedRows.forEach((row) => {
          const normalized = normalizeProduct(row);
          if (
            normalized.id &&
            normalized.distanceMeters != null &&
            Number.isFinite(Number(normalized.distanceMeters))
          ) {
            distanceByProductId.set(normalized.id, Number(normalized.distanceMeters));
          }
          if (
            normalized.store_id &&
            normalized.distanceMeters != null &&
            Number.isFinite(Number(normalized.distanceMeters))
          ) {
            distanceByStoreId.set(normalized.store_id, Number(normalized.distanceMeters));
          }
        });

        setPromotionProducts(
          (Array.isArray(promoRows) ? promoRows : []).map((row) => {
            const product = normalizeProduct(row);
            const fromDiscover =
              distanceByProductId.get(product.id) ??
              distanceByStoreId.get(product.store_id) ??
              null;

            let distanceMeters = product.distanceMeters;
            if (
              fromDiscover != null &&
              (distanceMeters == null ||
                !Number.isFinite(Number(distanceMeters)) ||
                (Number(distanceMeters) === 0 && fromDiscover > 50))
            ) {
              distanceMeters = fromDiscover;
            }

            if (
              (distanceMeters == null || !Number.isFinite(Number(distanceMeters))) &&
              hasValidLocation(location)
            ) {
              const shopLat = Number(row.shopLatitude ?? row.latitude);
              const shopLng = Number(row.shopLongitude ?? row.longitude);
              if (Number.isFinite(shopLat) && Number.isFinite(shopLng)) {
                const meters = calculateDistanceMeters(location, {
                  latitude: shopLat,
                  longitude: shopLng,
                });
                if (meters != null && Number.isFinite(meters)) {
                  distanceMeters = Math.round(meters);
                }
              }
            }

            return { ...product, distanceMeters };
          })
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [currentLocation, locationChecked, selectedCategoryId]
  );

  useEffect(() => {
    loadLocation();
    loadHomeMeta();
  }, [loadLocation, loadHomeMeta]);

  useEffect(() => {
    loadNearbyContent();
  }, [loadNearbyContent]);

  const toggleLikeProduct = useCallback(
    async (productId) => {
      const normalizedId = String(productId);
      const wasLiked = Boolean(likedProducts[normalizedId]);
      setLikedProducts((prev) => ({ ...prev, [normalizedId]: !wasLiked }));

      try {
        const idToken = await getCurrentUserIdToken();
        if (!idToken) {
          setLikedProducts((prev) => ({ ...prev, [normalizedId]: wasLiked }));
          Alert.alert('Đăng nhập', 'Vui lòng đăng nhập để thích sản phẩm.');
          return;
        }
        if (wasLiked) {
          await removeFavoriteProductOnBackend(idToken, normalizedId);
        } else {
          await addFavoriteProductOnBackend({ idToken, productId: normalizedId });
        }
      } catch {
        setLikedProducts((prev) => ({ ...prev, [normalizedId]: wasLiked }));
      }
    },
    [likedProducts]
  );

  function getDisplayLikeCount(item) {
    const id = String(item.id);
    const base = Math.max(0, Number(item.likeCount) || 0);
    const wasLiked = Boolean(initialLikedRef.current[id]);
    const nowLiked = Boolean(likedProducts[id]);
    return Math.max(0, base + (nowLiked ? 1 : 0) - (wasLiked ? 1 : 0));
  }

  function handleBannerInterest(banner) {
    const bannerId = String(banner?.id || '').trim();
    if (bannerId) {
      recordBannerClickOnBackend(bannerId).catch(() => {});
    }
    const targetType = Number(banner?.targetType);
    const targetId = String(banner?.targetId || '').trim();
    if (targetType === 1 && targetId) {
      setSelectedProductId(targetId);
      return;
    }
    if (targetType === 2 && targetId) {
      setSelectedStoreId(targetId);
      return;
    }
    const shopId = String(banner?.shopId || '').trim();
    if (shopId) {
      setSelectedStoreId(shopId);
    }
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
          setSelectedProductId(null);
          setSelectedStoreId(String(shopId));
        }}
      />
    );
  }

  if (selectedProductId) {
    return (
      <ProductDetailScreen
        productId={selectedProductId}
        onBack={() => {
          setSelectedProductId(null);
          onResumeReserveHandled?.();
        }}
        onStorePress={(storeId) => {
          setSelectedProductId(null);
          setSelectedStoreId(storeId);
        }}
        onOpenChat={handleOpenChatLocal}
        onOrderSuccess={onOpenBuyerOrders}
        onOpenTopUp={onOpenWalletTopUp}
        resumeReserveRequest={
          resumeReserveRequest &&
          String(resumeReserveRequest.productId) === String(selectedProductId)
            ? resumeReserveRequest
            : null
        }
        onResumeReserveConsumed={onResumeReserveHandled}
      />
    );
  }

  if (selectedStoreId) {
    return (
      <StoreDetailScreen
        storeId={selectedStoreId}
        originLocation={currentLocation}
        onBack={() => setSelectedStoreId(null)}
        onProductPress={(productId) => {
          setSelectedStoreId(null);
          setSelectedProductId(productId);
        }}
        onOpenChat={handleOpenChatLocal}
        onNavigateDirections={onNavigateDirections}
      />
    );
  }

  if (showSearchScreen) {
    return (
      <SearchScreen
        currentLocation={currentLocation}
        onBack={() => setShowSearchScreen(false)}
        onOpenProduct={(productId) => {
          setShowSearchScreen(false);
          setSelectedProductId(String(productId));
        }}
        onOpenShop={(shopId) => {
          setShowSearchScreen(false);
          setSelectedStoreId(String(shopId));
        }}
      />
    );
  }

  if (showInboxScreen) {
    return (
      <InboxScreen
        buyerView
        messagesOnly
        onBack={() => setShowInboxScreen(false)}
        onViewShop={(shopId) => {
          setShowInboxScreen(false);
          setSelectedStoreId(String(shopId));
        }}
      />
    );
  }

  const categoryKey = String(selectedCategoryId || '').trim();
  const visiblePromotionProducts = categoryKey
    ? promotionProducts.filter(
        (product) => String(product.categoryId || '') === categoryKey
      )
    : promotionProducts;

  if (seeAllSection && SEE_ALL_SECTIONS[seeAllSection]) {
    const sectionMeta = SEE_ALL_SECTIONS[seeAllSection];
    const seeAllProducts =
      seeAllSection === 'promotions'
        ? visiblePromotionProducts
        : seeAllSection === 'nearbyProducts'
          ? products
          : [];
    const seeAllShops = seeAllSection === 'nearbyShops' ? shops : [];

    return (
      <View style={[styles.screen, { paddingTop: insets.contentPaddingTop }]}>
        <SubScreenHeader title={sectionMeta.title} onBack={() => setSeeAllSection(null)} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.seeAllContent,
            { paddingBottom: insets.tabRootScrollPaddingBottom },
          ]}
        >
          {sectionMeta.type === 'products' ? (
            seeAllProducts.length > 0 ? (
              <View style={styles.productGrid}>
                {seeAllProducts.map((item) => (
                  <HomeProductCard
                    key={`see-all-${String(item.id)}`}
                    product={item}
                    grid
                    isLiked={Boolean(likedProducts[String(item.id)])}
                    likeCount={getDisplayLikeCount(item)}
                    onToggleLike={toggleLikeProduct}
                    onPress={setSelectedProductId}
                  />
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>Chưa có sản phẩm nào.</Text>
            )
          ) : seeAllShops.length > 0 ? (
            <View style={styles.shopGrid}>
              {seeAllShops.map((item) => (
                <HomeShopCard
                  key={`see-all-shop-${String(item.id)}`}
                  shop={item}
                  grid
                  onPress={setSelectedStoreId}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Chưa có cửa hàng nào.</Text>
          )}
        </ScrollView>
      </View>
    );
  }

  const messageBadgeCount = Math.max(0, Number(unreadMessagesCount) || 0);

  function handleSelectCategory(categoryId = '') {
    setSelectedCategoryId(String(categoryId || ''));
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.contentPaddingTop }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.tabRootScrollPaddingBottom },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={async () => {
              const nextLocation = await loadLocation();
              await loadHomeMeta();
              await loadNearbyContent({
                refresh: true,
                location: nextLocation,
                ready: true,
              });
            }}
            tintColor="#076F32"
          />
        }
      >
        <View style={styles.headerRow}>
          <BuyerQuickMenu
            sellerButtonLabel={sellerButtonLabel}
            onEditAccount={onEditAccount}
            onOpenWallet={onOpenWallet}
            onOpenFavoriteProducts={onOpenFavoriteProducts}
            onOpenReport={onOpenReport}
            onSellerAction={() => {
              if (getSellerRegisterButtonLabel({ role, verification: sellerVerification })) {
                onStartSellerRegister?.();
                return;
              }
              onOpenShop?.();
            }}
            onLogout={() => dispatch(logoutUser())}
            buttonStyle={styles.utilityBtn}
            iconColor="#334155"
          />
          <Text style={styles.brandTitle} numberOfLines={1}>
            FastMark
          </Text>
          <View style={styles.headerRight}>
            <Pressable
              style={styles.bellBtn}
              onPress={() => setShowSearchScreen(true)}
              accessibilityRole="button"
              accessibilityLabel="Tìm kiếm"
            >
              <Ionicons name="search" size={22} color="#334155" />
            </Pressable>
            <Pressable
              style={styles.bellBtn}
              onPress={() => setShowInboxScreen(true)}
              accessibilityRole="button"
              accessibilityLabel="Tin nhắn"
            >
              <Ionicons name="chatbubble-outline" size={22} color="#334155" />
              {messageBadgeCount > 0 ? (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>
                    {messageBadgeCount > 9 ? '9+' : String(messageBadgeCount)}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          <CategoryChip
            label="Tất cả"
            active={!selectedCategoryId}
            onPress={() => handleSelectCategory('')}
          />
          {categories.map((item) => (
            <CategoryChip
              key={String(item.id)}
              category={item}
              active={String(selectedCategoryId) === String(item.id)}
              onPress={(category) => handleSelectCategory(category.id)}
            />
          ))}
        </ScrollView>

        {banners.length > 0 ? (
          <HomeBannerCarousel
            banners={banners}
            onPressInterest={handleBannerInterest}
          />
        ) : (
          <Pressable style={styles.mapBanner} onPress={onOpenMap}>
            <View style={styles.mapBannerCopy}>
              <Text style={styles.mapBannerTitle}>Sản phẩm gần bạn</Text>
              <Text style={styles.mapBannerSubtitle}>
                Xem các cửa hàng và sản phẩm xung quanh bạn
              </Text>
              <View style={styles.mapBannerBtn}>
                <Text style={styles.mapBannerBtnText}>Xem trên bản đồ</Text>
              </View>
            </View>
            <View style={styles.mapBannerArt}>
              <View style={styles.mapGrid}>
                <View style={[styles.mapLine, styles.mapLineH1]} />
                <View style={[styles.mapLine, styles.mapLineH2]} />
                <View style={[styles.mapLine, styles.mapLineV1]} />
                <View style={[styles.mapLine, styles.mapLineV2]} />
              </View>
              <View style={styles.mapPulseOuter}>
                <View style={styles.mapPulseInner} />
              </View>
            </View>
          </Pressable>
        )}

        {visiblePromotionProducts.length > 0 ? (
          <>
            <SectionHeader
              title="🔥 Sản phẩm giảm giá"
              onSeeAll={() => setSeeAllSection('promotions')}
            />
            <FlatList
              horizontal
              data={visiblePromotionProducts}
              keyExtractor={(item) => String(item.id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hList}
              renderItem={({ item }) => (
                <HomeProductCard
                  product={item}
                  isLiked={Boolean(likedProducts[String(item.id)])}
                  likeCount={getDisplayLikeCount(item)}
                  onToggleLike={toggleLikeProduct}
                  onPress={setSelectedProductId}
                />
              )}
            />
          </>
        ) : null}

        {isLoading ? (
          <ActivityIndicator color="#076F32" style={styles.sectionLoader} />
        ) : null}

        {!isLoading && products.length > 0 ? (
          <>
            <SectionHeader
              title="Sản phẩm gần bạn"
              onSeeAll={() => setSeeAllSection('nearbyProducts')}
            />
            <FlatList
              horizontal
              data={products}
              keyExtractor={(item) => String(item.id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hList}
              renderItem={({ item }) => (
                <HomeProductCard
                  product={item}
                  isLiked={Boolean(likedProducts[String(item.id)])}
                  likeCount={getDisplayLikeCount(item)}
                  onToggleLike={toggleLikeProduct}
                  onPress={setSelectedProductId}
                />
              )}
            />
          </>
        ) : null}

        {!isLoading && shops.length > 0 ? (
          <>
            <SectionHeader
              title="Cửa hàng gần bạn"
              onSeeAll={() => setSeeAllSection('nearbyShops')}
            />
            <FlatList
              horizontal
              data={shops}
              keyExtractor={(item) => String(item.id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hList}
              renderItem={({ item }) => (
                <HomeShopCard shop={item} onPress={setSelectedStoreId} />
              )}
            />
          </>
        ) : null}

        {!isLoading && catalogProducts.length > 0 ? (
          <>
            <SectionHeader title="Tất cả sản phẩm" />
            <View style={styles.productGrid}>
              {catalogProducts.map((item) => (
                <HomeProductCard
                  key={`all-${String(item.id)}`}
                  product={item}
                  grid
                  isLiked={Boolean(likedProducts[String(item.id)])}
                  likeCount={getDisplayLikeCount(item)}
                  onToggleLike={toggleLikeProduct}
                  onPress={setSelectedProductId}
                />
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  pressed: {
    opacity: 0.92,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  brandTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '900',
    color: '#055528',
    letterSpacing: 0.2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  utilityBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 14,
    paddingRight: 4,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexShrink: 0,
  },
  categoryChipActive: {
    backgroundColor: '#E6F4EC',
    borderColor: '#076F32',
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
  categoryLabelActive: {
    color: '#076F32',
  },
  bannerCarouselWrap: {
    alignSelf: 'stretch',
    width: '100%',
    marginBottom: 16,
  },
  bannerCarousel: {
    alignSelf: 'stretch',
    width: '100%',
    marginBottom: 0,
  },
  bannerCarouselContent: {
    alignItems: 'stretch',
  },
  bannerSlide: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#055528',
  },
  bannerImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  bannerFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#076F32',
  },
  bannerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  interestBtn: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  interestBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 11,
  },
  mapBanner: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#076F32',
    height: NEARBY_BANNER_HEIGHT,
    minHeight: NEARBY_BANNER_HEIGHT,
    marginBottom: 16,
  },
  mapBannerCopy: {
    flex: 1.15,
    paddingVertical: 14,
    paddingHorizontal: 14,
    justifyContent: 'center',
    gap: 6,
  },
  mapBannerTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  mapBannerSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
  },
  mapBannerBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  mapBannerBtnText: {
    color: '#055528',
    fontSize: 12,
    fontWeight: '800',
  },
  mapBannerArt: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    position: 'relative',
    overflow: 'hidden',
  },
  mapGrid: {
    ...StyleSheet.absoluteFillObject,
  },
  mapLine: {
    position: 'absolute',
    backgroundColor: '#cbd5e1',
  },
  mapLineH1: {
    left: 0,
    right: 0,
    top: '35%',
    height: 2,
  },
  mapLineH2: {
    left: 0,
    right: 0,
    top: '68%',
    height: 2,
  },
  mapLineV1: {
    top: 0,
    bottom: 0,
    left: '30%',
    width: 2,
  },
  mapLineV2: {
    top: 0,
    bottom: 0,
    left: '72%',
    width: 2,
  },
  mapPulseOuter: {
    position: 'absolute',
    top: '42%',
    left: '48%',
    width: 28,
    height: 28,
    marginLeft: -14,
    marginTop: -14,
    borderRadius: 14,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPulseInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2563eb',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#076F32',
  },
  sectionLoader: {
    marginVertical: 18,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 16,
  },
  hList: {
    gap: 8,
    paddingBottom: 14,
    paddingRight: 8,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    paddingBottom: 14,
  },
  seeAllContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  shopGrid: {
    gap: 10,
    paddingBottom: 14,
  },
  productCard: {
    width: 168,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    paddingBottom: 6,
  },
  productCardGrid: {
    width: '48.5%',
  },
  productImageWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#f8fafc',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productEmoji: {
    fontSize: 18,
  },
  productDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 'auto',
  },
  productDistanceText: {
    fontSize: 8,
    color: '#64748b',
    fontWeight: '700',
  },
  promoBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 4,
    backgroundColor: '#dc2626',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  promoBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  promoPriceWrap: {
    flex: 1,
    gap: 1,
  },
  heartBtn: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minHeight: 30,
    borderRadius: 15,
    paddingHorizontal: 9,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
  },
  heartCountText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  productName: {
    marginTop: 4,
    marginHorizontal: 6,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    color: '#0f172a',
    minHeight: 34,
  },
  productPrice: {
    flex: 1,
    marginHorizontal: 6,
    marginTop: 1,
    fontSize: 11,
    fontWeight: '800',
    color: '#dc2626',
  },
  productOriginalPrice: {
    marginHorizontal: 6,
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  productFooter: {
    marginTop: 4,
    marginHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  productMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginHorizontal: 6,
    marginTop: 1,
  },
  productStore: {
    flex: 1,
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  productRating: {
    fontSize: 8,
    color: '#334155',
    fontWeight: '700',
  },
  shopCard: {
    width: 196,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 8,
  },
  shopCardGrid: {
    width: '100%',
  },
  shopAvatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
  },
  shopAvatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  shopInfo: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  shopName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  shopRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  shopRatingText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0f172a',
  },
  shopDistance: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginLeft: 'auto',
  },
  shopStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  shopStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#076F32',
  },
  shopStatusDotClosed: {
    backgroundColor: '#94a3b8',
  },
  shopStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#076F32',
  },
  shopStatusTextClosed: {
    color: '#94a3b8',
  },
  shopCategory: {
    fontSize: 9,
    fontWeight: '500',
    color: '#94a3b8',
    marginTop: 1,
  },
});
