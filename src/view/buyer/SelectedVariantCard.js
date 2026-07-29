import { Image, StyleSheet, Text, View } from 'react-native';

import { formatPrice } from '../../core/utils/productFormat';

function getVariantThumb(variant, productThumbnail = '') {
  const firstImage = (variant?.images || []).find((image) => image?.imageUrl);
  return firstImage?.imageUrl || productThumbnail || '';
}

export default function SelectedVariantCard({
  variant,
  productThumbnail = '',
  label = 'Phân loại đã chọn',
  priceOverride = null,
  hideStock = false,
  quantity = null,
  attachBottom = false,
  embedded = false,
}) {
  if (!variant) {
    return null;
  }

  const thumb = getVariantThumb(variant, productThumbnail);
  const remaining = Math.max(0, Number(variant.quantity) || 0);
  const sold = Math.max(0, Number(variant.soldCount) || 0);
  const displayPrice =
    priceOverride != null && Number.isFinite(Number(priceOverride))
      ? Number(priceOverride)
      : Number(variant.price) || 0;
  const showQuantity = quantity != null && Number(quantity) > 0;

  return (
    <View
      style={[
        styles.box,
        attachBottom && styles.boxAttachBottom,
        embedded && styles.boxEmbedded,
      ]}
    >
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        <View style={styles.thumbWrap}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={styles.thumb} />
          ) : (
            <Text style={styles.thumbEmoji}>📦</Text>
          )}
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>
            {variant.variantName || variant.name || 'Loại'}
          </Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPrice(displayPrice)}</Text>
            {showQuantity ? <Text style={styles.qtyMul}>× {quantity}</Text> : null}
          </View>
          {hideStock ? null : (
            <Text style={styles.meta}>
              Còn lại: {remaining > 0 ? remaining : 'Hết'} · Đã bán: {sold}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderColor: '#A7D9B8',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#E6F4EC',
    marginBottom: 0,
  },
  boxAttachBottom: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  boxEmbedded: {
    borderWidth: 0,
    borderRadius: 0,
    padding: 0,
    backgroundColor: 'transparent',
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#076F32',
    marginBottom: 8,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  thumbWrap: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  thumbEmoji: {
    fontSize: 24,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 18,
  },
  price: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  qtyMul: {
    fontSize: 14,
    fontWeight: '800',
    color: '#475569',
  },
  meta: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    lineHeight: 16,
  },
});
