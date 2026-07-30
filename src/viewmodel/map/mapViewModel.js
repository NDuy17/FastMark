import { fetchNearbyRegisteredShops } from '../../repository/nearbyShopRepository';
import { searchAddresses, reverseGeocode } from '../../repository/geocodingRepository';

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

export async function searchMapAddresses(query, options) {
  return searchAddresses(query, options);
}

export async function reverseGeocodeLocation(latitude, longitude) {
  return reverseGeocode(latitude, longitude);
}
