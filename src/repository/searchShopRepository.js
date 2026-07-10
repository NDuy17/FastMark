import { createLogger } from '../core/utils/logger';
import { fetchSearchShopsFromNode, hasStoreNodeApi } from '../api/storeNodeApi';
import { normalizeStore } from '../model/storeModel';

const log = createLogger('SearchShopRepository');

export async function searchRegisteredShops({
  latitude,
  longitude,
  radiusMeters = 2000,
  shopQuery = '',
  shopCategoryId = '',
  productCategoryId = '',
  productQuery = '',
  limit = 50,
}) {
  if (!hasStoreNodeApi()) {
    return { shops: [], count: 0, radiusMeters };
  }

  try {
    const result = await fetchSearchShopsFromNode({
      latitude,
      longitude,
      radiusMeters,
      shopQuery,
      shopCategoryId,
      productCategoryId,
      productQuery,
      limit,
    });

    log.ok('searchRegisteredShops', {
      count: result.count,
      radiusMeters: result.radiusMeters,
    });

    return {
      shops: result.shops.map((shop) => ({
        ...normalizeStore(shop),
        matched_products: shop.matched_products || [],
      })),
      count: result.count,
      radiusMeters: result.radiusMeters,
    };
  } catch (error) {
    log.fail('searchRegisteredShops:failed', error);
    throw error;
  }
}
