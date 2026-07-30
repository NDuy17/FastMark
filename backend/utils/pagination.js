const crypto = require("crypto");

/**
 * Chuẩn hóa page/limit cho API danh sách công khai.
 */
function parsePagination(query = {}, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || defaultLimit));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function buildPaginationMeta({ page, limit, total }) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Number(limit) || 20);
  const totalPages = Math.max(1, Math.ceil(safeTotal / safeLimit) || 1);
  return {
    page: safePage,
    limit: safeLimit,
    total: safeTotal,
    totalPages,
    hasMore: safePage * safeLimit < safeTotal,
  };
}

function slicePage(items = [], { page = 1, limit = 20 } = {}) {
  const list = Array.isArray(items) ? items : [];
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Number(limit) || 20);
  const start = (safePage - 1) * safeLimit;
  return {
    items: list.slice(start, start + safeLimit),
    ...buildPaginationMeta({ page: safePage, limit: safeLimit, total: list.length }),
  };
}

function normalizeRandomSeed(seed) {
  return String(seed || "").trim().slice(0, 128);
}

function seededOffset(seed, total, namespace = "") {
  const safeTotal = Math.max(0, Number(total) || 0);
  const normalizedSeed = normalizeRandomSeed(seed);
  if (!normalizedSeed || safeTotal <= 1) {
    return 0;
  }

  const digest = crypto
    .createHash("sha256")
    .update(`${namespace}:${normalizedSeed}`)
    .digest();
  return digest.readUInt32BE(0) % safeTotal;
}

/**
 * Phân trang theo một điểm bắt đầu ổn định từ seed.
 * Danh sách được xoay vòng nên các page trong cùng seed không trùng nhau.
 */
function sliceSeededPage(
  items = [],
  { page = 1, limit = 20, seed = "", namespace = "" } = {}
) {
  const list = Array.isArray(items) ? items : [];
  const { page: safePage, limit: safeLimit } = parsePagination({ page, limit });
  const total = list.length;
  const consumed = (safePage - 1) * safeLimit;

  if (!normalizeRandomSeed(seed) || consumed >= total || total === 0) {
    return {
      items: consumed >= total ? [] : list.slice(consumed, consumed + safeLimit),
      ...buildPaginationMeta({ page: safePage, limit: safeLimit, total }),
    };
  }

  const start = (seededOffset(seed, total, namespace) + consumed) % total;
  const take = Math.min(safeLimit, total - consumed);
  const first = list.slice(start, Math.min(total, start + take));
  const remaining = take - first.length;

  return {
    items: remaining > 0 ? first.concat(list.slice(0, remaining)) : first,
    ...buildPaginationMeta({ page: safePage, limit: safeLimit, total }),
  };
}

module.exports = {
  parsePagination,
  buildPaginationMeta,
  slicePage,
  normalizeRandomSeed,
  seededOffset,
  sliceSeededPage,
};
