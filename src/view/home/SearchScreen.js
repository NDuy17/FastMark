import { useEffect, useMemo, useRef, useState } from 'react';
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

import { discoverProductsOnBackend, listPromotionProductsOnBackend } from '../../api/productApi';
import { fetchSearchShopsFromNode } from '../../api/storeNodeApi';
import { normalizeProduct } from '../../model/productModel';
import { formatPriceRange, getProductPromoPriceLabels } from '../../core/utils/productFormat';
import { formatDistance, hasValidLocation } from '../../core/utils/geo';
import { isRemoteAvatarUrl } from '../../core/utils/avatarInitial';
import AvatarBadge from '../shared/components/AvatarBadge';
import ClearableSearchField from '../shared/components/ClearableSearchField';
import CircularBackButton from '../shared/components/CircularBackButton';
import { useScreenInsets } from '../../hooks/useScreenInsets';

const SEARCH_TABS = [
  { key: 'products', label: 'Sản phẩm' },
  { key: 'users', label: 'Người dùng' },
];

const SEARCH_DEBOUNCE_MS = 400;

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
  const distance = formatDistance(shop.distance_meters);
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

export default function SearchScreen({ currentLocation, onBack, onOpenProduct, onOpenShop }) {
  const insets = useScreenInsets();
  const requestIdRef = useRef(0);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [shops, setShops] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const locationReady = hasValidLocation(currentLocation);
  const trimmedQuery = query.trim();

  useEffect(() => {
    const keyword = trimmedQuery;
    if (!keyword) {
      requestIdRef.current += 1;
      setProducts([]);
      setShops([]);
      setIsSearching(false);
      setErrorText('');
      setHasSearched(false);
      return undefined;
    }

    if (!locationReady) {
      setErrorText('Bật vị trí để tìm kiếm quanh bạn.');
      return undefined;
    }

    const requestId = ++requestIdRef.current;
    setIsSearching(true);
    setErrorText('');

    const timer = setTimeout(async () => {
      try {
        if (activeTab === 'products') {
          const [rows, promoRows] = await Promise.all([
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
          ]);
          if (requestIdRef.current !== requestId) return;
          const promoById = new Map();
          (Array.isArray(promoRows) ? promoRows : []).forEach((row) => {
            const promo = normalizeProduct(row);
            if (promo.id && promo.isPromotion && Number(promo.discountPercent) > 0) {
              promoById.set(promo.id, promo);
            }
          });
          setProducts(
            (Array.isArray(rows) ? rows : []).map((row) => {
              const product = normalizeProduct(row);
              const promo = promoById.get(product.id);
              if (!promo) return product;
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
            })
          );
        } else {
          const { shops: shopRows } = await fetchSearchShopsFromNode({
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            radiusMeters: 0,
            shopQuery: keyword,
            identityOnly: true,
            limit: 50,
          });
          if (requestIdRef.current !== requestId) return;
          setShops(Array.isArray(shopRows) ? shopRows : []);
        }
        if (requestIdRef.current === requestId) {
          setHasSearched(true);
        }
      } catch (error) {
        if (requestIdRef.current === requestId) {
          setErrorText(error.message || 'Không tìm kiếm được. Vui lòng thử lại.');
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setIsSearching(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [trimmedQuery, activeTab, locationReady, currentLocation?.latitude, currentLocation?.longitude]);

  const emptyText = useMemo(() => {
    if (!trimmedQuery) {
      return activeTab === 'products'
        ? 'Nhập tên sản phẩm để tìm kiếm.'
        : 'Nhập tên hoặc @username người bán để tìm kiếm.';
    }
    if (!hasSearched || isSearching) {
      return '';
    }
    return activeTab === 'products'
      ? `Không tìm thấy sản phẩm cho "${trimmedQuery}".`
      : `Không tìm thấy người dùng cho "${trimmedQuery}".`;
  }, [trimmedQuery, activeTab, hasSearched, isSearching]);

  const listData = activeTab === 'products' ? products : shops;

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
          onChangeText={setQuery}
          placeholder={
            activeTab === 'products' ? 'Tìm sản phẩm...' : 'Tìm người dùng, gian hàng...'
          }
          autoFocus
        />
      </View>

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

      {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

      {isSearching ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#076F32" />
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => String(item.id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.nestedScrollPaddingBottom },
          ]}
          ListEmptyComponent={
            emptyText ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>{activeTab === 'products' ? '🔍' : '👤'}</Text>
                <Text style={styles.emptyTitle}>{emptyText}</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) =>
            activeTab === 'products' ? (
              <ProductResultRow product={item} onPress={onOpenProduct} />
            ) : (
              <ShopResultRow shop={item} onPress={onOpenShop} />
            )
          }
        />
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
