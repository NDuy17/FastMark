import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export default function AdminBreadcrumb({ items = [] }) {
  if (!items.length) return null;

  return (
    <nav className="admin-breadcrumb" aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {index > 0 ? <ChevronRight size={14} className="admin-breadcrumb-sep" aria-hidden /> : null}
            {!isLast && item.to ? (
              <Link to={item.to}>{item.label}</Link>
            ) : (
              <span className={isLast ? 'admin-breadcrumb-current' : undefined}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
