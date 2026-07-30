import { fetchProductById, fetchProductsByStoreId } from '../../repository/productRepository';
import { fetchReviewsByStoreId } from '../../repository/reviewRepository';
import { fetchStoreById } from '../../repository/storeRepository';

export async function loadStoreById(storeId, originLocation = null) {
  return fetchStoreById(storeId, originLocation);
}

export async function loadProductsByStoreId(storeId, options = {}) {
  return fetchProductsByStoreId(storeId, options);
}

export async function loadProductById(productId) {
  return fetchProductById(productId);
}

export async function loadReviewsByStoreId(storeId, options = {}) {
  return fetchReviewsByStoreId(storeId, options);
}
