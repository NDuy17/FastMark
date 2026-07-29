import { formatMoney } from '../../utils/format';

function hasActivePromotion(item) {
  return Boolean(item?.isPromotion) && Number(item?.discountPercent) > 0;
}

export function ProductOriginalPriceCell({ item }) {
  return <ProductPriceStack item={item} />;
}

export function ProductDiscountCell({ item }) {
  if (!hasActivePromotion(item)) {
    return <span className="muted">—</span>;
  }
  return (
    <span className="badge badge-warning history-product-discount">
      {item.discountLabel || `−${item.discountPercent}%`}
    </span>
  );
}

export function ProductSalePriceCell({ item }) {
  if (!hasActivePromotion(item)) {
    return <span className="muted">—</span>;
  }
  return (
    <span className="product-price-current">
      {item.promotionPriceLabel || formatMoney(item.promotionMinPrice ?? item.minPrice)}
    </span>
  );
}

export function ProductPriceStack({ item }) {
  const label = item?.priceLabel || formatMoney(item?.minPrice);
  if (!hasActivePromotion(item)) {
    return (
      <div className="product-price-cell">
        <span className="product-price-current">{label}</span>
      </div>
    );
  }

  return (
    <div className="product-price-cell">
      <span className="product-price-original">{label}</span>
      <span className="product-price-current">
        {item.promotionPriceLabel || formatMoney(item.promotionMinPrice ?? item.minPrice)}
      </span>
    </div>
  );
}
