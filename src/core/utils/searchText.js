/**
 * Chuẩn hóa chuỗi tìm kiếm toàn app: bỏ dấu tiếng Việt + lowercase + trim.
 * Dùng thống nhất cho mọi ô tìm kiếm (client filter và so khớp haystack).
 */
export function removeVietnameseDiacritics(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

export function normalizeSearchText(value) {
  return removeVietnameseDiacritics(String(value || ''))
    .trim()
    .toLowerCase();
}

/**
 * true nếu haystack chứa keyword sau khi normalize (contains, không phân biệt hoa/thường/dấu).
 * keyword rỗng → luôn khớp.
 */
export function matchesSearch(haystack, keyword) {
  const needle = normalizeSearchText(keyword);
  if (!needle) {
    return true;
  }
  return normalizeSearchText(haystack).includes(needle);
}

/**
 * true nếu bất kỳ field nào khớp keyword.
 */
export function matchesSearchAny(fields, keyword) {
  const needle = normalizeSearchText(keyword);
  if (!needle) {
    return true;
  }
  return (fields || []).some((field) => normalizeSearchText(field).includes(needle));
}
