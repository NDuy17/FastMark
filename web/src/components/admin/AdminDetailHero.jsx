export default function AdminDetailHero({
  banner = null,
  avatar = null,
  avatarFallback = '?',
  title,
  subtitle = null,
  badges = null,
  actions = null,
}) {
  return (
    <section className="admin-detail-hero">
      {banner ? <img src={banner} alt="" className="admin-detail-hero-banner" /> : null}
      {avatar ? (
        <img src={avatar} alt="" className="admin-detail-avatar" />
      ) : (
        <div className="admin-detail-avatar placeholder">{avatarFallback}</div>
      )}
      <div className="admin-detail-hero-body">
        <h1>{title}</h1>
        {subtitle ? <p className="cell-sub" style={{ marginTop: 6 }}>{subtitle}</p> : null}
        {badges ? <div className="admin-detail-hero-meta">{badges}</div> : null}
      </div>
      {actions ? <div className="admin-detail-hero-actions">{actions}</div> : null}
    </section>
  );
}
