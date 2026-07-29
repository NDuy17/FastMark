export default function AdminHeroHeader({ icon: Icon, title, description, actions = null }) {
  return (
    <header className="admin-hero">
      <div className="admin-hero-content">
        {Icon ? (
          <span className="admin-hero-icon">
            <Icon size={26} strokeWidth={2} aria-hidden="true" />
          </span>
        ) : null}
        <div>
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="admin-hero-actions">{actions}</div> : null}
    </header>
  );
}
