import { useCallback, useEffect, useState } from 'react';

import { getBroadcastHistory, sendSystemNotification } from '../api/notificationApi';
import { useAuth } from '../context/AuthContext';

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'buyer', label: 'Người mua' },
  { value: 'seller', label: 'Người bán' },
];

const AUDIENCE_LABELS = {
  buyer: 'Người mua',
  seller: 'Người bán',
  system: 'Tất cả',
};

const EMPTY_FORM = {
  title: '',
  content: '',
  audience: 'all',
};

export default function SystemNotification() {
  const { getIdToken } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState('');
  const [lastResult, setLastResult] = useState(null);
  const [history, setHistory] = useState({ items: [], pagination: null });
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const token = await getIdToken();
      const payload = await getBroadcastHistory(token, { page: historyPage, limit: 10 });
      setHistory({
        items: payload.data?.items || [],
        pagination: payload.data?.pagination || null,
      });
    } catch {
      // Lịch sử là phụ trợ; lỗi tải không chặn form gửi.
    } finally {
      setHistoryLoading(false);
    }
  }, [getIdToken, historyPage]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!snackbar) {
      return undefined;
    }

    const timeoutId = setTimeout(() => setSnackbar(''), 3200);
    return () => clearTimeout(timeoutId);
  }, [snackbar]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setLastResult(null);

    try {
      const token = await getIdToken();
      const payload = await sendSystemNotification(token, form);
      setSnackbar(payload.message || 'Đã gửi thông báo hệ thống thành công.');
      setLastResult(payload.data || null);
      setForm(EMPTY_FORM);
      loadHistory();
    } catch (submitError) {
      setError(submitError.message || 'Không gửi được thông báo hệ thống.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      {snackbar ? <p className="snackbar">{snackbar}</p> : null}
      {error ? <p className="error-banner">{error}</p> : null}

      <section className="category-form-card notification-form-card">
        <div className="category-form-header">
          <h2>Tạo thông báo mới</h2>
        </div>

        <form className="category-form notification-form" onSubmit={handleSubmit}>
          <label>
            Tiêu đề thông báo
            <input
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
              placeholder="VD: Bảo trì hệ thống, Cập nhật chính sách..."
              required
            />
          </label>

          <label>
            Nội dung thông báo
            <textarea
              rows={6}
              value={form.content}
              onChange={(event) => updateField('content', event.target.value)}
              placeholder="Nhập nội dung chi tiết gửi tới người dùng..."
              required
            />
          </label>

          <label>
            Đối tượng nhận
            <select
              value={form.audience}
              onChange={(event) => updateField('audience', event.target.value)}
            >
              {AUDIENCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" className="primary-btn notification-submit-btn" disabled={loading}>
            {loading ? 'Đang gửi...' : 'Gửi thông báo toàn hệ thống'}
          </button>
        </form>
      </section>

      {lastResult ? (
        <section className="detail-card detail-card-wide">
          <h3>Kết quả gửi gần nhất</h3>
          <dl className="detail-list">
            <div><dt>Đối tượng</dt><dd>{lastResult.audienceLabel}</dd></div>
            <div><dt>Số người nhận</dt><dd>{lastResult.recipientCount}</dd></div>
            <div><dt>Thông báo in-app</dt><dd>{lastResult.inAppCount}</dd></div>
            <div><dt>Thời gian gửi</dt><dd>{new Date(lastResult.sentAt).toLocaleString('vi-VN')}</dd></div>
          </dl>
        </section>
      ) : null}

      <section className="table-card">
        <header className="category-form-header">
          <h2>Lịch sử gửi thông báo</h2>
          <button type="button" className="ghost-btn" onClick={loadHistory} disabled={historyLoading}>
            Làm mới
          </button>
        </header>
        {historyLoading ? (
          <div className="skeleton skeleton-line" style={{ height: 90 }} />
        ) : history.items.length === 0 ? (
          <p className="empty-inline">Chưa có thông báo nào được gửi.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Tiêu đề</th>
                <th>Nội dung</th>
                <th>Đối tượng</th>
                <th>Người nhận</th>
                <th>Đã đọc</th>
              </tr>
            </thead>
            <tbody>
              {history.items.map((item, index) => (
                <tr key={`${item.sentAt}-${index}`}>
                  <td>{item.sentAt ? new Date(item.sentAt).toLocaleString('vi-VN') : ''}</td>
                  <td>{item.title || ''}</td>
                  <td className="category-desc-cell">{item.content || ''}</td>
                  <td>{AUDIENCE_LABELS[item.audience] || item.audience || ''}</td>
                  <td>{item.recipientCount}</td>
                  <td>{item.readCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {history.pagination && history.pagination.totalPages > 1 ? (
          <div className="pagination-row">
            <span className="muted">
              Trang {history.pagination.page}/{history.pagination.totalPages}
            </span>
            <div className="table-actions">
              <button
                type="button"
                disabled={history.pagination.page <= 1 || historyLoading}
                onClick={() => setHistoryPage((current) => current - 1)}
              >
                Trước
              </button>
              <button
                type="button"
                disabled={history.pagination.page >= history.pagination.totalPages || historyLoading}
                onClick={() => setHistoryPage((current) => current + 1)}
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
