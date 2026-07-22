import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { apiRequest } from '../api/client';
import { EmptyState } from '../components/ui/Feedback';
import { useAuth } from '../context/AuthContext';

const ACTION_LABELS = {
  ADMIN_REFUND_BUYER: 'Hoàn cọc cho người mua',
  ADMIN_RELEASE_SELLER: 'Giải ngân cọc cho người bán',
  ADMIN_REJECT_REPORT: 'Bác bỏ báo cáo',
};

const DECISION_LABELS = {
  buyer_win: 'Người mua thắng',
  seller_win: 'Người bán thắng',
};

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('vi-VN');
}

export default function AuditLogPage() {
  const { getIdToken } = useAuth();
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (action) params.set('action', action);
      const payload = await apiRequest(`/api/admin/audit-logs?${params}`, { token });
      setData({
        items: payload.data?.items || [],
        pagination: payload.data?.pagination || null,
      });
    } catch (loadError) {
      setError(loadError.message || 'Không tải được nhật ký.');
    } finally {
      setLoading(false);
    }
  }, [getIdToken, page, action]);

  useEffect(() => {
    load();
  }, [load]);

  const pagination = data.pagination;

  return (
    <div className="page">
      <div className="filters-row">
        <select
          value={action}
          onChange={(event) => {
            setAction(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Tất cả thao tác</option>
          {Object.entries(ACTION_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

      <section className="table-card">
        {loading ? (
          <div className="skeleton skeleton-line" style={{ height: 120 }} />
        ) : data.items.length === 0 ? (
          <EmptyState
            title="Chưa có nhật ký"
            description="Chưa có thao tác admin nào được ghi lại."
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Admin</th>
                <th>Thao tác</th>
                <th>Kết quả</th>
                <th>Ghi chú</th>
                <th>Đơn hàng</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((log) => (
                <tr key={log.id}>
                  <td>{formatDate(log.createdAt)}</td>
                  <td>
                    {log.admin ? (
                      <>
                        <div>{log.admin.fullName || log.admin.userName}</div>
                        <div className="muted">{log.admin.email}</div>
                      </>
                    ) : ''}
                  </td>
                  <td>{ACTION_LABELS[log.action] || log.action}</td>
                  <td>{DECISION_LABELS[log.decision] || log.decision || ''}</td>
                  <td className="category-desc-cell">{log.note || ''}</td>
                  <td>
                    {log.reservationId ? (
                      <Link className="detail-btn" to={`/reservations/${log.reservationId}`}>
                        Chi tiết
                      </Link>
                    ) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {pagination && pagination.totalPages > 1 ? (
          <div className="pagination-row">
            <span className="muted">
              Trang {pagination.page}/{pagination.totalPages} • {pagination.total} bản ghi
            </span>
            <div className="table-actions">
              <button
                type="button"
                disabled={pagination.page <= 1 || loading}
                onClick={() => setPage((current) => current - 1)}
              >
                Trước
              </button>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Sau
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
