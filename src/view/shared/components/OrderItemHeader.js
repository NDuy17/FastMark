import { Image, StyleSheet, Text, View } from 'react-native';

import { formatOrderCode } from '../../../core/utils/orderCode';

/**
 * Shared order list card header (buyer + seller):
 * ID · status
 * [image] product name
 *         variant name
 *         unit price · x qty · line total (seller priceRowMeta)
 *         variant | price | qty (default)
 * party / totals / extra lines below via children or props
 */
export default function OrderItemHeader({
  id,
  statusLabel,
  statusBadgeStyle,
  statusTextStyle,
  statusTrailing = null,
  thumbnail = '',
  productName = 'Sản phẩm',
  variantName = '',
  quantity = 0,
  unitPriceText = '',
  partyLine = '',
  hideVariant = false,
  priceRowMeta = false,
  lineTotalText = '',
  orderCodeStyle,
  unitPriceStyle,
  children = null,
}) {
  const name = productName || 'Sản phẩm';
  const detailParts = [
    hideVariant ? '' : variantName,
    unitPriceText,
    quantity ? `SL: ${quantity}` : '',
  ].filter(Boolean);
  const detailLine = detailParts.join('  |  ');

  return (
    <>
      <View style={styles.idRow}>
        <Text style={[styles.orderCode, orderCodeStyle]}>{formatOrderCode(id)}</Text>
        {statusLabel || statusTrailing ? (
          <View style={styles.statusGroup}>
            {statusLabel ? (
              <View style={[styles.statusBadge, statusBadgeStyle]}>
                <Text style={[styles.statusBadgeText, statusTextStyle]}>{statusLabel}</Text>
              </View>
            ) : null}
            {statusTrailing}
          </View>
        ) : null}
      </View>

      <View style={styles.productRow}>
        {thumbnail ? (
          <Image source={{ uri: thumbnail }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback]}>
            <Text style={styles.thumbFallbackText}>{name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.productInfo}>
          <Text style={styles.productTitle} numberOfLines={2}>
            {name}
          </Text>
          {priceRowMeta ? (
            <>
              {variantName ? (
                <Text style={styles.variantLine} numberOfLines={1}>
                  {variantName}
                </Text>
              ) : null}
              <View style={styles.priceRow}>
                {unitPriceText ? (
                  <Text style={[styles.unitPrice, unitPriceStyle]} numberOfLines={1}>
                    {unitPriceText}
                  </Text>
                ) : null}
                {quantity ? (
                  <Text style={styles.qtyMark} numberOfLines={1}>
                    x{quantity}
                  </Text>
                ) : null}
                <Text style={styles.lineTotal} numberOfLines={1}>
                  {lineTotalText || unitPriceText}
                </Text>
              </View>
            </>
          ) : detailLine ? (
            <Text style={styles.detailLine} numberOfLines={2}>
              {detailLine}
            </Text>
          ) : null}
        </View>
      </View>

      {partyLine ? (
        <Text style={styles.partyLine} numberOfLines={1}>
          {partyLine}
        </Text>
      ) : null}

      {children}
    </>
  );
}

const styles = StyleSheet.create({
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  orderCode: {
    color: '#076F32',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#076F32',
  },
  thumbFallbackText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
  },
  productInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    paddingTop: 2,
  },
  productTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  variantLine: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 16,
  },
  detailLine: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 10,
  },
  unitPrice: {
    color: '#076F32',
    fontSize: 14,
    fontWeight: '800',
  },
  qtyMark: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '600',
  },
  lineTotal: {
    flex: 1,
    textAlign: 'right',
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
  },
  partyLine: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
});
