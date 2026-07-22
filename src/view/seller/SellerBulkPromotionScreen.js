import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  bulkSetProductPromotionsOnBackend,
  getMyProductsOnBackend,
  listMyPromotionProductsOnBackend,
} from '../../api/productApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { formatPrice, getProductPromoPriceLabels } from '../../core/utils/productFormat';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import ClearableSearchField from '../shared/components/ClearableSearchField';
import DatePickerField from '../shared/components/DatePickerField';
import SubScreenHeader from '../shared/components/SubScreenHeader';

function toDateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Giảm giá hàng loạt + danh sách sản phẩm đang giảm giá.
 * Cập nhật thẳng field Product (DiscountPercent / ngày), không tạo collection mới.
 */
export default function SellerBulkPromotionScreen({ onBack, onChanged, initialTab = 'bulk' }) {
  const insets = useScreenInsets();
  const [tab, setTab] = useState(initialTab === 'active' ? 'active' : 'bulk'); // bulk | active
  const [products, setProducts] = useState([]);
  const [activePromos, setActivePromos] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [search, setSearch] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [startDate, setStartDate] = useState(todayInput());
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        throw new Error('Phiên đăng nhập đã hết hạn.');
      }
      const [mine, promos] = await Promise.all([
        getMyProductsOnBackend(idToken),
        listMyPromotionProductsOnBackend(idToken),
      ]);
      setProducts(
        (mine || []).map((row) => ({
          id: String(row.id),
          name: row.productName || row.name || 'Sản phẩm',
          thumbnail: row.thumbnail || '',
          minPrice: Number(row.minPrice ?? row.price ?? 0),
          isPromotion: Boolean(row.isPromotion),
          discountPercent: Number(row.discountPercent) || 0,
          promotionEndDate: row.promotionEndDate || null,
        }))
      );
      setActivePromos(promos || []);
    } catch (loadError) {
      setError(loadError.message || 'Không tải được danh sách sản phẩm.');
      setProducts([]);
      setActivePromos([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectableProducts = useMemo(
    () => products.filter((item) => !item.isPromotion),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return selectableProducts;
    return selectableProducts.filter((item) =>
      String(item.name || '').toLowerCase().includes(keyword)
    );
  }, [selectableProducts, search]);

  useEffect(() => {
    // Bỏ chọn các SP đã có giảm giá (không còn trong list chọn).
    setSelectedIds((current) => {
      if (!current.size) return current;
      const selectableIds = new Set(selectableProducts.map((item) => item.id));
      const next = new Set([...current].filter((id) => selectableIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [selectableProducts]);

  function toggleSelect(id) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(filteredProducts.map((item) => item.id)));
  }

  async function handleApply() {
    setError('');
    setSuccess('');
    const percent = Math.round(Number(discountPercent) || 0);
    if (percent < 1 || percent > 99) {
      setError('Phần trăm giảm giá phải từ 1 đến 99.');
      return;
    }
    if (!selectedIds.size) {
      setError('Vui lòng chọn ít nhất một sản phẩm.');
      return;
    }
    if (endDate && startDate && new Date(endDate) < new Date(startDate)) {
      setError('Ngày kết thúc phải sau ngày bắt đầu.');
      return;
    }

    setIsSubmitting(true);
    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        throw new Error('Phiên đăng nhập đã hết hạn.');
      }
      const result = await bulkSetProductPromotionsOnBackend({
        idToken,
        productIds: [...selectedIds],
        discountPercent: percent,
        promotionStartDate: startDate || undefined,
        promotionEndDate: endDate || undefined,
      });
      setSuccess(`Đã giảm ${percent}% cho ${result.updatedCount || 0} sản phẩm.`);
      setSelectedIds(new Set());
      onChanged?.();
      await loadData();
      setTab('active');
    } catch (submitError) {
      setError(submitError.message || 'Không áp dụng được giảm giá hàng loạt.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <SubScreenHeader title="Giảm giá hàng loạt" onBack={onBack} />

      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, tab === 'bulk' && styles.tabActive]}
          onPress={() => setTab('bulk')}
        >
          <Text style={[styles.tabText, tab === 'bulk' && styles.tabTextActive]}>
            Chọn giảm giá
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'active' && styles.tabActive]}
          onPress={() => setTab('active')}
        >
          <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>
            Đang giảm giá ({activePromos.length})
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#076F32" size="large" />
        </View>
      ) : tab === 'active' ? (
        <FlatList
          data={activePromos}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.nestedScrollPaddingBottom },
          ]}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Chưa có sản phẩm đang giảm giá</Text>
              <Text style={styles.emptyBody}>
                Chuyển tab “Chọn giảm giá” để áp dụng % cho nhiều sản phẩm.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const discountPercent = Number(item.discountPercent) || 0;
            const { originalLabel, saleLabel } = getProductPromoPriceLabels({
              minPrice: item.originalPrice ?? item.minPrice,
              maxPrice: item.originalMaxPrice ?? item.maxPrice,
              discountPercent,
              promotionMinPrice: item.promotionMinPrice ?? item.promotionPrice,
              promotionMaxPrice: item.promotionMaxPrice,
              isPromotion: true,
            });

            return (
              <View style={styles.productRow}>
                {item.thumbnail ? (
                  <Image source={{ uri: item.thumbnail }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <Text>🛒</Text>
                  </View>
                )}
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={2}>
                    {item.productName || item.name}
                  </Text>
                  <View style={styles.promoPriceRow}>
                    <Text style={styles.originalPrice}>{originalLabel}</Text>
                    {discountPercent > 0 ? (
                      <Text style={styles.discountBadge}>−{discountPercent}%</Text>
                    ) : null}
                  </View>
                  <Text style={styles.salePrice}>{saleLabel}</Text>
                  {item.promotionEndDate ? (
                    <Text style={styles.dateMeta}>
                      Đến {toDateInput(item.promotionEndDate)}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      ) : (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Thiết lập giảm giá</Text>
              <Text style={styles.label}>Phần trăm giảm (%)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={discountPercent}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^\d]/g, '');
                  setDiscountPercent(
                    cleaned === '' ? '' : String(Math.min(99, Number(cleaned) || 0))
                  );
                }}
                placeholder="VD: 20"
                placeholderTextColor="#94a3b8"
                maxLength={2}
              />
              <DatePickerField
                label="Ngày bắt đầu"
                value={startDate}
                onChange={setStartDate}
                valueFormat="iso"
              />
              <View style={styles.dateSpacer} />
              <DatePickerField
                label="Ngày kết thúc"
                value={endDate}
                onChange={setEndDate}
                valueFormat="iso"
                placeholder="Không giới hạn"
                minimumDate={startDate ? new Date(`${startDate}T00:00:00`) : undefined}
              />
              <Text style={styles.selectedCount}>
                Đã chọn {selectedIds.size} / {filteredProducts.length} sản phẩm
              </Text>
            </View>

            <ClearableSearchField
              value={search}
              onChangeText={setSearch}
              placeholder="Tìm sản phẩm..."
            />

            <Pressable style={styles.selectAllBtn} onPress={toggleSelectAll}>
              <Ionicons
                name={
                  selectedIds.size === filteredProducts.length && filteredProducts.length > 0
                    ? 'checkbox'
                    : 'square-outline'
                }
                size={20}
                color="#076F32"
              />
              <Text style={styles.selectAllText}>
                {selectedIds.size === filteredProducts.length && filteredProducts.length > 0
                  ? 'Bỏ chọn tất cả'
                  : 'Chọn tất cả'}
              </Text>
            </Pressable>

            {filteredProducts.map((item) => {
              const selected = selectedIds.has(item.id);
              return (
                <Pressable
                  key={item.id}
                  style={[styles.productRow, selected && styles.productRowSelected]}
                  onPress={() => toggleSelect(item.id)}
                >
                  <Ionicons
                    name={selected ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={selected ? '#076F32' : '#94a3b8'}
                  />
                  {item.thumbnail ? (
                    <Image source={{ uri: item.thumbnail }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbPlaceholder]}>
                      <Text>🛒</Text>
                    </View>
                  )}
                  <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={styles.priceMeta}>{formatPrice(item.minPrice)}</Text>
                  </View>
                </Pressable>
              );
            })}

            {filteredProducts.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Không còn sản phẩm để chọn</Text>
                <Text style={styles.emptyBody}>
                  Sản phẩm đang giảm giá nằm ở tab “Đang giảm giá”.
                </Text>
              </View>
            ) : null}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {success ? <Text style={styles.successText}>{success}</Text> : null}
          </ScrollView>

          <View
            style={[
              styles.applyFooter,
              { paddingBottom: Math.max(insets.bottomSpacing, 12) + 8 },
            ]}
          >
            <Pressable
              style={[styles.applyBtn, isSubmitting && styles.applyBtnDisabled]}
              disabled={isSubmitting}
              onPress={handleApply}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.applyBtnText}>Áp dụng giảm giá</Text>
              )}
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f1f5f9' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#076F32' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  tabTextActive: { color: '#076F32' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 24, gap: 10 },
  applyFooter: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 4,
  },
  dateSpacer: {
    height: 8,
  },
  formTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  label: {
    marginTop: 8,
    marginBottom: 4,
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
  },
  selectedCount: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '700',
    color: '#076F32',
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  selectAllText: { fontWeight: '700', color: '#0f172a' },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  productRowSelected: {
    borderColor: '#076F32',
    backgroundColor: '#f0fdf4',
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
  },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  productInfo: { flex: 1, minWidth: 0 },
  productName: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  priceMeta: { marginTop: 2, fontSize: 13, fontWeight: '700', color: '#076F32' },
  promoPriceRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  originalPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  discountBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: '#b45309',
  },
  salePrice: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: '800',
    color: '#076F32',
  },
  dateMeta: { marginTop: 2, fontSize: 11, color: '#64748b' },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  emptyBody: { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 18 },
  errorText: { color: '#b91c1c', fontWeight: '700', marginTop: 8 },
  successText: { color: '#076F32', fontWeight: '700', marginTop: 8 },
  applyBtn: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#076F32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnDisabled: { opacity: 0.7 },
  applyBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
});
