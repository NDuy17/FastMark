import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';

import { discoverProductsOnBackend, listPromotionProductsOnBackend } from '../../api/productApi';
import { fetchSearchShopsFromNode } from '../../api/storeNodeApi';
import { normalizeProduct } from '../../model/productModel';
import { formatPriceRange, getProductPromoPriceLabels } from '../../core/utils/productFormat';
import { formatDistance, hasValidLocation } from '../../core/utils/geo';
import { isRemoteAvatarUrl } from '../../core/utils/avatarInitial';
import {
  addSearchHistory,
  clearSearchHistory,
  getSearchHistory,
  removeSearchHistory,
} from '../../core/storage/searchHistoryStorage';
import { selectAuthProfile, selectAuthUser } from '../../viewmodel/auth/authSelectors';
import AvatarBadge from '../shared/components/AvatarBadge';
import ClearableSearchField from '../shared/components/ClearableSearchField';
import CircularBackButton from '../shared/components/CircularBackButton';
import { useScreenInsets } from '../../hooks/useScreenInsets';

const SEARCH_TABS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'products', label: 'Sản phẩm' },
  { key: 'users', label: 'Người dùng' },
];

const SUGGEST_DEBOUNCE_MS = 300;
const SUGGEST_LIMIT = 6;

function productDistance(product) {
  const value = Number(product?.distanceMeters);
  return Number.isFinite(value) && value >= 0 ? value : Number.POSITIVE_INFINITY;
}

function shopDistance(shop) {
  const value = Number(shop?.distance_meters ?? shop?.distanceMeters);
  return Number.isFinite(value) && value >= 0 ? value : Number.POSITIVE_INFINITY;
}

function sortByDistanceAsc(items, getDistance) {
  return [...items].sort((left, right) => {
    const delta = getDistance(left) - getDistance(right);
    if (delta !== 0) {
      return delta;
    }
    return String(left.id || '').localeCompare(String(right.id || ''));
  });
}

function mergePromoIntoProducts(rows, promoRows) {
  const promoById = new Map();
  (Array.isArray(promoRows) ? promoRows : []).forEach((row) => {
    const promo = normalizeProduct(row);
    if (promo.id && promo.isPromotion && Number(promo.discountPercent) > 0) {
      promoById.set(promo.id, promo);
    }
  });

  return sortByDistanceAsc(
    (Array.isArray(rows) ? rows : []).map((row) => {
      const product = normalizeProduct(row);
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
    }),
    productDistance
  );
}

function ProductResultRow({ product, onPress }) {
  const distance = formatDistance(product.distanceMeters);
  const isPromotion = Boolean(product.isPromotion) && Number(product.discountPercent) > 0;
  const promoLabels = isPromotion ? getProductPromoPriceLabels(product) : null;
  const unit = product.donVi ? `/${product.donVi}` : '';

  return (
    <Pressable
      style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}
      onPress={() => onPress?.(product.id)}
    >
      {product.thumbnail ? (
        <Image source={{ uri: product.thumbnail }} style={styles.resultThumb} />
      ) : (
        <View style={[styles.resultThumb, styles.resultThumbFallback]}>
          <Text style={styles.resultEmoji}>{product.image_emoji || '📦'}</Text>
        </View>
      )}
      <View style={styles.resultBody}>
        <Text style={styles.resultTitle} numberOfLines={2}>
          {product.name}
        </Text>
        {isPromotion && promoLabels ? (
          <View>
            <Text style={styles.resultOriginalPrice} numberOfLines={1}>
              {promoLabels.originalLabel}
              {unit}
            </Text>
            <Text style={styles.resultPrice} numberOfLines={1}>
              {promoLabels.saleLabel}
              {unit}
              {Number(product.discountPercent) > 0 ? ` · -${product.discountPercent}%` : ''}
            </Text>
          </View>
        ) : (
          <Text style={styles.resultPrice} numberOfLines={1}>
            {formatPriceRange(product.minPrice ?? product.price, product.maxPrice ?? product.price)}
            {unit}
          </Text>
        )}
        <View style={styles.resultMetaRow}>
          <Ionicons name="storefront-outline" size={11} color="#64748b" />
          <Text style={styles.resultMetaText} numberOfLines={1}>
            {product.storeName || 'Gian hàng'}
          </Text>
          {distance && distance !== '--' ? (
            <Text style={styles.resultDistance}>{distance}</Text>
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
    </Pressable>
  );
}

function ShopResultRow({ shop, onPress }) {
  const name = shop.shop_name || shop.name || 'Gian hàng';
  const username = shop.shop_username || shop.shopUsername || '';
  const distance = formatDistance(shop.distance_meters ?? shop.distanceMeters);
  const isOpen = shop.is_open !== false;
  const avatar = isRemoteAvatarUrl(shop.image_url || shop.cover_image_url)
    ? shop.image_url || shop.cover_image_url
    : '';

  return (
    <Pressable
      style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}
      onPress={() => onPress?.(shop.id)}
    >
      <AvatarBadge name={name} uri={avatar} size={48} />
      <View style={styles.resultBody}>
        <Text style={styles.resultTitle} numberOfLines={1}>
          {name}
        </Text>
        {username ? (
          <Text style={styles.resultMetaText} numberOfLines={1}>
            @{username}
          </Text>
        ) : null}
        <View style={styles.resultMetaRow}>
          <View style={[styles.openDot, !isOpen && styles.openDotClosed]} />
          <Text style={[styles.openText, !isOpen && styles.openTextClosed]}>
            {isOpen ? 'Đang mở cửa' : 'Đang đóng cửa'}
          </Text>
          {distance && distance !== '--' ? (
            <Text style={styles.resultDistance}>{distance}</Text>
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
    </Pressable>
  );
}

function HistoryRow({ keyword, onPress, onRemove }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.suggestRow, pressed && styles.pressed]}
      onPress={() => onPress?.(keyword)}
    >
      <Ionicons name="time-outline" size={18} color="#94a3b8" />
      <Text style={styles.suggestText} numberOfLines={1}>
        {keyword}
      </Text>
      <Pressable
        onPress={() => onRemove?.(keyword)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Xóa lịch sử"
      >
        <Ionicons name="close" size={16} color="#94a3b8" />
      </Pressable>
    </Pressable>
  );
}

function SuggestionRow({ item, onPress }) {
  const isProduct = item.type === 'product';
  const label = isProduct
    ? item.data.name
    : item.data.shop_name || item.data.name || 'Gian hàng';
  const username = item.data.shop_username || item.data.shopUsername || item.data.userName || '';
  const subtitle = isProduct
    ? item.data.storeName || 'Sản phẩm'
    : username
      ? `@${String(username).replace(/^@+/, '')}`
      : 'Gian hàng';
  const distance = formatDistance(item.distance);

  return (
    <Pressable
      style={({ pressed }) => [styles.suggestRow, pressed && styles.pressed]}
      onPress={() => onPress?.(item)}
    >
      <Ionicons
        name={isProduct ? 'cube-outline' : 'storefront-outline'}
        size={18}
        color="#076F32"
      />
      <View style={styles.suggestBody}>
        <Text style={styles.suggestText} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.suggestSubText} numberOfLines={1}>
          {isProduct ? `Sản phẩm · ${subtitle}` : `Gian hàng · ${subtitle}`}
        </Text>
      </View>
      {distance && distance !== '--' ? (
        <Text style={styles.suggestDistance}>{distance}</Text>
      ) : null}
    </Pressable>
  );
}

export default function SearchScreen({ currentLocation, onBack, onOpenProduct, onOpenShop }) {
  const insets = useScreenInsets();
  const authUser = useSelector(selectAuthUser);
  const profile = useSelector(selectAuthProfile);
  const historyUserId = String(profile?.id || authUser?.uid || '').trim();
  const suggestRequestIdRef = useRef(0);
  const searchRequestIdRef = useRef(0);
  const [query, setQuery] = useState('');
  const [committedQuery, setCommittedQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [products, setProducts] = useState([]);
  const [shops, setShops] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [history, setHistory] = useState([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [errorText, setErrorText] = useState('');

  const locationReady = hasValidLocation(currentLocation);
  const trimmedQuery = query.trim();
  const showResults = Boolean(committedQuery) && trimmedQuery === committedQuery;

  useEffect(() => {
    let alive = true;
    if (!historyUserId) {
      setHistory([]);
      return undefined;
    }
    getSearchHistory(historyUserId).then((items) => {
      if (alive) {
        setHistory(items);
      }
    });
    return () => {
      alive = false;
    };
  }, [historyUserId]);

  const runSearch = useCallback(
    async (keywordInput) => {
      const keyword = String(keywordInput || '').trim();
      if (!keyword) {
        return;
      }

      if (!locationReady) {
        setErrorText('Bật vị trí để tìm kiếm quanh bạn.');
        return;
      }

      setQuery(keyword);
      setCommittedQuery(keyword);
      setActiveTab('all');
      setSuggestions([]);
      setErrorText('');
      setIsSearching(true);

      if (historyUserId) {
        const nextHistory = await addSearchHistory(historyUserId, keyword);
        setHistory(nextHistory);
      }

      const requestId = ++searchRequestIdRef.current;
      try {
        const [rows, promoRows, shopResult] = await Promise.all([
          discoverProductsOnBackend({
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            radiusMeters: 0,
            search: keyword,
            limit: 50,
          }),
          listPromotionProductsOnBackend({
            limit: 80,
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
          }).catch(() => []),
          fetchSearchShopsFromNode({
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            radiusMeters: 0,
            shopQuery: keyword,
            identityOnly: true,
            limit: 50,
          }),
        ]);

        if (searchRequestIdRef.current !== requestId) {
          return;
        }

        setProducts(mergePromoIntoProducts(rows, promoRows));
        setShops(
          sortByDistanceAsc(Array.isArray(shopResult?.shops) ? shopResult.shops : [], shopDistance)
        );
      } catch (error) {
        if (searchRequestIdRef.current === requestId) {
          setProducts([]);
          setShops([]);
          setErrorText(error.message || 'Không tìm kiếm được. Vui lòng thử lại.');
        }
      } finally {
        if (searchRequestIdRef.current === requestId) {
          setIsSearching(false);
        }
      }
    },
    [currentLocation?.latitude, currentLocation?.longitude, historyUserId, locationReady]
  );

  useEffect(() => {
    if (showResults || !trimmedQuery) {
      suggestRequestIdRef.current += 1;
      setSuggestions([]);
      setIsSuggesting(false);
      return undefined;
    }

    if (!locationReady) {
      setSuggestions([]);
      setIsSuggesting(false);
      return undefined;
    }

    const requestId = ++suggestRequestIdRef.current;
    setIsSuggesting(true);

    const timer = setTimeout(async () => {
      try {
        const [productRows, shopResult] = await Promise.all([
          discoverProductsOnBackend({
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            radiusMeters: 0,
            search: trimmedQuery,
            limit: SUGGEST_LIMIT,
          }),
          fetchSearchShopsFromNode({
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            radiusMeters: 0,
            shopQuery: trimmedQuery,
            identityOnly: true,
            limit: SUGGEST_LIMIT,
          }),
        ]);

        if (suggestRequestIdRef.current !== requestId) {
          return;
        }

        const productSuggestions = sortByDistanceAsc(
          (Array.isArray(productRows) ? productRows : []).map((row) => normalizeProduct(row)),
          productDistance
        )
          .slice(0, SUGGEST_LIMIT)
          .map((product) => ({
            id: `product-${product.id}`,
            type: 'product',
            data: product,
            distance: productDistance(product),
          }));

        const shopSuggestions = sortByDistanceAsc(
          Array.isArray(shopResult?.shops) ? shopResult.shops : [],
          shopDistance
        )
          .slice(0, SUGGEST_LIMIT)
          .map((shop) => ({
            id: `shop-${shop.id}`,
            type: 'shop',
            data: shop,
            distance: shopDistance(shop),
          }));

        // Luôn gợi ý cả sản phẩm và gian hàng/người dùng, ưu tiên gần trước.
        const merged = [...productSuggestions, ...shopSuggestions].sort(
          (left, right) => left.distance - right.distance
        );

        setSuggestions(merged);
      } catch {
        if (suggestRequestIdRef.current === requestId) {
          setSuggestions([]);
        }
      } finally {
        if (suggestRequestIdRef.current === requestId) {
          setIsSuggesting(false);
        }
      }
    }, SUGGEST_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [
    trimmedQuery,
    showResults,
    locationReady,
    currentLocation?.latitude,
    currentLocation?.longitude,
  ]);

  function handleChangeQuery(nextValue) {
    setQuery(nextValue);
    if (String(nextValue || '').trim() !== committedQuery) {
      setCommittedQuery('');
      setProducts([]);
      setShops([]);
      setErrorText('');
    }
  }

  async function handleRemoveHistory(keyword) {
    if (!historyUserId) {
      return;
    }
    const next = await removeSearchHistory(historyUserId, keyword);
    setHistory(next);
  }

  async function handleClearHistory() {
    if (!historyUserId) {
      return;
    }
    const next = await clearSearchHistory(historyUserId);
    setHistory(next);
  }

  function handleSuggestionPress(item) {
    if (item.type === 'product') {
      const name = String(item.data?.name || '').trim();
      if (name && historyUserId) {
        addSearchHistory(historyUserId, name).then(setHistory);
      }
      onOpenProduct?.(item.data.id);
      return;
    }
    const name = String(item.data?.shop_name || item.data?.name || '').trim();
    if (name && historyUserId) {
      addSearchHistory(historyUserId, name).then(setHistory);
    }
    onOpenShop?.(item.data.id);
  }

  const allItems = useMemo(() => {
    const productItems = products.map((product) => ({
      key: `product-${product.id}`,
      type: 'product',
      data: product,
      distance: productDistance(product),
    }));
    const shopItems = shops.map((shop) => ({
      key: `shop-${shop.id}`,
      type: 'shop',
      data: shop,
      distance: shopDistance(shop),
    }));
    return [...productItems, ...shopItems].sort((left, right) => left.distance - right.distance);
  }, [products, shops]);

  const listData = useMemo(() => {
    if (activeTab === 'products') {
      return products.map((product) => ({
        key: `product-${product.id}`,
        type: 'product',
        data: product,
      }));
    }
    if (activeTab === 'users') {
      return shops.map((shop) => ({
        key: `shop-${shop.id}`,
        type: 'shop',
        data: shop,
      }));
    }
    return allItems;
  }, [activeTab, allItems, products, shops]);

  const emptyText = useMemo(() => {
    if (!showResults || isSearching) {
      return '';
    }
    if (activeTab === 'products') {
      return `Không tìm thấy sản phẩm cho "${committedQuery}".`;
    }
    if (activeTab === 'users') {
      return `Không tìm thấy người dùng cho "${committedQuery}".`;
    }
    return `Không tìm thấy kết quả cho "${committedQuery}".`;
  }, [showResults, isSearching, activeTab, committedQuery]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <CircularBackButton onPress={onBack} variant="plain" style={styles.headerRoundBtn} />
        <Text style={styles.headerTitle} numberOfLines={1}>
          Tìm kiếm
        </Text>
      </View>

      <View style={styles.searchBarWrap}>
        <ClearableSearchField
          value={query}
          onChangeText={handleChangeQuery}
          placeholder="Tìm sản phẩm, người dùng..."
          autoFocus
          onSubmitEditing={() => runSearch(query)}
        />
      </View>

      {showResults ? (
        <View style={styles.tabRow}>
          {SEARCH_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tabItem, isActive && styles.tabItemActive]}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

      {showResults ? (
        isSearching ? (
          <View style={styles.centered}>
            <ActivityIndicator color="#076F32" />
          </View>
        ) : (
          <FlatList
            data={listData}
            keyExtractor={(item) => item.key}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.nestedScrollPaddingBottom },
            ]}
            ListEmptyComponent={
              emptyText ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyIcon}>🔍</Text>
                  <Text style={styles.emptyTitle}>{emptyText}</Text>
                </View>
              ) : null
            }
            renderItem={({ item }) =>
              item.type === 'product' ? (
                <ProductResultRow product={item.data} onPress={onOpenProduct} />
              ) : (
                <ShopResultRow shop={item.data} onPress={onOpenShop} />
              )
            }
          />
        )
      ) : !trimmedQuery ? (
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Tìm kiếm gần đây</Text>
            {history.length > 0 ? (
              <Pressable onPress={handleClearHistory} hitSlop={8}>
                <Text style={styles.panelAction}>Xóa tất cả</Text>
              </Pressable>
            ) : null}
          </View>
          {history.length === 0 ? (
            <Text style={styles.panelEmpty}>Chưa có lịch sử tìm kiếm.</Text>
          ) : (
            history.map((keyword) => (
              <HistoryRow
                key={keyword}
                keyword={keyword}
                onPress={runSearch}
                onRemove={handleRemoveHistory}
              />
            ))
          )}
        </View>
      ) : (
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Gợi ý</Text>
            {isSuggesting ? <ActivityIndicator size="small" color="#076F32" /> : null}
          </View>
          {!locationReady ? (
            <Text style={styles.panelEmpty}>Bật vị trí để xem gợi ý quanh bạn.</Text>
          ) : suggestions.length === 0 && !isSuggesting ? (
            <Text style={styles.panelEmpty}>Không có gợi ý phù hợp.</Text>
          ) : (
            suggestions.map((item) => (
              <SuggestionRow key={item.id} item={item} onPress={handleSuggestionPress} />
            ))
          )}
          {trimmedQuery ? (
            <Pressable
              style={({ pressed }) => [styles.searchAllBtn, pressed && styles.pressed]}
              onPress={() => runSearch(trimmedQuery)}
            >
              <Ionicons name="search" size={16} color="#076F32" />
              <Text style={styles.searchAllText} numberOfLines={1}>
                Tìm “{trimmedQuery}”
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
  },
  headerRoundBtn: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
  },
  searchBarWrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: '#ffffff',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
  },
  tabItem: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  tabItemActive: {
    backgroundColor: '#E6F4EC',
  },
  tabText: {
    fontWeight: '700',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#076F32',
  },
  errorText: {
    marginHorizontal: 16,
    marginTop: 10,
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    minHeight: 24,
  },
  panelTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  panelAction: {
    fontSize: 13,
    fontWeight: '700',
    color: '#076F32',
  },
  panelEmpty: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    paddingVertical: 16,
  },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  suggestBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  suggestText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  suggestSubText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  suggestDistance: {
    fontSize: 11,
    fontWeight: '700',
    color: '#076F32',
  },
  searchAllBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  searchAllText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#076F32',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    marginBottom: 10,
  },
  resultThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  resultThumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultEmoji: {
    fontSize: 22,
  },
  resultBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  resultPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#dc2626',
  },
  resultOriginalPrice: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  resultMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resultMetaText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  resultDistance: {
    marginLeft: 'auto',
    fontSize: 11,
    fontWeight: '700',
    color: '#076F32',
  },
  openDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  openDotClosed: {
    backgroundColor: '#94a3b8',
  },
  openText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#076F32',
  },
  openTextClosed: {
    color: '#64748b',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748b',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
});
