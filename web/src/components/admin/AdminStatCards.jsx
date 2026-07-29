export default function AdminStatCards({ stats = [] }) {
  if (!stats.length) return null;

  return (
    <div className="admin-stats-row">
      {stats.map((stat) => {
        const Icon = stat.icon;
        const tone = stat.tone || 'green';
        const Tag = stat.onClick ? 'button' : 'article';
        return (
          <Tag
            key={stat.label}
            type={stat.onClick ? 'button' : undefined}
            className={`admin-stat-card${stat.onClick ? ' clickable' : ''}${stat.active ? ' active' : ''}`}
            onClick={stat.onClick}
          >
            <div className="admin-stat-card-head">
              {Icon ? (
                <span className={`admin-stat-card-icon tone-${tone}`}>
                  <Icon size={20} strokeWidth={2} aria-hidden="true" />
                </span>
              ) : null}
              <span className="admin-stat-card-label">{stat.label}</span>
            </div>
            <strong className="admin-stat-card-value">{stat.value}</strong>
          </Tag>
        );
      })}
    </div>
  );
}
