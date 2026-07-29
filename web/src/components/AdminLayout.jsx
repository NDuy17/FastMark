import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LogOut, ChevronsLeft, ChevronsRight, ChevronDown } from 'lucide-react';

import AdminBreadcrumb from './admin/AdminBreadcrumb';
import {
  ADMIN_NAV_GROUPS,
  findActiveNavEntry,
  getAdminBreadcrumbs,
  isNavItemActiveExclusive,
} from '../config/adminNavigation';
import { useAuth } from '../context/AuthContext';

const SIDEBAR_COLLAPSED_KEY = 'fm_admin_sidebar_collapsed';

function readCollapsedPreference() {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function adminInitial(email = '') {
  return (email.charAt(0) || 'A').toUpperCase();
}

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);

  const [collapsed, setCollapsed] = useState(readCollapsedPreference);
  const [openGroups, setOpenGroups] = useState(() => {
    const active = findActiveNavEntry(location.pathname, searchParams);
    const initial = {};
    ADMIN_NAV_GROUPS.forEach((group) => {
      initial[group.id] = active?.group.id === group.id;
    });
    return initial;
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const active = findActiveNavEntry(location.pathname, params);
    if (!active) return;
    setOpenGroups((current) => ({
      ...current,
      [active.group.id]: true,
    }));
  }, [location.pathname, location.search]);

  function toggleGroup(groupId) {
    if (collapsed) return;
    setOpenGroups((current) => ({
      ...current,
      [groupId]: !current[groupId],
    }));
  }

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  }

  const breadcrumbs = getAdminBreadcrumbs(location.pathname, searchParams);
  const email = user?.email || 'Admin';

  return (
    <div className={`admin-shell admin-shell-v2${collapsed ? ' sidebar-collapsed' : ''}`}>
      <aside className="admin-sidebar">
        <div className="sidebar-top">
          <div className="brand" title="FastMark Admin">
            <span className="brand-mark">FM</span>
            {!collapsed ? <span>FastMark Admin</span> : null}
          </div>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={toggleCollapsed}
            title={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
            aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
          >
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
        </div>

        <nav>
          {ADMIN_NAV_GROUPS.map((group) => {
            const isOpen = Boolean(openGroups[group.id]);
            const Icon = group.icon;

            return (
              <div key={group.id} className={`nav-group${isOpen && !collapsed ? ' open' : ''}`}>
                <button
                  type="button"
                  className="nav-group-header"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={collapsed ? undefined : isOpen}
                  title={collapsed ? group.title : undefined}
                >
                  <span className="nav-group-icon">
                    {Icon ? <Icon size={20} strokeWidth={2} aria-hidden="true" /> : null}
                  </span>
                  {!collapsed ? <span className="nav-group-label">{group.title}</span> : null}
                  {!collapsed ? (
                    <span className="nav-group-chevron" aria-hidden="true">
                      <ChevronDown size={16} strokeWidth={2} />
                    </span>
                  ) : null}
                </button>
                {isOpen && !collapsed ? (
                  <div className="nav-group-links">
                    {group.items.map((item) => {
                      const active = isNavItemActiveExclusive(item, location.pathname, searchParams);
                      return (
                        <NavLink
                          key={`${item.to}-${item.label}`}
                          to={item.to}
                          end={Boolean(item.end)}
                          className={() => (active ? 'active' : undefined)}
                        >
                          {item.label}
                        </NavLink>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {!collapsed ? <div className="admin-email">{email}</div> : null}
          <button type="button" onClick={logout} title="Đăng xuất" aria-label="Đăng xuất">
            {collapsed ? (
              <LogOut size={18} />
            ) : (
              <>
                <LogOut size={16} aria-hidden="true" />
                <span>Đăng xuất</span>
              </>
            )}
          </button>
        </div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <AdminBreadcrumb items={breadcrumbs} />
          <div className="admin-topbar-actions">
            <div className="admin-topbar-avatar" title={email}>
              <span className="admin-topbar-avatar-circle">{adminInitial(email)}</span>
              <div className="admin-topbar-avatar-info">
                <strong>Quản trị viên</strong>
                <span>{email}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="admin-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
