import { createLogger } from '../core/utils/logger';
import { fetchSearchShopsFromNode, hasStoreNodeApi } from '../api/storeNodeApi';
import { normalizeStore } from '../model/storeModel';
import { emptyPageResult } from '../core/utils/pagination';

const log = createLogger('SearchShopRepository');

export async function searchRegisteredShops({
  latitude,
  longitude,
  radiusMeters = 2000,
  shopQuery = '',
  shopCategoryId = '',
  productCategoryId = '',
  productQuery = '',
  identityOnly = false,
  page = 1,
  limit = 20,
}) {
  if (!hasStoreNodeApi()) {
    return { ...emptyPageResult({ page, limit }), shops: [], count: 0, radiusMeters };
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
      identityOnly,
      page,
      limit,
    });

    const shops = (result.items || result.shops || []).map((shop) => ({
      ...normalizeStore(shop),
      matched_products: shop.matched_products || [],
    }));

    log.ok('searchRegisteredShops', {
      count: shops.length,
      page: result.page,
      hasMore: result.hasMore,
      radiusMeters: result.radiusMeters,
      identityOnly: Boolean(identityOnly),
    });

    return {
      ...result,
      items: shops,
      shops,
      count: result.count ?? shops.length,
      radiusMeters: result.radiusMeters,
    };
  } catch (error) {
    log.fail('searchRegisteredShops:failed', error);
    throw error;
  }
}
