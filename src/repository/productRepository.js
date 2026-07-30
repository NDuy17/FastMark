import { createLogger } from '../core/utils/logger';
import {
  fetchProductFromNode,
  fetchProductsFromNode,
  hasStoreNodeApi,
} from '../api/storeNodeApi';
import { normalizeProduct } from '../model/productModel';

const log = createLogger('ProductRepository');

export async function fetchProductsByStoreId(storeId, { page = 1, limit = 20 } = {}) {
  log.info('fetchProductsByStoreId:start', { storeId, page, limit });

  if (!hasStoreNodeApi()) {
    log.warn('fetchProductsByStoreId:no-api', { storeId });
    return { items: [], page, limit, total: 0, hasMore: false };
  }

  try {
    const productsPage = await fetchProductsFromNode(storeId, { page, limit });
    const products = productsPage.items || [];
    log.ok('fetchProductsByStoreId:node-api', { storeId, count: products.length });
    return {
      ...productsPage,
      items: products.map(normalizeProduct),
    };
  } catch (error) {
    log.warn('fetchProductsByStoreId:node-api-failed', error?.message || error);
    return { items: [], page, limit, total: 0, hasMore: false };
  }
}

export async function fetchProductById(productId) {
  log.info('fetchProductById:start', { productId });

  if (!hasStoreNodeApi()) {
    log.warn('fetchProductById:no-api', { productId });
    return null;
  }

  try {
    const product = await fetchProductFromNode(productId);
    if (product) {
      log.ok('fetchProductById:node-api', { productId });
      return normalizeProduct(product);
    }
    log.warn('fetchProductById:node-api-not-found', { productId });
  } catch (error) {
    log.fail('fetchProductById:node-api-failed', error);
  }

  return null;
}
