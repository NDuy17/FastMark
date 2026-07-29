import { useEffect, useRef, useState } from 'react';
import { ListFilter } from 'lucide-react';

import { HISTORY_STATUS_FILTER_ALL } from '../../config/historyStatusFilters';

export default function HistoryStatusFilter({ options = [], value = HISTORY_STATUS_FILTER_ALL, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  if (!options.length) return null;

  const activeOption = options.find((item) => item.value === value) || options[0];
  const isFiltered = value && value !== HISTORY_STATUS_FILTER_ALL;

  function selectOption(nextValue) {
    onChange?.(nextValue);
    setOpen(false);
  }

  return (
    <div className="history-status-filter" ref={rootRef}>
      <button
        type="button"
        className={`history-status-filter-trigger${open ? ' open' : ''}${isFiltered ? ' active' : ''}`}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title="Lọc theo trạng thái"
      >
        <ListFilter size={16} aria-hidden="true" />
        <span>{activeOption?.label || 'Tất cả'}</span>
      </button>

      {open ? (
        <div className="history-status-filter-menu" role="listbox" aria-label="Lọc trạng thái">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={value === option.value}
              className={value === option.value ? 'active' : undefined}
              onClick={() => selectOption(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
