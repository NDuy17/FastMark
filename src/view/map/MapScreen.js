import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as Location from 'expo-location';

import { getShopCategoriesOnBackend } from '../../api/productApi';
import { fetchRouteDistancesFromOrigin } from '../../api/routingApi';

import LeafletMap from '../shared/components/LeafletMap';
import DirectionsScreen from './DirectionsScreen';
import AddressSearchBar from './AddressSearchBar';
import ProductDetailScreen from '../store/ProductDetailScreen';
import StoreDetailScreen from '../store/StoreDetailScreen';
import InboxScreen from '../inbox/InboxScreen';
import ReservationModal from '../buyer/ReservationModal';
import { calculateDistanceMeters, formatDistance, hasValidLocation, normalizeExpoLocation } from '../../core/utils/geo';
import { loadNearbyRegisteredShops, reverseGeocodeLocation } from '../../viewmodel/map/mapViewModel';
import { loadStoreById } from '../../viewmodel/store/storeViewModel';
import { mapLogger as log } from '../../core/utils/logger';
import { RESERVATION_TAB } from '../../constants/sellerOrders';
import AvatarBadge from '../shared/components/AvatarBadge';
import { isRemoteAvatarUrl } from '../../core/utils/avatarInitial';

const TYPE_LABEL = {
  cafe: 'Cà phê',
  food: 'Quán ăn',
  milktea: 'Trà sữa',
  snack: 'Ăn vặt',
  shop: 'Gian hàng',
};

const PANEL_HANDLE_HEIGHT = 20;
const MAP_FLEX_HALF = 3;
const SHOP_FLEX_HALF = 3;
const MAP_FLEX_SHOP_COLLAPSED = 5;
const SHOP_FLEX_COLLAPSED = 1;

function formatScanCoords(location) {
  if (!hasValidLocation(location)) {
    return 'Chưa có tọa độ';
  }

  return `${Number(location.latitude).toFixed(5)}, ${Number(location.longitude).toFixed(5)}`;
}

function MapCategoryOption({ category, selected, onPress }) {
  return (
    <Pressable
      style={[styles.categoryItem, selected && styles.categoryItemActive]}
      onPress={onPress}
    >
      <Text
        style={[styles.categoryOptionName, selected && styles.categoryTextActive]}
        numberOfLines={1}
      >
        {category.name}
      </Text>
      {selected ? <Text style={styles.checkmark}>✓</Text> : null}
    </Pressable>
  );
}

export default function MapScreen({
  children,
  focusStoreRequest,
  onOpenChat,
  onClearFocus,
  onPickupCompleted,
  onOpenBuyerOrders,
  onOpenWalletTopUp,
  onNavigationStateChange,
  isScreenActive = true,
}) {
  const watcherRef = useRef(null);
  const mountedRef = useRef(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [scanLocation, setScanLocation] = useState(null);
  const [scanSystemAddress, setScanSystemAddress] = useState('');
  const [isResolvingScanAddress, setIsResolvingScanAddress] = useState(false);
  const [usingCustomScan, setUsingCustomScan] = useState(false);
  const [recenterRequest, setRecenterRequest] = useState(null);

  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedRadius, setSelectedRadius] = useState(5000);
  // Giá trị đang kéo trên slider (commit vào selectedRadius khi thả tay).
  const [radiusDraft, setRadiusDraft] = useState(5000);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [registeredShops, setRegisteredShops] = useState([]);
  const [isScanningShops, setIsScanningShops] = useState(false);
  const [storeNav, setStoreNav] = useState(null);
  const [chatOpenRequest, setChatOpenRequest] = useState(null);
  const [reserveModal, setReserveModal] = useState(null);
  const [directionsSession, setDirectionsSession] = useState(null);
  const [routeDistanceById, setRouteDistanceById] = useState({});
  const [isShopPanelExpanded, setIsShopPanelExpanded] = useState(false);
  const [shopCategories, setShopCategories] = useState([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const handleSearchFocusChange = useCallback((focused) => {
    setIsSearchFocused(Boolean(focused));
  }, []);

  const toggleFilterMenu = useCallback(() => {
    setMenuVisible((current) => {
      if (!current) {
        setIsShopPanelExpanded(false);
      }
      return !current;
    });
  }, []);

  const closeFilterMenu = useCallback(() => {
    setMenuVisible(false);
  }, []);

  const lastAcceptedRef = useRef(null);
  const reverseScanRequestRef = useRef(0);
  const scanFetchTimerRef = useRef(null);
  const lastScanFetchRef = useRef(null);

  const resolveScanAddress = useCallback(async (location) => {
    if (!hasValidLocation(location)) {
      setScanSystemAddress('');
      return;
    }

    const requestId = reverseScanRequestRef.current + 1;
    reverseScanRequestRef.current = requestId;
    setIsResolvingScanAddress(true);

    try {
      const displayName = await reverseGeocodeLocation(
        location.latitude,
        location.longitude
      );

      if (reverseScanRequestRef.current === requestId) {
        setScanSystemAddress(displayName || '');
      }
    } catch {
      if (reverseScanRequestRef.current === requestId) {
        setScanSystemAddress('');
      }
    } finally {
      if (reverseScanRequestRef.current === requestId) {
        setIsResolvingScanAddress(false);
      }
    }
  }, []);

  const applyScanLocation = useCallback((location, { custom = false } = {}) => {
    if (!hasValidLocation(location)) {
      return;
    }

    setUsingCustomScan(custom);
    setScanLocation(location);
    resolveScanAddress(location);
  }, [resolveScanAddress]);

  useEffect(() => {
    onNavigationStateChange?.(
      Boolean(isScreenActive && (storeNav || directionsSession || chatOpenRequest))
    );
  }, [chatOpenRequest, directionsSession, isScreenActive, onNavigationStateChange, storeNav]);

  useEffect(() => {
    if (isScreenActive) {
      return;
    }
    setStoreNav(null);
    setDirectionsSession(null);
    setChatOpenRequest(null);
  }, [isScreenActive]);

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

  const openStore = useCallback((storeId) => {
    setMenuVisible(false);
    log.info('openStore', { storeId });
    setStoreNav({ screen: 'store', storeId: String(storeId) });
  }, []);

  const openProduct = useCallback((productId) => {
    setStoreNav((prev) => ({
      screen: 'product',
      productId: String(productId),
      storeId: prev?.storeId,
    }));
  }, []);

  const closeStoreNav = useCallback(() => {
    setStoreNav(null);
  }, []);

  const goBackStoreNav = useCallback(() => {
    setStoreNav((prev) => {
      if (prev?.screen === 'product' && prev.storeId) {
        return { screen: 'store', storeId: prev.storeId };
      }
      return null;
    });
  }, []);

  const startLocationTracking = useCallback(async () => {
    watcherRef.current?.remove();
    watcherRef.current = null;

    const updateLocationSafely = (loc) => {
      if (!loc || !mountedRef.current) {
        return;
      }

      const prev = lastAcceptedRef.current;
      if (!prev) {
        lastAcceptedRef.current = loc;
        log.ok('location:first-fix', { lat: loc.latitude, lng: loc.longitude, accuracy: loc.accuracy });
        setCurrentLocation(loc);
        return;
      }

      if (loc.accuracy > 150) {
        log.debug('location:skip-low-accuracy', { accuracy: loc.accuracy });
        return;
      }

      const dist = calculateDistanceMeters(prev, loc);
      if (dist !== null && dist < 3) {
        return;
      }

      lastAcceptedRef.current = loc;
      log.debug('location:update', { lat: loc.latitude, lng: loc.longitude, dist });
      setCurrentLocation(loc);
    };

    try {
      log.info('location:request-permission');
      const permission = await Location.requestForegroundPermissionsAsync();

      if (!mountedRef.current || permission.status !== 'granted') {
        log.warn('location:permission-denied', { status: permission.status });
        return;
      }

      log.ok('location:permission-granted');

      const lastKnown = await Location.getLastKnownPositionAsync({
        maxAge: 60000,
        requiredAccuracy: 200,
      }).catch(() => null);

      if (mountedRef.current && lastKnown) {
        updateLocationSafely(normalizeExpoLocation(lastKnown));
      }

      const preciseLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      }).catch(() => null);

      if (mountedRef.current && preciseLocation) {
        updateLocationSafely(normalizeExpoLocation(preciseLocation));
      }

      const watcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 1,
          timeInterval: 2000,
        },
        (location) => {
          updateLocationSafely(normalizeExpoLocation(location));
        }
      );

      if (mountedRef.current) {
        watcherRef.current = watcher;
      } else {
        watcher.remove();
      }
    } catch (error) {
      log.fail('location:tracking-failed', error);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    startLocationTracking();

    return () => {
      mountedRef.current = false;
      watcherRef.current?.remove();
      watcherRef.current = null;
    };
  }, [startLocationTracking]);

  useEffect(() => {
    if (!hasValidLocation(currentLocation) || usingCustomScan) {
      return;
    }

    setScanLocation((prev) => {
      if (hasValidLocation(prev)) {
        const movedMeters = calculateDistanceMeters(prev, currentLocation);
        // Tránh GPS nhấp nháy hủy liên tục request quét.
        if (movedMeters !== null && movedMeters < 40) {
          return prev;
        }
      }
      resolveScanAddress(currentLocation);
      return currentLocation;
    });
  }, [currentLocation, usingCustomScan, resolveScanAddress]);

  useEffect(() => {
    if (selectedCategory === 'none') {
      setRegisteredShops([]);
      setIsScanningShops(false);
      return undefined;
    }

    if (!hasValidLocation(scanLocation)) {
      return undefined;
    }

    let isCurrent = true;
    // null = tắt lọc hiển thị → quét rộng (unlimited phía API).
    const effectiveRadius = selectedRadius == null ? 0 : selectedRadius;

    if (scanFetchTimerRef.current) {
      clearTimeout(scanFetchTimerRef.current);
    }

    const runFetch = () => {
      const categoryKey =
        selectedCategory === 'all' || selectedCategory === 'none' ? 'all' : String(selectedCategory);
      const locKey = `${Number(scanLocation.latitude).toFixed(4)},${Number(scanLocation.longitude).toFixed(4)},${effectiveRadius},${categoryKey}`;
      if (lastScanFetchRef.current === locKey) {
        return;
      }

      log.info('fetchRegisteredShops:map', {
        lat: scanLocation.latitude,
        lng: scanLocation.longitude,
        radiusMeters: effectiveRadius,
        categoryId: categoryKey,
        customScan: usingCustomScan,
      });

      setIsScanningShops(true);
      loadNearbyRegisteredShops({
        latitude: scanLocation.latitude,
        longitude: scanLocation.longitude,
        radiusMeters: effectiveRadius,
        shopCategoryId: selectedCategory === 'all' || selectedCategory === 'none' ? '' : selectedCategory,
      })
        .then((data) => {
          if (!isCurrent) {
            return;
          }
          lastScanFetchRef.current = locKey;
          log.ok('fetchRegisteredShops:map-loaded', { count: data.length });
          setRegisteredShops(Array.isArray(data) ? data : []);
        })
        .catch((error) => {
          if (!isCurrent) {
            return;
          }
          // Không khóa locKey khi lỗi — lần sau vẫn quét lại được.
          lastScanFetchRef.current = null;
          log.fail('fetchRegisteredShops:map-failed', error);
        })
        .finally(() => {
          if (isCurrent) {
            setIsScanningShops(false);
          }
        });
    };

    // Tab đang mở: quét ngay. Tab ẩn: debounce nhẹ để preload.
    const delayMs = isScreenActive ? 0 : 400;
    scanFetchTimerRef.current = setTimeout(runFetch, delayMs);

    return () => {
      isCurrent = false;
      if (scanFetchTimerRef.current) {
        clearTimeout(scanFetchTimerRef.current);
      }
    };
  }, [scanLocation, selectedRadius, selectedCategory, usingCustomScan, isScreenActive]);

  useEffect(() => {
    let active = true;

    getShopCategoriesOnBackend()
      .then((items) => {
        if (active) {
          setShopCategories(Array.isArray(items) ? items : []);
        }
      })
      .catch(() => {
        if (active) {
          setShopCategories([]);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const shopCategoryLookup = useMemo(() => {
    const byId = new Map();
    shopCategories.forEach((category) => {
      if (!category?.id) {
        return;
      }
      byId.set(String(category.id), {
        name: category.name || category.categoryName || '',
      });
    });
    return byId;
  }, [shopCategories]);

  const enrichShopWithCategory = useCallback(
    (shop) => {
      const categoryId = String(shop.category_id || shop.categoryId || '');
      const categoryMeta = shopCategoryLookup.get(categoryId);

      return {
        ...shop,
        category_id: categoryId,
        categoryId,
        category_name: shop.category_name || categoryMeta?.name || '',
      };
    },
    [shopCategoryLookup]
  );

  const startDirectionsToStore = useCallback(
    ({ shopId, storeName, latitude, longitude, categoryId = '', storeAvatar = '' }) => {
      const nextLatitude = Number(latitude);
      const nextLongitude = Number(longitude);

      if (!Number.isFinite(nextLatitude) || !Number.isFinite(nextLongitude)) {
        Alert.alert('Không chỉ đường được', 'Gian hàng chưa có tọa độ trên bản đồ.');
        return;
      }

      setStoreNav(null);
      setMenuVisible(false);
      setDirectionsSession({
        storeId: String(shopId),
        reservationId: null,
        storeName: storeName || 'Gian hàng',
        storeAvatar: String(storeAvatar || '').trim(),
        destination: {
          latitude: nextLatitude,
          longitude: nextLongitude,
          image_url: String(storeAvatar || '').trim(),
          type: 'shop',
        },
      });
      onClearFocus?.();
    },
    [onClearFocus]
  );

  useEffect(() => {
    const targetStoreId = focusStoreRequest?.storeId;
    const targetLocation = focusStoreRequest?.location;
    const showDirections = Boolean(focusStoreRequest?.showDirections);

    if (targetLocation?.latitude && targetLocation?.longitude) {
      setMenuVisible(false);
      setRecenterRequest({
        location: {
          latitude: targetLocation.latitude,
          longitude: targetLocation.longitude,
        },
        at: focusStoreRequest.at || Date.now(),
      });
      log.info('focusLocationRequest', targetLocation);
      return undefined;
    }

    if (!targetStoreId) {
      return undefined;
    }

    let isCurrent = true;

    function applyFocus(targetStore) {
      if (!isCurrent || !targetStore?.latitude || !targetStore?.longitude) {
        if (showDirections) {
          Alert.alert('Không chỉ đường được', 'Gian hàng chưa có tọa độ trên bản đồ.');
        }
        return;
      }

      setMenuVisible(false);
      setSelectedCategory('all');
      setSelectedRadius(null);
      setStoreNav(null);

      if (showDirections) {
        const enrichedStore = enrichShopWithCategory(targetStore);
        setDirectionsSession({
          storeId: String(targetStoreId),
          reservationId: focusStoreRequest?.reservationId || null,
          storeName: focusStoreRequest?.storeName || enrichedStore.name || 'Gian hàng',
          storeAvatar: String(enrichedStore.image_url || enrichedStore.cover_image_url || '').trim(),
          destination: {
            latitude: targetStore.latitude,
            longitude: targetStore.longitude,
            image_url: String(enrichedStore.image_url || enrichedStore.cover_image_url || '').trim(),
            type: 'shop',
          },
        });
      }

      setRecenterRequest({
        location: {
          latitude: targetStore.latitude,
          longitude: targetStore.longitude,
        },
        at: focusStoreRequest.at || Date.now(),
      });
      log.info('focusStoreRequest', { storeId: targetStoreId, showDirections });
    }

    const cachedStore = registeredShops.find(
      (store) => String(store.id) === String(targetStoreId)
    );

    if (cachedStore) {
      applyFocus(cachedStore);
      return () => {
        isCurrent = false;
      };
    }

    loadStoreById(targetStoreId)
      .then((store) => applyFocus(store))
      .catch((error) => log.fail('focusStoreRequest:load-failed', error));

    return () => {
      isCurrent = false;
    };
  }, [focusStoreRequest, registeredShops, enrichShopWithCategory]);

  const mapItems = useMemo(() => {
    if (selectedCategory === 'none') {
      return [];
    }

    const enrichedShops = registeredShops.map(enrichShopWithCategory);

    if (selectedCategory === 'all') {
      return enrichedShops;
    }

    return enrichedShops.filter(
      (item) => String(item.category_id || item.categoryId || '') === String(selectedCategory)
    );
  }, [registeredShops, selectedCategory, enrichShopWithCategory]);

  const visibleRestaurants = useMemo(() => {
    const distanceOrigin = scanLocation || currentLocation;

    if (!hasValidLocation(distanceOrigin) || mapItems.length === 0) {
      return mapItems;
    }

    const enriched = mapItems.map((item) => {
      const distanceMeters = Number.isFinite(Number(item.distance_meters))
        ? Number(item.distance_meters)
        : calculateDistanceMeters(distanceOrigin, item);

      return {
        ...item,
        distance_meters: distanceMeters,
      };
    });

    const filtered = selectedRadius
      ? enriched.filter(
          (item) =>
            item.distance_meters !== null &&
            Number.isFinite(item.distance_meters) &&
            item.distance_meters <= selectedRadius
        )
      : enriched;

    return [...filtered].sort(
      (left, right) => (left.distance_meters ?? Number.MAX_SAFE_INTEGER) - (right.distance_meters ?? Number.MAX_SAFE_INTEGER)
    );
  }, [mapItems, scanLocation, currentLocation, selectedRadius]);

  const distanceOrigin = scanLocation || currentLocation;
  const visibleRestaurantIds = useMemo(
    () => visibleRestaurants.map((item) => String(item.id)).join('|'),
    [visibleRestaurants]
  );

  useEffect(() => {
    if (!hasValidLocation(distanceOrigin) || visibleRestaurants.length === 0) {
      setRouteDistanceById({});
      return undefined;
    }

    let active = true;
    const timer = setTimeout(() => {
      fetchRouteDistancesFromOrigin(distanceOrigin, visibleRestaurants)
        .then((distances) => {
          if (active) {
            setRouteDistanceById(distances);
          }
        })
        .catch(() => {
          if (active) {
            setRouteDistanceById({});
          }
        });
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    distanceOrigin?.latitude,
    distanceOrigin?.longitude,
    visibleRestaurantIds,
  ]);

  const displayRestaurants = useMemo(() => {
    const enriched = visibleRestaurants.map((item) => {
      const routeDistance = routeDistanceById[String(item.id)];
      return {
        ...item,
        distance_meters: Number.isFinite(routeDistance) ? routeDistance : item.distance_meters,
      };
    });

    return [...enriched].sort(
      (left, right) =>
        (left.distance_meters ?? Number.MAX_SAFE_INTEGER) -
        (right.distance_meters ?? Number.MAX_SAFE_INTEGER)
    );
  }, [visibleRestaurants, routeDistanceById]);

  const originLocation = distanceOrigin;

  const radiusCircleProp =
    selectedRadius && hasValidLocation(scanLocation || currentLocation)
      ? { center: scanLocation || currentLocation, radius: selectedRadius }
      : null;

  function requestRecenter(location) {
    lastAcceptedRef.current = location;
    setCurrentLocation(location);
    setRecenterRequest({ location, at: Date.now() });
  }

  function handleRecenterPress() {
    log.info('recenter:pressed');
    setUsingCustomScan(false);

    const cached = lastAcceptedRef.current || currentLocation;
    if (hasValidLocation(cached)) {
      requestRecenter(cached);
      log.info('recenter:instant', { lat: cached.latitude, lng: cached.longitude });
    }

    Location.getForegroundPermissionsAsync()
      .then(async (permission) => {
        if (permission.status !== 'granted') {
          const requested = await Location.requestForegroundPermissionsAsync();
          if (requested.status !== 'granted') {
            return null;
          }
        }

        const lastKnown = await Location.getLastKnownPositionAsync({
          maxAge: 30000,
          requiredAccuracy: 500,
        }).catch(() => null);

        if (lastKnown) {
          return normalizeExpoLocation(lastKnown);
        }

        return Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }).then(normalizeExpoLocation);
      })
      .then((loc) => {
        if (loc && hasValidLocation(loc)) {
          requestRecenter(loc);
          log.debug('recenter:gps-refined', { lat: loc.latitude, lng: loc.longitude });
        } else if (!hasValidLocation(cached)) {
          log.warn('recenter:no-location-restart-tracking');
          startLocationTracking();
        }
      })
      .catch((error) => {
        log.fail('recenter:gps-failed', error);
        if (!hasValidLocation(cached)) {
          startLocationTracking();
        }
      });
  }

  const wasScreenActiveRef = useRef(isScreenActive);

  useEffect(() => {
    if (!isScreenActive) {
      setMenuVisible(false);
      setIsSearchFocused(false);
      wasScreenActiveRef.current = false;
      return;
    }

    const justActivated = !wasScreenActiveRef.current;
    wasScreenActiveRef.current = true;

    if (!justActivated) {
      return;
    }

    // Mở tab Khám phá: bỏ cache quét cũ và ép quét lại quanh vị trí gần nhất.
    lastScanFetchRef.current = null;
    const cached = lastAcceptedRef.current;
    if (hasValidLocation(cached) && !usingCustomScan) {
      resolveScanAddress(cached);
      setScanLocation({ ...cached });
    }
  }, [isScreenActive, usingCustomScan, resolveScanAddress]);

  useEffect(() => {
    if (storeNav) {
      setMenuVisible(false);
    }
  }, [storeNav]);

  const handleMapEvent = useCallback((payload) => {
    log.debug('mapEvent', payload?.type, payload);
    if (payload?.type === 'mapTap') {
      closeFilterMenu();
      return;
    }
    if (payload?.type === 'mapDoubleTap' && hasValidLocation(payload.location)) {
      log.info('scan:double-tap', payload.location);
      applyScanLocation(payload.location, { custom: true });
      return;
    }
    if (payload?.type === 'restaurantTap' && payload.restaurant?.id != null) {
      openStore(payload.restaurant.id);
      return;
    }
  }, [openStore, applyScanLocation, closeFilterMenu]);

  function handleStopDirections() {
    setDirectionsSession(null);
    onClearFocus?.();
  }

  function handleSearchSelect(result) {
    if (!result?.latitude || !result?.longitude) {
      return;
    }

    setMenuVisible(false);
    setRecenterRequest({
      location: {
        latitude: result.latitude,
        longitude: result.longitude,
      },
      at: Date.now(),
    });
    log.info('search:select', { label: result.label });
  }

  const RADIUS_SLIDER_MAX = 10000;
  const RADIUS_SLIDER_STEP = 500;

  function formatRadiusLabel(meters) {
    if (!meters) {
      return 'Tắt';
    }
    return formatDistance(meters);
  }

  function adjustRadius(delta) {
    const base = selectedRadius == null ? 0 : Number(selectedRadius) || 0;
    const next = Math.max(0, Math.min(RADIUS_SLIDER_MAX, base + delta));
    setSelectedRadius(next > 0 ? next : null);
  }

  useEffect(() => {
    setRadiusDraft(selectedRadius == null ? 0 : selectedRadius);
  }, [selectedRadius]);

  const restaurantCategories = useMemo(() => {
    const dynamicCategories = shopCategories.map((category) => ({
      key: String(category.id),
      name: category.name || category.categoryName || 'Danh mục',
      description: category.description || '',
    }));

    return [
      { key: 'none', name: 'Ẩn tất cả' },
      { key: 'all', name: 'Tất cả gian hàng' },
      ...dynamicCategories,
    ];
  }, [shopCategories]);

  const selectedCategoryLabel =
    restaurantCategories.find((category) => category.key === selectedCategory)?.name || 'Tất cả';

  const selectedRadiusLabel = formatRadiusLabel(selectedRadius);

  const showNearbyPanel =
    selectedCategory !== 'none' && displayRestaurants.length > 0 && !storeNav;

  const scanLocationLabel = useMemo(() => {
    const coords = formatScanCoords(scanLocation || currentLocation);
    const address = isResolvingScanAddress
      ? 'Đang lấy địa chỉ hệ thống...'
      : scanSystemAddress || 'Chưa có địa chỉ hệ thống';

    return `${coords} · ${address}`;
  }, [scanLocation, currentLocation, isResolvingScanAddress, scanSystemAddress]);

  const mapFlex = isShopPanelExpanded ? MAP_FLEX_HALF : MAP_FLEX_SHOP_COLLAPSED;
  const shopFlex = isShopPanelExpanded ? SHOP_FLEX_HALF : SHOP_FLEX_COLLAPSED;

  let screenContent;

  if (chatOpenRequest) {
    screenContent = (
      <InboxScreen
        buyerView
        messagesOnly
        chatRequest={chatOpenRequest}
        onBack={() => setChatOpenRequest(null)}
        onViewShop={(shopId) => {
          setChatOpenRequest(null);
          openStore(shopId);
        }}
      />
    );
  } else if (directionsSession) {
    screenContent = (
      <DirectionsScreen
        session={directionsSession}
        onStop={handleStopDirections}
      />
    );
  } else if (storeNav?.screen === 'store') {
    screenContent = (
      <StoreDetailScreen
        storeId={storeNav.storeId}
        originLocation={originLocation}
        onBack={closeStoreNav}
        onProductPress={openProduct}
        onOpenChat={handleOpenChatLocal}
        onNavigateDirections={startDirectionsToStore}
      />
    );
  } else if (storeNav?.screen === 'product') {
    screenContent = (
      <ProductDetailScreen
        productId={storeNav.productId}
        onBack={goBackStoreNav}
        onStorePress={openStore}
        onOpenChat={handleOpenChatLocal}
        onOpenTopUp={onOpenWalletTopUp}
        onReserve={(product, store, selectedVariant) =>
          setReserveModal({
            product: { ...product, id: product.id || storeNav.productId },
            store,
            preselectedVariantId: selectedVariant?.id || null,
          })
        }
      />
    );
  } else {
    screenContent = (
      <View style={styles.container}>
      <View
        style={[styles.mapArea, { flex: mapFlex }]}
        pointerEvents="box-none"
      >
        <LeafletMap
          currentLocation={currentLocation}
          radiusCircle={radiusCircleProp}
          recenterRequest={recenterRequest}
          scanLocation={
            usingCustomScan && hasValidLocation(scanLocation) ? scanLocation : null
          }
          restaurants={visibleRestaurants}
          onEvent={handleMapEvent}
          interactive={!isSearchFocused}
        />

        <View style={styles.searchOverlay} pointerEvents="box-none">
          <View style={styles.searchBarWrap} pointerEvents="auto">
            <AddressSearchBar
              placeholder="Tìm đường, địa điểm..."
              onSelectResult={handleSearchSelect}
              onFocusChange={handleSearchFocusChange}
            />
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bộ lọc bản đồ"
          pointerEvents="auto"
          style={({ pressed }) => [
            styles.settingsFab,
            pressed && styles.mapFabPressed,
            menuVisible && styles.settingsFabActive,
          ]}
          onPress={toggleFilterMenu}
        >
          <Text style={[styles.settingsFabIcon, menuVisible && styles.settingsFabIconActive]}>
            ⚙️
          </Text>
        </Pressable>

        {menuVisible ? (
          <View style={styles.inlineFilterPanel} pointerEvents="auto">
            <View style={styles.filterPanelHeader}>
              <Text style={styles.menuHeader}>Tọa độ quét & danh mục</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đóng bộ lọc"
                onPress={closeFilterMenu}
                style={({ pressed }) => [styles.filterCloseButton, pressed && styles.mapFabPressed]}
              >
                <Text style={styles.filterCloseButtonText}>✕</Text>
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              <Text style={styles.menuSummary}>{scanLocationLabel}</Text>
              <Text style={styles.menuSummary}>
                Danh mục: {selectedCategoryLabel}
                {' · '}
                Bán kính: {selectedRadiusLabel}
              </Text>

              <View style={styles.radiusHeaderRow}>
                <Text style={styles.menuSubHeader}>Bán kính hiển thị</Text>
                <Text style={styles.radiusValueText}>
                  {radiusDraft > 0 ? `📍 ${formatRadiusLabel(radiusDraft)}` : '🚫 0 km'}
                </Text>
              </View>
              <Slider
                style={styles.radiusSlider}
                minimumValue={0}
                maximumValue={RADIUS_SLIDER_MAX}
                step={RADIUS_SLIDER_STEP}
                value={selectedRadius == null ? 0 : selectedRadius}
                minimumTrackTintColor="#076F32"
                maximumTrackTintColor="#e2e8f0"
                thumbTintColor="#076F32"
                onValueChange={(value) => setRadiusDraft(value)}
                onSlidingComplete={(value) =>
                  setSelectedRadius(value > 0 ? Math.round(value) : null)
                }
              />
              <View style={styles.radiusScaleRow}>
                <Text style={styles.radiusScaleText}>0 km</Text>
                <Text style={styles.radiusScaleText}>5 km</Text>
                <Text style={styles.radiusScaleText}>10 km</Text>
              </View>
              <View style={styles.radiusStepRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Giảm bán kính 0,5 km"
                  style={({ pressed }) => [styles.radiusStepBtn, pressed && styles.mapFabPressed]}
                  onPress={() => adjustRadius(-RADIUS_SLIDER_STEP)}
                >
                  <Ionicons name="remove" size={18} color="#076F32" />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Tăng bán kính 0,5 km"
                  style={({ pressed }) => [styles.radiusStepBtn, pressed && styles.mapFabPressed]}
                  onPress={() => adjustRadius(RADIUS_SLIDER_STEP)}
                >
                  <Ionicons name="add" size={18} color="#076F32" />
                </Pressable>
              </View>

              <View style={styles.divider} />

              <Text style={styles.menuSubHeader}>Danh mục gian hàng</Text>
              {restaurantCategories.map((cat) => {
                const isSelected = selectedCategory === cat.key;
                return (
                  <MapCategoryOption
                    key={cat.key}
                    category={cat}
                    selected={isSelected}
                    onPress={() => setSelectedCategory(cat.key)}
                  />
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.locationBar} pointerEvents="box-none">
          <Text style={styles.locationBarText} numberOfLines={2}>
            {scanLocationLabel}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Về vị trí của tôi"
            pointerEvents="auto"
            style={({ pressed }) => [
              styles.recenterButton,
              pressed && styles.mapFabPressed,
            ]}
            onPress={handleRecenterPress}
          >
            <Text style={styles.recenterButtonText}>Về vị trí của tôi</Text>
          </Pressable>
        </View>

        {children}
      </View>

      <>
          <View style={styles.panelResizeHandleWrap}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isShopPanelExpanded ? 'Thu gọn danh sách gian hàng' : 'Mở rộng danh sách gian hàng'}
              onPress={() => setIsShopPanelExpanded((current) => !current)}
              style={({ pressed }) => [
                styles.panelResizeButton,
                pressed && styles.panelResizeButtonPressed,
              ]}
            >
              <Ionicons
                name={isShopPanelExpanded ? 'chevron-down' : 'chevron-up'}
                size={18}
                color="#64748b"
              />
            </Pressable>
          </View>
          <View style={[styles.nearbyPanel, { flex: shopFlex }]} onTouchStart={closeFilterMenu}>
          <Text style={styles.nearbyTitle}>
            {showNearbyPanel
              ? `${displayRestaurants.length} điểm trong ${selectedRadiusLabel} — chạm để xem`
              : selectedCategory === 'none'
                ? 'Chọn loại hiển thị để xem danh sách'
                : !hasValidLocation(scanLocation || currentLocation)
                  ? 'Đang lấy vị trí để quét gian hàng gần bạn...'
                  : isScanningShops
                    ? 'Đang quét gian hàng gần bạn...'
                    : `Không có điểm nào trong bán kính ${selectedRadiusLabel}`}
          </Text>
          {showNearbyPanel ? (
            <FlatList
              data={displayRestaurants}
              keyExtractor={(item) => String(item.id)}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.nearbyList}
              renderItem={({ item: restaurant }) => {
                const username = restaurant.shop_username
                  ? `@${String(restaurant.shop_username).replace(/^@/, '')}`
                  : '';
                const categoryLabel =
                  restaurant.category_name ||
                  TYPE_LABEL[restaurant.type] ||
                  'Gian hàng';
                const systemAddress =
                  restaurant.system_address || restaurant.address || 'Chưa có địa chỉ hệ thống';
                const productCount = Number(restaurant.total_products ?? restaurant.product_count ?? 0);
                const reviewCount = Number(restaurant.review_count ?? 0);
                const distanceLabel = formatDistance(restaurant.distance_meters);

                return (
                  <Pressable
                    style={({ pressed }) => [
                      styles.nearbyCard,
                      pressed && styles.nearbyCardPressed,
                    ]}
                    onPress={() => openStore(restaurant.id)}
                  >
                    <AvatarBadge
                      name={restaurant.shop_name || restaurant.name || 'S'}
                      uri={
                        isRemoteAvatarUrl(restaurant.image_url)
                          ? restaurant.image_url
                          : ''
                      }
                      size={56}
                      style={styles.nearbyThumb}
                    />
                    <View style={styles.nearbyCardBody}>
                      <View style={styles.nearbyCardTitleRow}>
                        <Text style={styles.nearbyName} numberOfLines={1}>
                          {restaurant.name}
                        </Text>
                        <Text style={styles.nearbyDistance}>{distanceLabel}</Text>
                      </View>
                      <Text style={styles.nearbyMetaLine} numberOfLines={1}>
                        {[username, categoryLabel].filter(Boolean).join(' · ') || 'Chưa có username'}
                      </Text>
                      <Text style={styles.nearbyAddress} numberOfLines={2}>
                        {systemAddress}
                      </Text>
                      <Text style={styles.nearbyStats} numberOfLines={1}>
                        {productCount} sản phẩm · {reviewCount} đánh giá
                      </Text>
                    </View>
                  </Pressable>
                );
              }}
            />
          ) : null}
          </View>
        </>
      </View>
    );
  }

  return (
    <>
      {screenContent}
      <ReservationModal
        visible={Boolean(reserveModal)}
        product={reserveModal?.product}
        store={reserveModal?.store}
        preselectedVariantId={reserveModal?.preselectedVariantId}
        onClose={() => setReserveModal(null)}
        onSuccess={() => {
          setReserveModal(null);
          setStoreNav(null);
          onOpenBuyerOrders?.(RESERVATION_TAB.HOLDING);
        }}
        onOpenTopUp={onOpenWalletTopUp}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef2f0',
  },
  mapArea: {
    flex: 1,
    position: 'relative',
    minHeight: 0,
  },
  searchOverlay: {
    position: 'absolute',
    top: 4,
    left: 0,
    right: 0,
    zIndex: 40,
    elevation: 16,
  },
  searchBarWrap: {
    paddingHorizontal: 14,
    zIndex: 41,
    elevation: 16,
  },
  nearbyPanel: {
    minHeight: 0,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  panelResizeHandleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    height: PANEL_HANDLE_HEIGHT,
    marginTop: -10,
    zIndex: 25,
  },
  panelResizeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  panelResizeButtonPressed: {
    opacity: 0.82,
  },
  nearbyTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  nearbyList: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  nearbyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  nearbyCardPressed: {
    opacity: 0.85,
    backgroundColor: '#f0fdfa',
  },
  nearbyThumb: {
    width: 56,
    height: 56,
    borderRadius: 28,
    flexShrink: 0,
  },
  nearbyCardBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  nearbyCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nearbyName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 18,
  },
  nearbyDistance: {
    fontSize: 11,
    fontWeight: '800',
    color: '#076F32',
    backgroundColor: '#E6F4EC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  nearbyMetaLine: {
    fontSize: 12,
    fontWeight: '600',
    color: '#076F32',
    lineHeight: 16,
  },
  nearbyAddress: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
  },
  nearbyStats: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    lineHeight: 16,
  },
  mapFab: {
    position: 'absolute',
    right: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 20,
  },
  mapFabPressed: {
    opacity: 0.85,
  },
  settingsFab: {
    position: 'absolute',
    top: '42%',
    right: 14,
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 30,
  },
  settingsFabActive: {
    backgroundColor: '#076F32',
  },
  settingsFabIcon: {
    fontSize: 20,
    color: '#0f172a',
  },
  settingsFabIconActive: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  recenterButton: {
    minHeight: 38,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0ea5e9',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 5,
    flexShrink: 0,
  },
  recenterButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  locationBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 20,
  },
  locationBarText: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    color: '#334155',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  inlineFilterPanel: {
    position: 'absolute',
    top: 56,
    left: 18,
    right: 64,
    bottom: 74,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 28,
  },
  filterPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  filterCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  filterCloseButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#64748b',
  },
  categoryOptionName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  menuHeader: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 4,
  },
  menuSummary: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
    fontWeight: '600',
  },
  menuSubHeader: {
    fontSize: 12,
    fontWeight: '750',
    color: '#64748b',
    marginTop: 8,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  radiusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  radiusValueText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#076F32',
  },
  radiusSlider: {
    width: '100%',
    height: 32,
  },
  radiusScaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  radiusScaleText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
  },
  radiusStepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 4,
  },
  radiusStepBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#c7ead6',
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 6,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  categoryItemActive: {
    backgroundColor: '#f1f5f9',
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  categoryTextActive: {
    color: '#076F32',
    fontWeight: '800',
  },
  checkmark: {
    fontSize: 13,
    color: '#076F32',
    fontWeight: 'bold',
  },
  directionsCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  directionsCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  directionsCardIcon: {
    fontSize: 28,
    marginTop: 2,
  },
  directionsCardTitles: {
    flex: 1,
  },
  directionsTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 4,
  },
  directionsMeta: {
    fontSize: 13,
    fontWeight: '700',
    color: '#076F32',
  },
  directionsActions: {
    flexDirection: 'row',
    gap: 10,
  },
  directionsSecondaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  directionsSecondaryBtnFull: {
    flex: 1,
  },
  directionsSecondaryText: {
    color: '#475569',
    fontWeight: '800',
    fontSize: 13,
  },
  directionsPrimaryBtn: {
    flex: 1.2,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#076F32',
  },
  directionsPrimaryBtnDisabled: {
    opacity: 0.7,
  },
  directionsPrimaryText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 13,
  },
});
