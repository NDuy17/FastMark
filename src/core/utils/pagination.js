export const DEFAULT_PAGE_SIZE = 20;

export function emptyPageResult({ page = 1, limit = DEFAULT_PAGE_SIZE } = {}) {
  return {
    items: [],
    page: Math.max(1, Number(page) || 1),
    limit: Math.max(1, Number(limit) || DEFAULT_PAGE_SIZE),
    total: 0,
    totalPages: 1,
    hasMore: false,
  };
}

export function normalizePageResult(payload = {}, itemKey = 'items') {
  const items =
    payload?.[itemKey] ||
    payload?.items ||
    payload?.products ||
    payload?.shops ||
    [];
  const page = Math.max(1, Number(payload?.page) || 1);
  const limit = Math.max(1, Number(payload?.limit) || DEFAULT_PAGE_SIZE);
  const total = Math.max(
    0,
    Number(payload?.total != null ? payload.total : items.length) || 0
  );
  const totalPages = Math.max(
    1,
    Number(payload?.totalPages) || Math.ceil(total / limit) || 1
  );
  const hasMore =
    typeof payload?.hasMore === 'boolean'
      ? payload.hasMore
      : page * limit < total;

  return {
    items: Array.isArray(items) ? items : [],
    page,
    limit,
    total,
    totalPages,
    hasMore,
  };
}

export function appendUniqueById(existing = [], incoming = []) {
  const map = new Map();
  [...existing, ...incoming].forEach((item) => {
    const id = String(item?.id || item?._id || '');
    if (!id) {
      return;
    }
    if (!map.has(id)) {
      map.set(id, item);
    }
  });
  return Array.from(map.values());
}
