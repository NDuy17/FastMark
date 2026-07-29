import { Link } from 'react-router-dom';

/**
 * Cột thao tác dạng icon — tiết kiệm diện tích bảng admin.
 *
 * action: {
 *   icon: LucideIcon,
 *   label: string,      // tooltip + aria-label
 *   to?: string,
 *   onClick?: () => void,
 *   disabled?: boolean,
 *   variant?: 'default' | 'primary' | 'danger' | 'warning' | 'muted',
 * }
 */
export default function TableIconActions({ actions = [], className = '' }) {
  const visible = actions.filter(Boolean);
  if (!visible.length) {
    return null;
  }

  return (
    <div className={`table-icon-actions${className ? ` ${className}` : ''}`}>
      {visible.map((action, index) => {
        const Icon = action.icon;
        if (!Icon) {
          return null;
        }

        const btnClass = [
          'icon-action-btn',
          action.variant && action.variant !== 'default'
            ? `icon-action-btn--${action.variant}`
            : '',
        ]
          .filter(Boolean)
          .join(' ');

        const iconNode = <Icon size={16} strokeWidth={2} aria-hidden="true" />;

        if (action.to) {
          return (
            <Link
              key={`${action.label}-${index}`}
              to={action.to}
              className={btnClass}
              title={action.label}
              aria-label={action.label}
            >
              {iconNode}
            </Link>
          );
        }

        return (
          <button
            key={`${action.label}-${index}`}
            type="button"
            className={btnClass}
            title={action.label}
            aria-label={action.label}
            onClick={action.onClick}
            disabled={action.disabled}
          >
            {iconNode}
          </button>
        );
      })}
    </div>
  );
}
