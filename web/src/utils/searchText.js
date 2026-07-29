export function removeVietnameseDiacritics(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

export function normalizeSearchText(value) {
  return removeVietnameseDiacritics(value).trim().toLowerCase();
}

export function normalizeSearchKeyword(value) {
  return normalizeSearchText(value).replace(/^@+/, '').replace(/^#+/, '');
}

export function matchesSearchText(haystack, needle) {
  const normalizedNeedle = normalizeSearchKeyword(needle);
  if (!normalizedNeedle || normalizedNeedle.length < 2) {
    return true;
  }
  return normalizeSearchText(haystack).includes(normalizedNeedle);
}

export function resolveStatusesFromLabelSearch(keyword, entries = []) {
  const normalized = normalizeSearchKeyword(keyword);
  if (!normalized || normalized.length < 2) {
    return [];
  }

  const matched = new Set();
  for (const entry of entries) {
    const labelNorm = normalizeSearchText(entry.label);
    if (!labelNorm) {
      continue;
    }
    if (labelNorm.includes(normalized) || normalized.includes(labelNorm)) {
      const statuses = Array.isArray(entry.statuses)
        ? entry.statuses
        : entry.status !== undefined
          ? [entry.status]
          : [];
      statuses.forEach((status) => {
        if (Number.isFinite(Number(status))) {
          matched.add(Number(status));
        }
      });
    }
  }

  return [...matched];
}
