import { ChevronLeft, ChevronRight } from 'lucide-react';

import { PAGE_SIZE_OPTIONS } from '../../constants/pagination';

function buildPageItems(page, totalPages) {
  const safeTotal = Math.max(1, totalPages);
  if (safeTotal <= 1) {
    return [{ type: 'page', value: 1 }];
  }

  const pages = new Set([1, safeTotal]);
  for (let i = page - 1; i <= page + 1; i += 1) {
    if (i >= 1 && i <= safeTotal) {
      pages.add(i);
    }
  }

  const sorted = [...pages].sort((left, right) => left - right);
  const items = [];
  let previous = 0;

  sorted.forEach((value) => {
    if (previous && value - previous > 1) {
      items.push({ type: 'ellipsis', key: `gap-${previous}-${value}` });
    }
    items.push({ type: 'page', value });
    previous = value;
  });

  return items;
}

export default function AdminPagination({
  page = 1,
  totalPages = 1,
  total: _total = 0,
  label: _label = 'bản ghi',
  limit = 20,
  onLimitChange,
  loading = false,
  onPageChange,
  onPrev,
  onNext,
}) {
  const safeTotalPages = Math.max(1, totalPages);
  const pageItems = buildPageItems(page, safeTotalPages);

  function goToPage(target) {
    const next = Math.min(Math.max(1, target), safeTotalPages);
    if (loading || next === page) return;

    if (onPageChange) {
      onPageChange(next);
      return;
    }

    if (next === page - 1) onPrev?.();
    else if (next === page + 1) onNext?.();
  }

  return (
    <div className="admin-pagination-inner">
      <button
        type="button"
        className="admin-pagination-icon-btn"
        disabled={loading || page <= 1}
        onClick={() => goToPage(page - 1)}
        aria-label="Trang trước"
      >
        <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
      </button>

      <div className="admin-pagination-pages">
        {pageItems.map((item) => {
          if (item.type === 'ellipsis') {
            return (
              <span key={item.key} className="admin-pagination-ellipsis" aria-hidden="true">
                …
              </span>
            );
          }

          const isActive = item.value === page;
          return (
            <button
              key={`page-${item.value}`}
              type="button"
              className={`admin-pagination-page-btn${isActive ? ' active' : ''}`}
              disabled={loading || isActive}
              onClick={() => goToPage(item.value)}
              aria-label={`Trang ${item.value}`}
              aria-current={isActive ? 'page' : undefined}
            >
              {item.value}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="admin-pagination-icon-btn"
        disabled={loading || page >= safeTotalPages}
        onClick={() => goToPage(page + 1)}
        aria-label="Trang sau"
      >
        <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
      </button>

      <label className="admin-pagination-size">
        <select
          value={limit}
          disabled={loading || !onLimitChange}
          onChange={(event) => onLimitChange?.(Number(event.target.value))}
          aria-label="Số kết quả mỗi trang"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size} / trang
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
