export function parseDateString(value, fallback = new Date()) {
  const source = String(value || '').trim();
  const match = source.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (!match) {
    const fallbackDate = fallback instanceof Date ? fallback : new Date(fallback);
    if (!Number.isNaN(fallbackDate.getTime())) {
      return fallbackDate;
    }
    return new Date();
  }

  const day = Math.min(31, Math.max(1, Number(match[1])));
  const month = Math.min(12, Math.max(1, Number(match[2])));
  const year = Number(match[3]);
  const parsed = new Date(year, month - 1, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    const fallbackDate = fallback instanceof Date ? fallback : new Date(fallback);
    return Number.isNaN(fallbackDate.getTime()) ? new Date() : fallbackDate;
  }

  return parsed;
}

export function formatDateString(date) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) {
    return '';
  }
  const day = String(value.getDate()).padStart(2, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const year = value.getFullYear();
  return `${day}/${month}/${year}`;
}
