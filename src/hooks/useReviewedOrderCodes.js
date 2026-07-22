import { useCallback, useEffect, useState } from 'react';

import { getMyReviewsOnBackend } from '../api/reviewApi';
import { getCurrentUserIdToken } from '../repository/authRepository';

const sessionReviewedOrderCodes = new Set();
const sessionReviewsByOrderId = new Map();

export function getOrderReviewKey(order) {
  return String(order?.orderCode || order?.reservationId || order?.id || '').trim();
}

function rememberReview(key, review) {
  if (!key || !review) {
    return;
  }
  sessionReviewsByOrderId.set(key, review);
}

export async function loadReviewedOrderData() {
  const codes = new Set(sessionReviewedOrderCodes);
  const reviewsByOrderId = new Map(sessionReviewsByOrderId);

  try {
    const idToken = await getCurrentUserIdToken();
    if (idToken) {
      const reviews = await getMyReviewsOnBackend(idToken);
      (reviews || []).forEach((review) => {
        const key = String(review.reservationId || review.orderCode || '').trim();
        if (!key) {
          return;
        }
        codes.add(key);
        rememberReview(key, review);
        reviewsByOrderId.set(key, review);
      });
    }
  } catch {
    // Keep session-only data when API is unavailable.
  }

  return { codes, reviewsByOrderId };
}

export async function loadReviewedOrderCodes() {
  const { codes } = await loadReviewedOrderData();
  return codes;
}

export function markOrderAsReviewed(order, review = null) {
  const key = getOrderReviewKey(order);
  if (!key) {
    return;
  }
  sessionReviewedOrderCodes.add(key);
  if (review) {
    rememberReview(key, review);
  }
}

export function unmarkOrderAsReviewed(order) {
  const key = getOrderReviewKey(order);
  if (!key) {
    return;
  }
  sessionReviewedOrderCodes.delete(key);
  sessionReviewsByOrderId.delete(key);
}

export function getReviewForOrder(order, reviewsByOrderId) {
  const key = getOrderReviewKey(order);
  if (!key) {
    return null;
  }
  return reviewsByOrderId?.get?.(key) || sessionReviewsByOrderId.get(key) || null;
}

export function isOrderAlreadyReviewed(order, reviewedOrderCodes) {
  const key = getOrderReviewKey(order);
  return Boolean(key && reviewedOrderCodes?.has(key));
}

export function useReviewedOrderCodes(refreshKey = 0) {
  const [reviewedOrderCodes, setReviewedOrderCodes] = useState(new Set());
  const [reviewsByOrderId, setReviewsByOrderId] = useState(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setIsLoading(true);

    loadReviewedOrderData()
      .then(({ codes, reviewsByOrderId: nextMap }) => {
        if (!active) {
          return;
        }
        setReviewedOrderCodes(codes);
        setReviewsByOrderId(new Map(nextMap));
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  const markReviewed = useCallback((order, review = null) => {
    markOrderAsReviewed(order, review);
    const key = getOrderReviewKey(order);
    if (!key) {
      return;
    }
    setReviewedOrderCodes((current) => new Set([...current, key]));
    if (review) {
      setReviewsByOrderId((current) => {
        const next = new Map(current);
        next.set(key, review);
        return next;
      });
    }
  }, []);

  const unmarkReviewed = useCallback((order) => {
    unmarkOrderAsReviewed(order);
    const key = getOrderReviewKey(order);
    if (!key) {
      return;
    }
    setReviewedOrderCodes((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
    setReviewsByOrderId((current) => {
      const next = new Map(current);
      next.delete(key);
      return next;
    });
  }, []);

  return {
    reviewedOrderCodes,
    reviewsByOrderId,
    isLoading,
    markReviewed,
    unmarkReviewed,
  };
}
