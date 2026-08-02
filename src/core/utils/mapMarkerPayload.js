/** Minimal, stable shop payload for Leaflet map markers (avoids GPS-driven re-renders). */
export function buildMapMarkerPayload(shops = []) {
  if (!Array.isArray(shops) || shops.length === 0) {
    return [];
  }

  return shops.map((shop) => ({
    id: shop.id,
    latitude: shop.latitude,
    longitude: shop.longitude,
    name: shop.shop_name || shop.name || 'Gian hàng',
    shop_name: shop.shop_name || shop.name || 'Gian hàng',
    rating_avg: shop.rating_avg ?? shop.averageRating ?? 0,
    is_open: shop.is_open,
    address: shop.address || shop.user_address || '',
    distance_meters: shop.distance_meters ?? shop.distanceMeters ?? null,
  }));
}

/** Signature for deduping WebView marker updates. */
export function buildMapRestaurantsSignature(restaurants = []) {
  if (!Array.isArray(restaurants) || restaurants.length === 0) {
    return '';
  }

  return restaurants
    .map(
      (item) =>
        `${String(item.id)}:${Number(item.latitude).toFixed(5)},${Number(item.longitude).toFixed(5)}`
    )
    .sort()
    .join('|');
}
