export default function AdminFilterPanel({
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Tìm kiếm...',
  children = null,
  showSearch = true,
  layout = 'stacked',
}) {
  const panelClassName =
    layout === 'inline' ? 'admin-filter-panel admin-filter-panel--inline' : 'admin-filter-panel';
  const gridClassName =
    layout === 'inline' ? 'admin-filter-grid admin-filter-grid--inline' : 'admin-filter-grid';

  return (
    <div className={panelClassName}>
      {showSearch ? (
        <div className="admin-filter-search-row">
          <input
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange?.(event.target.value)}
            placeholder={searchPlaceholder}
          />
        </div>
      ) : null}
      {children ? <div className={gridClassName}>{children}</div> : null}
    </div>
  );
}
