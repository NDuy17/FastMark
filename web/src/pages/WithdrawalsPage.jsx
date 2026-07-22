import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  approveAdminWithdraw,
  listAdminWithdraws,
  rejectAdminWithdraw,
} from '../api/bankApi';
import { useAuth } from '../context/AuthContext';

const TABS = [
  { id: 'pending', label: 'Chờ duyệt', status: '0' },
  { id: 'history', label: 'Lịch sử', status: '' },
];

const HISTORY_STATUS_FILTERS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: '1', label: 'Đã duyệt' },
  { value: '2', label: 'Từ chối' },
  { value: '0', label: 'Chờ duyệt' },
];

const PAGE_SIZE = 30;

function formatPrice(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

function formatTime(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('vi-VN');
  } catch {
    return '';
  }
}

function DetailField({ label, children }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children ?? ''}</dd>
    </div>
  );
}

function WithdrawDetailDialog({ item, onClose }) {
  if (!item) return null;
  return (
    <div className="dialog-overlay" role="presentation" onClick={onClose}>
      <div
        className="dialog-card dialog-card-wide history-detail-dialog"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header-row">
          <div>
            <h3>Chi tiết rút tiền</h3>
            <p className="muted">ID: {item.id || ''}</p>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Đóng
          </button>
        </div>
        <dl className="detail-list detail-list-grid">
          <DetailField label="Người rút">{item.userName || item.userId || ''}</DetailField>
          <DetailField label="SĐT">{item.userPhone || ''}</DetailField>
          <DetailField label="Email">{item.userEmail || ''}</DetailField>
          <DetailField label="Ngân hàng">
            {item.bankName}
            {item.bankCode ? ` (${item.bankCode})` : ''}
          </DetailField>
          <DetailField label="Số tài khoản">{item.accountNumber || ''}</DetailField>
          <DetailField label="Chủ tài khoản">{item.accountName || ''}</DetailField>
          <DetailField label="Số tiền">
            <strong>{formatPrice(item.amount)}</strong>
          </DetailField>
          <DetailField label="Trạng thái">{item.statusLabel || ''}</DetailField>
          <DetailField label="Ghi chú admin">{item.adminNote || ''}</DetailField>
          <DetailField label="Tạo lúc">{formatTime(item.createdAt)}</DetailField>
          <DetailField label="Xử lý lúc">{formatTime(item.processedAt)}</DetailField>
        </dl>
        {item.userId ? (
          <div className="dialog-actions" style={{ justifyContent: 'flex-start' }}>
            <Link className="detail-btn" to={`/accounts/${item.userId}`} onClick={onClose}>
              Chi tiết tài khoản
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function WithdrawalsPage() {
  const { getIdToken } = useAuth();
  const [tab, setTab] = useState('pending');
  const [historyStatus, setHistoryStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [actionId, setActionId] = useState('');
  const [selected, setSelected] = useState(null);

  const statusParam = useMemo(() => {
    if (tab === 'pending') return '0';
    return historyStatus;
  }, [tab, historyStatus]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      const payload = await listAdminWithdraws(token, {
        status: statusParam === '' ? undefined : statusParam,
        q: search || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setItems(payload.data?.items || []);
      setTotal(Number(payload.data?.total) || 0);
    } catch (loadError) {
      setError(loadError.message || 'Không tải được yêu cầu rút tiền.');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [from, getIdToken, page, search, statusParam, to]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  function switchTab(nextTab) {
    setTab(nextTab);
    setPage(1);
    setSuccessMessage('');
    if (nextTab === 'history' && historyStatus === '0') {
      setHistoryStatus('');
    }
  }

  function applyFilters(event) {
    event?.preventDefault?.();
    setSearch(searchInput.trim());
    setPage(1);
  }

  function clearFilters() {
    setSearchInput('');
    setSearch('');
    setFrom('');
    setTo('');
    setHistoryStatus('');
    setPage(1);
  }

  async function handleApprove(item) {
    const note = window.prompt('Ghi chú duyệt (tuỳ chọn):', '') ?? '';
    setActionId(item.id);
    setError('');
    try {
      const token = await getIdToken();
      await approveAdminWithdraw(token, item.id, { adminNote: note });
      setSuccessMessage(`Đã duyệt rút ${formatPrice(item.amount)}.`);
      await loadItems();
    } catch (approveError) {
      setError(approveError.message || 'Không duyệt được.');
    } finally {
      setActionId('');
    }
  }

  async function handleReject(item) {
    const note = window.prompt('Lý do từ chối (sẽ hiện trên app):', 'Thông tin tài khoản không hợp lệ');
    if (note === null) return;
    setActionId(item.id);
    setError('');
    try {
      const token = await getIdToken();
      await rejectAdminWithdraw(token, item.id, { adminNote: note });
      setSuccessMessage(`Đã từ chối và hoàn ${formatPrice(item.amount)} về ví.`);
      await loadItems();
    } catch (rejectError) {
      setError(rejectError.message || 'Không từ chối được.');
    } finally {
      setActionId('');
    }
  }

  return (
    <div className="page">
      <div className="page-header-row">
        <div>
          <h2>Rút tiền / Lịch sử</h2>
          <p className="muted">
            Duyệt yêu cầu đang chờ và tra cứu lịch sử đã xử lý.
          </p>
        </div>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}
      {successMessage ? <p className="success-banner">{successMessage}</p> : null}

      <div className="admin-tabs">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`admin-tab${tab === item.id ? ' active' : ''}`}
            onClick={() => switchTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className="filter-card">
        <form className="filter-grid" onSubmit={applyFilters}>
          <label>
            Tìm kiếm
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Tên, SĐT, email, STK, ngân hàng..."
            />
          </label>
          {tab === 'history' ? (
            <label>
              Trạng thái
              <select
                value={historyStatus}
                onChange={(event) => {
                  setHistoryStatus(event.target.value);
                  setPage(1);
                }}
              >
                {HISTORY_STATUS_FILTERS.map((item) => (
                  <option key={item.value || 'all'} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            Từ ngày
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label>
            Đến ngày
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
          <div className="action-row" style={{ alignItems: 'flex-end' }}>
            <button type="submit">Lọc</button>
            <button type="button" className="ghost-btn" onClick={clearFilters}>
              Xóa lọc
            </button>
          </div>
        </form>
      </section>

      <section className="table-card">
        <div className="table-toolbar" style={{ marginBottom: 10 }}>
          <strong>
            {tab === 'pending' ? 'Yêu cầu chờ duyệt' : 'Lịch sử rút tiền'} · {total} phiếu
          </strong>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>User</th>
              <th>Ngân hàng</th>
              <th>STK / Chủ TK</th>
              <th>Số tiền</th>
              <th>Trạng thái</th>
              <th>Xử lý lúc</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8}>Đang tải...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  {tab === 'pending'
                    ? 'Không có yêu cầu chờ duyệt.'
                    : 'Không có lịch sử rút tiền theo bộ lọc.'}
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td>{formatTime(item.createdAt)}</td>
                  <td>
                    <strong>{item.userName || item.userId}</strong>
                    <div className="muted">{item.userPhone || item.userEmail || ''}</div>
                  </td>
                  <td>
                    {item.bankName}
                    {item.bankCode ? ` (${item.bankCode})` : ''}
                  </td>
                  <td>
                    <div>{item.accountNumber}</div>
                    <div className="muted">{item.accountName}</div>
                  </td>
                  <td>
                    <strong>{formatPrice(item.amount)}</strong>
                  </td>
                  <td>
                    <span
                      className={
                        item.status === 1
                          ? 'badge badge-success'
                          : item.status === 2
                            ? 'badge badge-danger'
                            : 'badge badge-warning'
                      }
                    >
                      {item.statusLabel}
                    </span>
                    {item.adminNote ? <div className="muted">{item.adminNote}</div> : null}
                  </td>
                  <td>{formatTime(item.processedAt)}</td>
                  <td>
                    <div className="action-row">
                      <button
                        type="button"
                        className="detail-btn"
                        onClick={() => setSelected(item)}
                      >
                        Chi tiết
                      </button>
                      {item.status === 0 ? (
                        <>
                          <button
                            type="button"
                            disabled={actionId === item.id}
                            onClick={() => handleApprove(item)}
                          >
                            Duyệt
                          </button>
                          <button
                            type="button"
                            className="danger-btn"
                            disabled={actionId === item.id}
                            onClick={() => handleReject(item)}
                          >
                            Từ chối
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {totalPages > 1 ? (
          <div className="action-row" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="ghost-btn"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Trước
            </button>
            <span className="muted">
              Trang {page}/{totalPages}
            </span>
            <button
              type="button"
              className="ghost-btn"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              Sau
            </button>
          </div>
        ) : null}
      </section>

      {selected ? <WithdrawDetailDialog item={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
