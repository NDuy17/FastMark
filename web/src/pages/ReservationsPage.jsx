import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  getReservationStats,
  listReservations,
} from '../api/reservationAdminApi';
import DashboardDateRange from '../components/DashboardDateRange';
import { useAuth } from '../context/AuthContext';

const STATUS_LABELS = {
  0: 'Chờ shop xác nhận',
  1: 'Đã từ chối',
  2: 'Chờ nhận hàng',
  3: 'Hoàn thành',
  4: 'Tranh chấp',
  5: 'Tự hoàn thành',
  6: 'Đã hủy (hoàn cọc)',
  7: 'Đã hủy (tranh chấp)',
};

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: '0', label: STATUS_LABELS[0] },
  { value: '1', label: STATUS_LABELS[1] },
  { value: '2', label: STATUS_LABELS[2] },
  { value: '3', label: STATUS_LABELS[3] },
  { value: '4', label: STATUS_LABELS[4] },
  { value: '5', label: STATUS_LABELS[5] },
  { value: '6', label: STATUS_LABELS[6] },
  { value: '7', label: STATUS_LABELS[7] },
];

const TABS = [
  { value: 'all', label: 'Tất cả', tabParam: '', statsKey: 'total' },
  { value: 'waiting', label: 'Chờ nhận', tabParam: 'waiting_pickup', statsKey: 'waitingPickup' },
  {
    value: 'completed',
    label: 'Hoàn thành',
    tabParam: 'completed',
    statsKey: 'completedAll',
  },
  { value: 'disputes', label: 'Tranh chấp', tabParam: 'disputes', statsKey: 'disputed' },
  { value: 'cancelled', label: 'Đã hủy', tabParam: 'cancelled', statsKey: 'cancelled' },
];

const EMPTY_STATS = {
  total: 0,
  waitingPickup: 0,
  completed: 0,
  autoCompleted: 0,
  completedAll: 0,
  disputed: 0,
  refunded: 0,
  cancelled: 0,
};

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('vi-VN');
}

function formatPrice(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

function reservationStatusTone(status) {
  if (status === 0) return 'pending';
  if (status === 2) return 'waiting';
  if (status === 3 || status === 5) return 'done';
  if (status === 4) return 'dispute';
  if (status === 1 || status === 6 || status === 7) return 'cancelled';
  return 'neutral';
}

function resolveStatusLabel(item) {
  if (item?.statusLabel) return item.statusLabel;
  return STATUS_LABELS[item?.status] || 'Không rõ';
}

function normalizeTab(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (!value || value === 'all') return 'all';
  if (value === 'disputes' || value === 'dispute') return 'disputes';
  if (value === 'waiting' || value === 'waiting_pickup') return 'waiting';
  if (value === 'completed' || value === 'auto' || value === 'auto_completed') return 'completed';
  if (value === 'cancelled' || value === 'canceled') return 'cancelled';
  return 'all';
}

export default function ReservationsPage() {
  const { getIdToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = normalizeTab(searchParams.get('tab'));

  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [datePreset, setDatePreset] = useState('all');
  const [page, setPage] = useState(1);

  const activeTabConfig = useMemo(
    () => TABS.find((tab) => tab.value === activeTab) || TABS[0],
    [activeTab]
  );

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      const params = {
        search,
        page,
        limit: 20,
        dateFrom,
        dateTo,
      };
      if (activeTabConfig.tabParam) {
        params.tab = activeTabConfig.tabParam;
      } else if (status !== '') {
        params.status = status;
      }

      const [listPayload, statsPayload] = await Promise.all([
        listReservations(token, params),
        getReservationStats(token),
      ]);
      setItems(listPayload.data?.items || []);
      setPagination(
        listPayload.data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 }
      );
      const nextStats = statsPayload.data?.stats || EMPTY_STATS;
      setStats({
        ...EMPTY_STATS,
        ...nextStats,
        completedAll:
          nextStats.completedAll ??
          (Number(nextStats.completed) || 0) + (Number(nextStats.autoCompleted) || 0),
        cancelled:
          nextStats.cancelled ??
          (Number(nextStats.rejected) || 0) +
            (Number(nextStats.refunded) || 0) +
            (Number(nextStats.disputeResolved) || 0),
      });
    } catch (loadError) {
      setError(loadError.message || 'Không tải được danh sách đơn giữ hàng.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeTabConfig.tabParam, dateFrom, dateTo, getIdToken, page, search, status]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  function setTab(tabValue) {
    const next = normalizeTab(tabValue);
    const nextParams = new URLSearchParams(searchParams);
    if (next === 'all') {
      nextParams.delete('tab');
    } else {
      const config = TABS.find((tab) => tab.value === next);
      nextParams.set('tab', config?.tabParam || next);
    }
    setSearchParams(nextParams, { replace: true });
    setPage(1);
    if (next !== 'all') {
      setStatus('');
    }
  }

  return (
    <div className="page reservations-page">
      {error ? <p className="error-banner">{error}</p> : null}

      <div className="reservation-tabs">
        {TABS.map((tab) => {
          const count = Number(stats[tab.statsKey]) || 0;
          return (
            <button
              key={tab.value}
              type="button"
              className={`reservation-tab${activeTab === tab.value ? ' active' : ''}`}
              onClick={() => setTab(tab.value)}
            >
              <span>{tab.label}</span>
              <em>{count}</em>
            </button>
          );
        })}
      </div>

      <section className="filter-card">
        <form
          className="filter-form"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSearch(searchInput.trim());
          }}
        >
          <label className="filter-search">
            Tra cứu
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Mã đơn, khách hàng, gian hàng, lý do tranh chấp..."
            />
          </label>
          <button type="submit" className="primary-btn">
            Tìm
          </button>
        </form>
        <div className="filter-grid filter-grid-reservations">
          <label>
            Trạng thái
            <select
              value={status}
              disabled={activeTab !== 'all'}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="reservation-date-filter">
            <DashboardDateRange
              label="Thời gian"
              from={dateFrom}
              to={dateTo}
              preset={datePreset}
              allowAll
              onApply={(range) => {
                setDateFrom(range.from || '');
                setDateTo(range.to || '');
                setDatePreset(range.preset || 'custom');
                setPage(1);
              }}
            />
          </div>
        </div>
      </section>

      <section className="table-card">
        <div className="table-scroll">
          <table className="data-table catalog-table reservations-table">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Sản phẩm</th>
                <th>Người mua</th>
                <th>Người bán</th>
                <th>Tiền cọc</th>
                <th>Giờ nhận</th>
                <th>Ghi chú / tranh chấp</th>
                <th>Ngày tạo</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="table-empty">
                    Đang tải...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="table-empty">
                    Không có đơn giữ hàng.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.id}
                    className="clickable-row"
                    onClick={() => navigate(`/reservations/${item.id}`)}
                  >
                    <td>
                      <div className="cell-title mono-code">
                        {item.code || String(item.id).slice(-8).toUpperCase()}
                      </div>
                    </td>
                    <td>
                      <div className="cell-title">{item.product?.productName || ''}</div>
                    </td>
                    <td>
                      <div className="cell-title soft">
                        {item.buyer?.fullName || item.buyer?.userName || ''}
                      </div>
                      {item.buyer?.userName ? (
                        <div className="cell-sub">@{item.buyer.userName}</div>
                      ) : null}
                    </td>
                    <td>
                      <div className="cell-title soft">{item.shop?.shopName || ''}</div>
                    </td>
                    <td className="cell-price">{formatPrice(item.depositAmount)}</td>
                    <td>
                      <div className="cell-sub">{formatDate(item.pickupTime)}</div>
                    </td>
                    <td>
                      <div className="cell-sub">
                        {item.disputeReasonLabel ||
                          item.disputeReason ||
                          item.disputeDescription ||
                          item.cancelReason ||
                          ''}
                      </div>
                    </td>
                    <td>
                      <div className="cell-sub">{formatDate(item.createdAt)}</div>
                    </td>
                    <td>
                      <span
                        className={`rsv-status rsv-status-${reservationStatusTone(item.status)}`}
                      >
                        {resolveStatusLabel(item)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination-row">
          <span>
            Trang {pagination.page}/{pagination.totalPages} · {pagination.total} đơn
          </span>
          <div className="pagination-actions">
            <button
              type="button"
              className="ghost-btn"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Trước
            </button>
            <button
              type="button"
              className="ghost-btn"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Sau
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
