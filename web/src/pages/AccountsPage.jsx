import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { listAccounts } from '../api/accountApi';
import { useAuth } from '../context/AuthContext';

const ROLE_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: '1', label: 'Người mua' },
  { value: '2', label: 'Người bán' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: '1', label: 'Hoạt động' },
  { value: '0', label: 'Đã khóa' },
];

const VERIFICATION_OPTIONS = [
  { value: '', label: 'Tất cả xác minh' },
  { value: '0', label: 'Chờ duyệt' },
  { value: '1', label: 'Đã duyệt' },
  { value: '2', label: 'Đã từ chối' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'oldest', label: 'Cũ nhất' },
  { value: 'last_active', label: 'Hoạt động gần nhất' },
  { value: 'most_products', label: 'Nhiều sản phẩm nhất' },
];

function formatDate(value) {
  if (!value) return '';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const time = date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const day = [
      String(date.getDate()).padStart(2, '0'),
      String(date.getMonth() + 1).padStart(2, '0'),
      date.getFullYear(),
    ].join('/');
    return { time, day };
  } catch {
    return '';
  }
}

function DateCell({ label, value }) {
  const formatted = formatDate(value);
  if (!formatted) {
    return (
      <div className="activity-line">
        <span className="activity-label">{label}</span>
        <span className="activity-value" />
      </div>
    );
  }
  return (
    <div className="activity-line">
      <span className="activity-label">{label}</span>
      <span className="activity-value">
        <strong>{formatted.time}</strong>
        <em>{formatted.day}</em>
      </span>
    </div>
  );
}

function statusBadgeClass(status) {
  return status === 1 ? 'badge badge-success' : 'badge badge-danger';
}

/** Cột cửa hàng: 1 Hoạt động · 2 Chờ duyệt · 3 Bị khóa */
function shopColumnState(item) {
  if (!item?.shop) return null;
  if (item.shop.status === 0) {
    return { label: 'Bị khóa', className: 'badge badge-danger' };
  }
  const verificationStatus = item.verification?.status;
  if (verificationStatus === 1) {
    return { label: 'Hoạt động', className: 'badge badge-success' };
  }
  if (verificationStatus === 2) {
    return { label: 'Bị khóa', className: 'badge badge-danger' };
  }
  return { label: 'Chờ duyệt', className: 'badge badge-warning' };
}

function rolePageTitle(role) {
  if (role === '1') return 'Người mua';
  if (role === '2') return 'Người bán';
  return 'Người dùng';
}

function rolePageSubtitle(role) {
  if (role === '1') return 'Danh sách tài khoản người mua.';
  if (role === '2') return 'Danh sách tài khoản người bán.';
  return 'Quản lý tài khoản người mua và người bán. Tài khoản quản trị không hiển thị ở đây.';
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <tr key={index}>
          <td className="col-thumb"><div className="skeleton skeleton-avatar" /></td>
          <td className="col-account"><div className="skeleton skeleton-line" /></td>
          <td className="col-contact"><div className="skeleton skeleton-line" /></td>
          <td className="col-status"><div className="skeleton skeleton-line short" /></td>
          <td className="col-status"><div className="skeleton skeleton-line short" /></td>
          <td className="col-shop"><div className="skeleton skeleton-line short" /></td>
          <td className="col-activity"><div className="skeleton skeleton-line" /></td>
          <td className="col-actions"><div className="skeleton skeleton-line short" /></td>
        </tr>
      ))}
    </>
  );
}

export default function AccountsPage() {
  const { getIdToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const roleFromUrl = searchParams.get('role') || '';

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState(roleFromUrl);
  const [status, setStatus] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setRole(roleFromUrl);
    setPage(1);
  }, [roleFromUrl]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const token = await getIdToken();
      const payload = await listAccounts(token, {
        search,
        role,
        status,
        verificationStatus,
        sort,
        page,
        limit: 20,
      });

      setItems(payload.data?.items || []);
      setPagination(payload.data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (loadError) {
      setError(loadError.message || 'Không tải được danh sách người dùng.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [getIdToken, page, role, search, sort, status, verificationStatus]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  function handleSearchSubmit(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function handleFilterChange(setter, value) {
    setter(value);
    setPage(1);
  }

  function handleRoleChange(value) {
    setRole(value);
    setPage(1);
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set('role', value);
    } else {
      next.delete('role');
    }
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="page">
      <section className="filter-card">
        <form className="filter-form" onSubmit={handleSearchSubmit}>
          <label className="filter-search">
            Tìm kiếm
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Tên đăng nhập, họ tên, email, SĐT, tên cửa hàng..."
            />
          </label>
          <button type="submit" className="primary-btn">Tìm</button>
        </form>

        <div className="filter-grid">
          <label>
            Vai trò
            <select value={role} onChange={(event) => handleRoleChange(event.target.value)}>
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value || 'all-role'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Trạng thái
            <select value={status} onChange={(event) => handleFilterChange(setStatus, event.target.value)}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || 'all-status'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Xác minh người bán
            <select
              value={verificationStatus}
              onChange={(event) => handleFilterChange(setVerificationStatus, event.target.value)}
            >
              {VERIFICATION_OPTIONS.map((option) => (
                <option key={option.value || 'all-verification'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Sắp xếp
            <select value={sort} onChange={(event) => handleFilterChange(setSort, event.target.value)}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}

      <section className="table-card">
        <div className="table-scroll">
          <table className="data-table catalog-table accounts-table">
            <thead>
              <tr>
                <th className="col-thumb">Ảnh</th>
                <th className="col-account">Tài khoản</th>
                <th className="col-contact">Liên hệ</th>
                <th className="col-status">Vai trò</th>
                <th className="col-status">Trạng thái</th>
                <th className="col-shop">Cửa hàng</th>
                <th className="col-activity">Hoạt động</th>
                <th className="col-actions">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <SkeletonRows /> : null}
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-empty">
                    Không tìm thấy người dùng phù hợp.
                  </td>
                </tr>
              ) : null}
              {!loading
                ? items.map((item) => {
                    const shopState = shopColumnState(item);
                    return (
                      <tr key={item.id}>
                        <td className="col-thumb">
                          {item.avatar ? (
                            <img src={item.avatar} alt="" className="thumb-sm" />
                          ) : (
                            <div className="thumb-sm thumb-fallback">
                              {item.userName?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                          )}
                        </td>
                        <td className="col-account">
                          <div className="cell-title">{item.fullName || ''}</div>
                          <div className="cell-sub">@{item.userName}</div>
                        </td>
                        <td className="col-contact">
                          <div className="cell-title soft">{item.email || ''}</div>
                          <div className="cell-sub">{item.phone || ''}</div>
                        </td>
                        <td className="col-status">
                          <span className="badge badge-neutral">{item.roleLabel}</span>
                        </td>
                        <td className="col-status">
                          <span className={statusBadgeClass(item.status)}>{item.statusLabel}</span>
                        </td>
                        <td className="col-shop">
                          {shopState ? (
                            <span className={shopState.className}>{shopState.label}</span>
                          ) : (
                            <span className="cell-sub" />
                          )}
                        </td>
                        <td className="col-activity">
                          <DateCell label="Tạo" value={item.createdAt} />
                          <DateCell label="Gần nhất" value={item.lastActiveAt} />
                        </td>
                        <td className="col-actions">
                          <Link to={`/accounts/${item.id}`} className="detail-btn">
                            Chi tiết
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className="pagination-row">
        <span>
          Trang {pagination.page}/{pagination.totalPages} • {pagination.total} người dùng
        </span>
        <div className="pagination-actions">
          <button
            type="button"
            className="ghost-btn"
            disabled={loading || pagination.page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Trước
          </button>
          <button
            type="button"
            className="ghost-btn"
            disabled={loading || pagination.page >= pagination.totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Sau
          </button>
        </div>
      </div>
    </div>
  );
}
