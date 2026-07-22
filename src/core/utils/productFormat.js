export function formatPrice(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

function formatCompactAmount(value) {
  const amount = Number(value) || 0;
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1).replace('.0', '')}tr`;
  }
  if (amount >= 1000) {
    return `${Math.round(amount / 1000)}k`;
  }
  return String(amount);
}

export function formatPriceRange(minPrice, maxPrice) {
  const min = Number(minPrice) || 0;
  const max = Number(maxPrice) || 0;

  if (min === max) {
    return formatPrice(min);
  }

  return `${formatPrice(min)} - ${formatPrice(max)}`;
}

export function formatPriceRangeCompact(minPrice, maxPrice) {
  const min = Number(minPrice) || 0;
  const max = Number(maxPrice) || 0;

  if (min === max) {
    return `${formatCompactAmount(min)}đ`;
  }

  return `${formatCompactAmount(min)}-${formatCompactAmount(max)}đ`;
}

function computeDiscountedAmount(basePrice, discountPercent) {
  const base = Number(basePrice) || 0;
  const percent = Math.max(0, Math.min(100, Number(discountPercent) || 0));
  if (base <= 0 || percent <= 0) {
    return null;
  }
  if (percent >= 100) {
    return 0;
  }
  return Math.max(0, Math.round(base * (1 - percent / 100)));
}

/**
 * Label giá KM cho card: khoảng giá gốc (gạch) + khoảng giá sau % giảm.
 */
export function getProductPromoPriceLabels(product) {
  const min = Number(product?.minPrice ?? product?.originalPrice ?? product?.price) || 0;
  const max = Number(product?.maxPrice ?? product?.originalMaxPrice ?? min) || min;
  const percent = Number(product?.discountPercent) || 0;
  const promoMin =
    product?.promotionMinPrice != null
      ? Number(product.promotionMinPrice)
      : computeDiscountedAmount(min, percent);
  const promoMax =
    product?.promotionMaxPrice != null
      ? Number(product.promotionMaxPrice)
      : computeDiscountedAmount(max, percent);

  return {
    originalLabel: formatPriceRange(min, max),
    saleLabel:
      promoMin == null
        ? formatPriceRange(min, max)
        : formatPriceRange(promoMin, promoMax == null ? promoMin : promoMax),
  };
}

/** Đơn giá sau khuyến mãi (áp % giảm lên giá biến thể). */
export function getPromotionalUnitPrice(product, variantPrice) {
  const base = Number(variantPrice) || 0;
  if (!product?.isPromotion || base <= 0) {
    return base;
  }
  const percent = Number(product.discountPercent) || 0;
  if (percent > 0) {
    return Math.max(0, Math.round(base * (1 - percent / 100)));
  }
  return base;
}
