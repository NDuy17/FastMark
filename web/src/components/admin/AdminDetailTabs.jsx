export default function AdminDetailTabs({ tabs = [], activeTab, onChange, variant = 'pill' }) {
  if (!tabs.length) return null;

  const className =
    variant === 'underline'
      ? 'admin-detail-tabs admin-detail-tabs-underline'
      : 'admin-detail-tabs';

  return (
    <nav className={className} aria-label="Chi tiết tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={activeTab === tab.id ? 'active' : undefined}
          onClick={() => onChange?.(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
