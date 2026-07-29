import {
  Banknote,
  Bell,
  Flag,
  Layers,
  LayoutDashboard,
  MessageSquareWarning,
  Package,
  ShoppingBag,
  Star,
  Users,
  Wallet,
} from 'lucide-react';

/**
 * Cấu hình menu admin — Phương án B.
 * Mỗi item có thể khai báo `match` để active chính xác theo query.
 */
export const ADMIN_NAV_GROUPS = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: LayoutDashboard,
    items: [{ to: '/', label: 'Tổng quan', end: true }],
  },
  {
    id: 'users',
    title: 'Quản lý người dùng',
    icon: Users,
    items: [
      { to: '/accounts', label: 'Người mua', match: { path: '/accounts', view: 'buyers' } },
      { to: '/shops', label: 'Gian hàng', match: { path: '/shops', shopFilter: 'all' } },
      { to: '/verifications', label: 'Duyệt gian hàng', match: { path: '/verifications' } },
    ],
  },
  {
    id: 'products',
    title: 'Quản lý sản phẩm',
    icon: Package,
    items: [
      { to: '/products', label: 'Tất cả sản phẩm', match: { path: '/products', productFilter: 'all' } },
    ],
  },
  {
    id: 'categories',
    title: 'Quản lý danh mục',
    icon: Layers,
    items: [
      { to: '/categories?type=shops', label: 'Danh mục gian hàng', match: { path: '/categories', type: 'shops' } },
      { to: '/categories?type=products', label: 'Danh mục sản phẩm', match: { path: '/categories', type: 'products' } },
    ],
  },
  {
    id: 'orders',
    title: 'Quản lý đơn hàng',
    icon: ShoppingBag,
    items: [
      { to: '/reservations', label: 'Tất cả đơn', match: { path: '/reservations', tab: 'all' } },
      { to: '/reservations?tab=pending', label: 'Chờ xác nhận', match: { path: '/reservations', tab: 'pending' } },
      { to: '/reservations?tab=waiting_pickup', label: 'Giữ hàng', match: { path: '/reservations', tab: 'waiting_pickup' } },
      { to: '/reservations?tab=disputes', label: 'Tranh chấp', match: { path: '/reservations', tab: 'disputes' } },
      { to: '/reservations?tab=completed', label: 'Hoàn thành', match: { path: '/reservations', tab: 'completed' } },
      { to: '/reservations?tab=cancelled', label: 'Đã hủy', match: { path: '/reservations', tab: 'cancelled' } },
    ],
  },
  {
    id: 'seller-plans',
    title: 'Quản lý gói Seller',
    icon: Wallet,
    items: [
      { to: '/seller-plans', label: 'Danh sách gói', match: { path: '/seller-plans' } },
      { to: '/seller-subscriptions', label: 'Lịch sử mua gói', match: { path: '/seller-subscriptions', status: 'all' } },
    ],
  },
  {
    id: 'banners',
    title: 'Quản lý Banner',
    icon: Flag,
    items: [
      { to: '/banner-plans', label: 'Gói banner', match: { path: '/banner-plans' } },
      { to: '/seller-banners?filter=active', label: 'Banner trang chủ', match: { path: '/seller-banners' } },
      { to: '/banner-purchases', label: 'Lịch sử mua banner', match: { path: '/banner-purchases' } },
    ],
  },
  {
    id: 'notifications',
    title: 'Quản lý thông báo',
    icon: Bell,
    items: [
      { to: '/notifications', label: 'Gửi thông báo', match: { path: '/notifications' } },
    ],
  },
  {
    id: 'reviews',
    title: 'Quản lý đánh giá',
    icon: Star,
    items: [
      { to: '/reviews', label: 'Tất cả đánh giá', match: { path: '/reviews', reviewScope: 'all' } },
    ],
  },
  {
    id: 'complaints',
    title: 'Quản lý và khiếu nại',
    icon: MessageSquareWarning,
    items: [
      { to: '/reports', label: 'Xử lý báo cáo', match: { path: '/reports', reportScope: 'all' } },
      { to: '/audit-logs', label: 'Nhật ký hệ thống', match: { path: '/audit-logs' } },
    ],
  },
  {
    id: 'finance',
    title: 'Quản lý tài chính',
    icon: Banknote,
    items: [
      { to: '/finance', label: 'Tổng quan tài chính', match: { path: '/finance', tab: 'all' } },
      { to: '/banks', label: 'Ngân hàng', match: { path: '/banks' } },
      { to: '/withdrawals', label: 'Rút tiền', match: { path: '/withdrawals' } },
    ],
  },
];

const DETAIL_BREADCRUMBS = [
  { pattern: /^\/accounts\/[^/]+$/, group: 'Quản lý người dùng', label: 'Chi tiết người dùng' },
  { pattern: /^\/shops\/[^/]+$/, group: 'Quản lý người dùng', label: 'Chi tiết gian hàng' },
  { pattern: /^\/products\/[^/]+$/, group: 'Quản lý sản phẩm', label: 'Chi tiết sản phẩm' },
  { pattern: /^\/reservations\/[^/]+$/, group: 'Quản lý đơn hàng', label: 'Chi tiết đơn hàng' },
];

function queryMatches(match, searchParams) {
  if (!match) return true;

  return Object.entries(match).every(([key, expected]) => {
    if (key === 'path') return true;

    const actual = searchParams.get(key);

    if (key === 'view' && expected === 'all') {
      return actual === 'all';
    }
    if (key === 'view' && expected === 'buyers') {
      const status = searchParams.get('status');
      return (!actual || actual === 'buyers') && !status;
    }
    if (key === 'shopFilter' && expected === 'all') {
      return !searchParams.get('filter') && !searchParams.get('status');
    }
    if (key === 'productFilter' && expected === 'all') {
      return !searchParams.get('status');
    }
    if (key === 'reviewScope' && expected === 'all') {
      return !searchParams.get('scope');
    }
    if (key === 'reportScope' && expected === 'all') {
      return true;
    }
    if (key === 'tab' && expected === 'all') {
      return !actual;
    }
    if (key === 'status' && expected === 'all') {
      return !actual;
    }
    if (key === 'mode' && expected === 'compose') {
      return !searchParams.get('tab');
    }
    if (key === 'tab' && expected === 'seller') {
      return actual === 'seller';
    }
    if (key === 'tab' && expected === 'banner') {
      return actual === 'banner';
    }

    if (key === 'scope' && expected === 'members') {
      return actual === 'members';
    }
    if (key === 'scope' && expected === 'product') {
      return actual === 'product';
    }

    return (actual ?? '') === String(expected);
  });
}

export function isNavItemActive(item, pathname, searchParams) {
  const match = item.match || {};
  const path = match.path || item.to.split('?')[0];

  const onPath =
    pathname === path || (path !== '/' && pathname.startsWith(`${path}/`) && !item.end);
  if (!onPath) return false;

  if (pathname !== path && path !== '/') {
    return false;
  }

  if (item.match) {
    return queryMatches(item.match, searchParams);
  }

  if (item.end) {
    return pathname === item.to;
  }

  return pathname === path;
}

function matchSpecificity(item) {
  if (!item.match) return 0;
  return Object.keys(item.match).filter((key) => key !== 'path').length;
}

/** Chỉ trả về 1 mục menu active — tránh 2 nhóm cùng sáng (vd. /shops). */
export function findActiveNavEntry(pathname, searchParams) {
  let best = null;
  let bestScore = -1;

  for (const group of ADMIN_NAV_GROUPS) {
    for (const item of group.items) {
      if (!isNavItemActive(item, pathname, searchParams)) continue;
      const score = matchSpecificity(item);
      if (score > bestScore) {
        best = { group, item };
        bestScore = score;
      }
    }
  }

  return best;
}

export function groupHasActiveNav(group, pathname, searchParams) {
  const active = findActiveNavEntry(pathname, searchParams);
  return active?.group.id === group.id;
}

export function isNavItemActiveExclusive(item, pathname, searchParams) {
  const active = findActiveNavEntry(pathname, searchParams);
  return active?.item === item;
}

export function getAdminBreadcrumbs(pathname, searchParams) {
  const active = findActiveNavEntry(pathname, searchParams);
  if (active) {
    const { group, item } = active;
    if (group.id === 'dashboard') {
      return [
        { label: 'Dashboard', to: '/' },
        { label: item.label },
      ];
    }
    return [
      { label: group.title, to: item.to.split('?')[0] },
      { label: item.label },
    ];
  }

  for (const detail of DETAIL_BREADCRUMBS) {
    if (detail.pattern.test(pathname)) {
      if (detail.pattern.source.includes('products')) {
        return [
          { label: 'Quản lý sản phẩm', to: '/products' },
          { label: 'Danh sách sản phẩm', to: '/products' },
          { label: detail.label },
        ];
      }
      return [
        { label: detail.group },
        { label: detail.label },
      ];
    }
  }

  return [];
}

export function findActiveNavMeta(pathname, searchParams) {
  const active = findActiveNavEntry(pathname, searchParams);
  if (active) {
    return {
      groupTitle: active.group.title,
      pageTitle: active.item.label,
      item: active.item,
    };
  }
  for (const detail of DETAIL_BREADCRUMBS) {
    if (detail.pattern.test(pathname)) {
      return { groupTitle: detail.group, pageTitle: detail.label, item: null };
    }
  }
  return { groupTitle: 'Admin', pageTitle: 'FastMark', item: null };
}
