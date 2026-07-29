import { useCallback, useEffect, useState } from 'react';
import { Eye } from 'lucide-react';

import { apiRequest } from '../api/client';
import AdminDateFilter from '../components/admin/AdminDateFilter';
import AdminFilterPanel from '../components/admin/AdminFilterPanel';
import AdminPagination from '../components/admin/AdminPagination';
import { EmptyState } from '../components/ui/Feedback';
import TableIconActions from '../components/ui/TableIconActions';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_PAGE_SIZE } from '../constants/pagination';
import { useAdminDateFilter } from '../hooks/useAdminDateFilter';
import { formatDate } from '../utils/format';

const ACTION_LABELS = {
  ADMIN_REFUND_BUYER: 'Hoàn cọc cho người mua',
  ADMIN_RELEASE_SELLER: 'Giải ngân cọc cho người bán',
  ADMIN_REJECT_REPORT: 'Bác bỏ báo cáo',
};

const DECISION_LABELS = {
  buyer_win: 'Người mua thắng',
  seller_win: 'Người bán thắng',
};

export default function AuditLogPage() {
  const { getIdToken } = useAuth();
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [data, setData] = useState({ items: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const {
    from: dateFrom,
    to: dateTo,
    preset: datePreset,
    applyRange: applyDateRange,
    queryParams: dateQueryParams,
  } = useAdminDateFilter();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (action) params.set('action', action);
      Object.entries(dateQueryParams).forEach(([key, value]) => {
        params.set(key, value);
      });
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
  }, [action, dateFrom, dateQueryParams, dateTo, getIdToken, limit, page]);

  useEffect(() => {
    load();
  }, [load]);

  const pagination = data.pagination || {
    page,
    limit,
    total: data.items.length,
    totalPages: 1,
  };

  return (
    <div className="page">
      <section className="filter-card">
        <AdminFilterPanel showSearch={false}>
          <label>
            Thao tác
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
          </label>
          <AdminDateFilter
            from={dateFrom}
            to={dateTo}
            preset={datePreset}
            onApply={(range) => applyDateRange(range, () => setPage(1))}
          />
        </AdminFilterPanel>
      </section>

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
                  <td className="col-actions">
                    {log.reservationId ? (
                      <TableIconActions
                        actions={[
                          {
                            icon: Eye,
                            label: 'Chi tiết đơn',
                            to: `/reservations/${log.reservationId}`,
                          },
                        ]}
                      />
                    ) : (
                      ''
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="admin-pagination">
          <AdminPagination
            page={pagination.page}
            totalPages={pagination.totalPages || 1}
            total={pagination.total || 0}
            label="bản ghi"
            limit={limit}
            onLimitChange={(next) => {
              setLimit(next);
              setPage(1);
            }}
            loading={loading}
            onPageChange={setPage}
          />
        </div>
      </section>
    </div>
  );
}
