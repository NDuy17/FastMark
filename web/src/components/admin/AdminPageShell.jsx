import AdminStatCards from './AdminStatCards';

export default function AdminPageShell({
  title: _title,
  description: _description,
  icon: _icon = null,
  actions = null,
  stats = null,
  filters = null,
  children,
}) {
  return (
    <div className="admin-page">
      {actions ? <div className="admin-page-actions">{actions}</div> : null}

      <AdminStatCards stats={stats} />

      {filters ? (
        <section className="admin-panel">
          <div className="admin-panel-body">{filters}</div>
        </section>
      ) : null}

      {children}
    </div>
  );
}
