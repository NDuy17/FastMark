import { createLogger } from '../core/utils/logger';
import { fetchReviewsFromNode, hasStoreNodeApi } from '../api/storeNodeApi';
import { normalizeReview } from '../model/reviewModel';

const log = createLogger('ReviewRepository');

export async function fetchReviewsByStoreId(storeId, { page = 1, limit = 20 } = {}) {
  log.info('fetchReviewsByStoreId:start', { storeId, page, limit });

  if (!hasStoreNodeApi()) {
    log.warn('fetchReviewsByStoreId:no-api', { storeId });
    return { items: [], page, limit, total: 0, hasMore: false };
  }

  try {
    const reviewsPage = await fetchReviewsFromNode(storeId, { page, limit });
    const reviews = reviewsPage.items || [];
    log.ok('fetchReviewsByStoreId:node-api', { storeId, count: reviews.length });
    return {
      ...reviewsPage,
      items: reviews.map(normalizeReview),
    };
  } catch (error) {
    log.warn('fetchReviewsByStoreId:node-api-failed', error?.message || error);
    return { items: [], page, limit, total: 0, hasMore: false };
  }
}
