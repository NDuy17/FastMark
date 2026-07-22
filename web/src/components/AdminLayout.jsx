import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

const SIDEBAR_COLLAPSED_KEY = 'fm_admin_sidebar_collapsed';

const NAV_GROUPS = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: '▦',
    items: [
      { to: '/', label: 'Dashboard', end: true },
    ],
  },
  {
    id: 'users',
    title: 'Người dùng',
    icon: '👤',
    items: [
      { to: '/accounts', label: 'Tất cả tài khoản', match: { path: '/accounts', role: '' } },
      { to: '/accounts?role=2', label: 'Người bán', match: { path: '/accounts', role: '2' } },
      { to: '/accounts?role=1', label: 'Người mua', match: { path: '/accounts', role: '1' } },
      { to: '/verifications', label: 'Duyệt người bán' },
    ],
  },
  {
    id: 'categories',
    title: 'Danh mục',
    icon: '🗂',
    items: [
      {
        to: '/categories?type=shops',
        label: 'Danh mục cửa hàng',
        match: { path: '/categories', type: 'shops' },
      },
      {
        to: '/categories?type=products',
        label: 'Danh mục sản phẩm',
        match: { path: '/categories', type: 'products' },
      },
    ],
  },
  {
    id: 'catalog',
    title: 'Sản phẩm & Đơn hàng',
    icon: '📦',
    items: [
      { to: '/products', label: 'Sản phẩm' },
      {
        to: '/reservations',
        label: 'Đơn giữ hàng',
        match: { path: '/reservations', tab: 'not-disputes' },
      },
      {
        to: '/reservations?tab=disputes',
        label: 'Tranh chấp',
        match: { path: '/reservations', tab: 'disputes' },
      },
    ],
  },
  {
    id: 'content',
    title: 'Nội dung',
    icon: '📝',
    items: [
      { to: '/reports', label: 'Báo cáo nội dung' },
      { to: '/reviews', label: 'Đánh giá' },
      { to: '/notifications', label: 'Thông báo' },
      { to: '/audit-logs', label: 'Nhật ký admin' },
    ],
  },
  {
    id: 'plans',
    title: 'Gói & Banner',
    icon: '🎯',
    items: [
      { to: '/seller-plans', label: 'Seller Plans' },
      { to: '/seller-subscriptions', label: 'Seller Subscriptions' },
      { to: '/banner-plans', label: 'Banner Plans' },
      { to: '/seller-banners', label: 'Seller Banners' },
    ],
  },
  {
    id: 'finance',
    title: 'Tài chính',
    icon: '💳',
    items: [
      { to: '/finance', label: 'Tổng quan tài chính' },
      { to: '/banks', label: 'Ngân hàng' },
      { to: '/withdrawals', label: 'Rút tiền / Lịch sử' },
    ],
  },
];

function isItemActive(item, pathname, searchParams) {
  if (item.match) {
    const { path, role, type, tab } = item.match;
    const onPath =
      pathname === path || (path !== '/' && pathname.startsWith(`${path}/`));
    if (!onPath) return false;

    if (role !== undefined) {
      return (searchParams.get('role') || '') === role;
    }
    if (type !== undefined) {
      return (searchParams.get('type') || 'products') === type;
    }
    if (tab === 'disputes') {
      return searchParams.get('tab')?.toLowerCase() === 'disputes';
    }
    if (tab === 'not-disputes') {
      return searchParams.get('tab')?.toLowerCase() !== 'disputes';
    }
    return true;
  }

  if (item.end) {
    return pathname === item.to;
  }

  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function groupHasActive(group, pathname, searchParams) {
  return group.items.some((item) => isItemActive(item, pathname, searchParams));
}

function readCollapsedPreference() {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);

  const [collapsed, setCollapsed] = useState(readCollapsedPreference);

  const [openGroups, setOpenGroups] = useState(() => {
    const initial = {};
    NAV_GROUPS.forEach((group) => {
      initial[group.id] = groupHasActive(group, location.pathname, searchParams);
    });
    return initial;
  });

  // Tự mở nhóm chứa route đang active khi điều hướng.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setOpenGroups((current) => {
      const next = { ...current };
      NAV_GROUPS.forEach((group) => {
        if (groupHasActive(group, location.pathname, params)) {
          next[group.id] = true;
        }
      });
      return next;
    });
  }, [location.pathname, location.search]);

  function toggleGroup(groupId) {
    if (collapsed) return;
    setOpenGroups((current) => ({ ...current, [groupId]: !current[groupId] }));
  }

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        // localStorage không khả dụng thì bỏ qua, không chặn UI.
      }
      return next;
    });
  }

  return (
    <div className={`admin-shell${collapsed ? ' sidebar-collapsed' : ''}`}>
      <aside className="admin-sidebar">
        <div className="sidebar-top">
          <div className="brand" title="FastMark Admin">
            {collapsed ? 'FM' : 'FastMark Admin'}
          </div>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={toggleCollapsed}
            title={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
            aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>
        <nav>
          {NAV_GROUPS.map((group) => {
            const isOpen = Boolean(openGroups[group.id]);
            const hasActive = groupHasActive(group, location.pathname, searchParams);
            return (
              <div
                key={group.id}
                className={`nav-group${isOpen && !collapsed ? ' open' : ''}`}
              >
                <button
                  type="button"
                  className={`nav-group-header${hasActive ? ' has-active' : ''}`}
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={collapsed ? undefined : isOpen}
                  title={collapsed ? group.title : undefined}
                >
                  <span className="nav-group-icon">{group.icon}</span>
                  <span className="nav-group-label">{group.title}</span>
                  <span
                    className={`nav-group-chevron${isOpen ? ' open' : ''}`}
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 20 20" width="14" height="14" fill="none">
                      <path
                        d="M4.5 7.5 L10 13 L15.5 7.5"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </button>
                {/* Khi thu gọn, links hiển thị dưới dạng flyout khi hover (CSS). */}
                {isOpen || collapsed ? (
                  <div className="nav-group-links">
                    {collapsed ? (
                      <div className="nav-flyout-title">{group.title}</div>
                    ) : null}
                    {group.items.map((item) => {
                      const active = isItemActive(item, location.pathname, searchParams);
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
          {!collapsed ? <div className="admin-email">{user?.email}</div> : null}
          <button type="button" onClick={logout} title="Đăng xuất">
            {collapsed ? '⎋' : 'Đăng xuất'}
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
