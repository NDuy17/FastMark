function parseDateStart(value) {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00.000`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDateEnd(value) {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function applyCreatedAtRange(filter, query = {}, field = "CreatedAt") {
  const from = parseDateStart(query.from || query.dateFrom);
  const to = parseDateEnd(query.to || query.dateTo);
  if (!from && !to) {
    return filter;
  }

  const range = {};
  if (from) range.$gte = from;
  if (to) range.$lte = to;

  if (filter[field] && typeof filter[field] === "object" && !Array.isArray(filter[field])) {
    filter[field] = { ...filter[field], ...range };
  } else {
    filter[field] = range;
  }

  return filter;
}

function applyPurchaseDateRange(filter, query = {}) {
  return applyCreatedAtRange(filter, query, "ngayMua");
}

module.exports = {
  parseDateStart,
  parseDateEnd,
  applyCreatedAtRange,
  applyPurchaseDateRange,
};
