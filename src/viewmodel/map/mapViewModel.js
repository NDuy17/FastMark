import { fetchNearbyRegisteredShops } from '../../repository/nearbyShopRepository';
import { searchAddresses, reverseGeocode } from '../../repository/geocodingRepository';
import { appendUniqueById } from '../../core/utils/pagination';

const MAP_MARKER_PAGE_SIZE_ALL = 100;
const MAP_MARKER_PAGE_SIZE_CATEGORY = 200;
const MAP_MARKER_SAFETY_CAP = 5000;

export async function loadNearbyRegisteredShops({
  latitude,
  longitude,
  radiusMeters,
  shopCategoryId = '',
  page = 1,
  limit = 20,
  seed = '',
}) {
  return fetchNearbyRegisteredShops({
    latitude,
    longitude,
    radiusMeters,
    shopCategoryId,
    page,
    limit,
    seed,
  });
}

/** Load every shop in scan radius for map markers (paginated server-side). */
export async function loadAllNearbyShopsForMap({
  latitude,
  longitude,
  radiusMeters,
  shopCategoryId = '',
  pageSize,
  maxShops = MAP_MARKER_SAFETY_CAP,
}) {
  const normalizedCategoryId = String(shopCategoryId || '').trim();
  const safePageSize =
    pageSize ||
    (normalizedCategoryId ? MAP_MARKER_PAGE_SIZE_CATEGORY : MAP_MARKER_PAGE_SIZE_ALL);

  let page = 1;
  let combined = [];
  let total = 0;
  let hasMore = true;

  while (hasMore && combined.length < maxShops) {
    const data = await loadNearbyRegisteredShops({
      latitude,
      longitude,
      radiusMeters,
      shopCategoryId: normalizedCategoryId,
      page,
      limit: safePageSize,
    });
    const rows = Array.isArray(data) ? data : data?.items || data?.shops || [];
    total = Math.max(0, Number(data?.total) || combined.length + rows.length);
    combined = appendUniqueById(combined, rows);
    hasMore =
      Boolean(data?.hasMore) &&
      combined.length < total &&
      combined.length < maxShops &&
      rows.length > 0;
    page += 1;
    if (!rows.length) {
      break;
    }
    if (total > 0 && combined.length >= total) {
      break;
    }
  }

  return combined;
}

export async function searchMapAddresses(query, options) {
  return searchAddresses(query, options);
}

export async function reverseGeocodeLocation(latitude, longitude) {
  return reverseGeocode(latitude, longitude);
}
