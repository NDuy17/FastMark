export default function DataTableShell({
  title,
  subtitle = '',
  toolbar = null,
  filters = null,
  filterColumns = 4,
  pagination = null,
  children,
  className = '',
}) {
  const headClassName = [
    'admin-panel-head',
    filters ? 'admin-panel-head--with-filters' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={`admin-panel ${className}`.trim()}>
      {title || toolbar || filters ? (
        <div
          className={headClassName}
          style={filters ? { '--admin-filter-cols': filterColumns } : undefined}
        >
          {title || subtitle ? (
            <div className="admin-panel-head-main">
              {title ? <h2>{title}</h2> : null}
              {subtitle ? <span className="admin-panel-subtitle">{subtitle}</span> : null}
            </div>
          ) : null}
          {toolbar}
          {filters}
        </div>
      ) : null}
      <div className="admin-panel-body flush">
        <div className="table-scroll">{children}</div>
        {pagination ? <div className="admin-pagination">{pagination}</div> : null}
      </div>
    </section>
  );
}
