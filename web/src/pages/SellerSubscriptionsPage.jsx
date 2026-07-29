import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye } from 'lucide-react';

import { buildDashboardQuery, formatDashboardPeriodLabel, getAdminDashboard, isDashboardAllTime } from '../api/dashboardApi';
import { listSellerSubscriptions } from '../api/sellerPlanApi';
import AdminDateFilter from '../components/admin/AdminDateFilter';
import AdminFilterPanel from '../components/admin/AdminFilterPanel';
import DashboardDateRange from '../components/DashboardDateRange';
import TableIconActions from '../components/ui/TableIconActions';
import { useAuth } from '../context/AuthContext';
import { useDebouncedSearch } from '../hooks/useDebouncedSearch';
import { useAdminDateFilter } from '../hooks/useAdminDateFilter';
import { useAdminRealtimeRefresh } from '../hooks/useAdminRealtimeRefresh';
import { formatDate, formatDateDisplay, formatPrice } from '../utils/format';

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value) || 0);
}

function statusClass(status) {
  if (status === 1) return 'badge badge-success';
  if (status === 0) return 'badge badge-warning';
  if (status === 3) return 'badge badge-danger';
  return 'badge badge-neutral';
}

function CompactStat({ label, value }) {
  return (
    <article className="admin-compact-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}

function DetailField({ label, children }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children ?? ''}</dd>
    </div>
  );
}

function SubscriptionDetailDialog({ row, onClose }) {
  if (!row) return null;
  const seller = row.seller || {};
  const shop = row.shop || {};
  const shopName = shop.shopName || '';
  const phone = seller.phone || shop.phone || '';
  const transactionCode =
    row.orderCode != null && row.orderCode !== ''
      ? String(row.orderCode)
      : row.transactionId || row.paymentId || '';

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
            <h3>Chi tiết subscription</h3>
            <p className="muted">ID: {row.id || ''}</p>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Đóng
          </button>
        </div>

        <dl className="detail-list detail-list-grid">
          <DetailField label="Tên shop">{shopName}</DetailField>
          <DetailField label="SĐT">{phone}</DetailField>
          <DetailField label="Seller">
            {seller.fullName || seller.userName || ''}
          </DetailField>
          <DetailField label="Username">
            {seller.userName ? `@${seller.userName}` : ''}
          </DetailField>
          <DetailField label="Email">{seller.email || ''}</DetailField>
          <DetailField label="Địa chỉ shop">
            {shop.addressHeThong || shop.systemAddress || shop.address || ''}
          </DetailField>
          <DetailField label="Gói">{row.planName || row.plan?.name || ''}</DetailField>
          <DetailField label="Giá">{formatPrice(row.amount)}</DetailField>
          <DetailField label="Trạng thái">
            <span className={statusClass(row.status)}>{row.statusLabel || ''}</span>
          </DetailField>
          <DetailField label="Ngày mua">
            {formatDate(row.ngayMua || row.CreatedAt || row.createdAt || row.purchasedAt)}
          </DetailField>
          <DetailField label="Có hiệu lực">
            {formatDate(row.effectiveFrom || row.startDate)}
          </DetailField>
          <DetailField label="Hết hạn">
            {formatDate(row.expiresAt || row.endDate)}
          </DetailField>
          <DetailField label="Mã giao dịch">{transactionCode}</DetailField>
        </dl>

        <div className="dialog-actions" style={{ justifyContent: 'flex-start', gap: 8 }}>
          {row.shopId || shop.id ? (
            <Link
              className="detail-btn"
              to={`/shops/${row.shopId || shop.id}`}
              onClick={onClose}
            >
              Chi tiết shop
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function SellerSubscriptionsPage() {
  const { getIdToken } = useAuth();
  const {
    from,
    to,
    preset,
    applyRange: applyRevenueRange,
  } = useAdminDateFilter();
  const {
    from: historyFrom,
    to: historyTo,
    preset: historyPreset,
    applyRange: applyHistoryRange,
    queryParams: historyQueryParams,
  } = useAdminDateFilter();
  const [revenueData, setRevenueData] = useState(null);
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [revenueError, setRevenueError] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const { input: searchInput, debounced: search, setInput: setSearchInput } = useDebouncedSearch();
  const [selected, setSelected] = useState(null);

  const loadRevenue = useCallback(async () => {
    setRevenueLoading(true);
    setRevenueError('');
    try {
      const token = await getIdToken();
      const dashboard = await getAdminDashboard(token, buildDashboardQuery(from, to));
      setRevenueData(dashboard);
    } catch (loadError) {
      setRevenueError(loadError.message || 'Không tải được doanh thu gói.');
      setRevenueData(null);
    } finally {
      setRevenueLoading(false);
    }
  }, [from, to, getIdToken]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      const payload = await listSellerSubscriptions(token, {
        page: 1,
        limit: 50,
        status,
        search,
        ...historyQueryParams,
      });
      setItems(payload.data?.items || []);
    } catch (loadError) {
      setError(loadError.message || 'Không tải được danh sách subscription.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [getIdToken, historyFrom, historyQueryParams, historyTo, search, status]);

  useEffect(() => {
    loadRevenue();
  }, [loadRevenue]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useAdminRealtimeRefresh('subscription', () => {
    loadItems();
    loadRevenue();
  });

  const revenueCards = revenueData?.cards || {};
  const revenueAllTime = isDashboardAllTime(from, to);
  const periodLabel = formatDashboardPeriodLabel(from, to, formatDateDisplay);
  const planBreakdown = revenueAllTime
    ? revenueData?.rankings?.sellerPlansAllTime || []
    : revenueData?.rankings?.sellerPlansInRange || [];
  const revenueInRange = revenueAllTime
    ? revenueCards.sellerPlanRevenueAllTime
    : revenueCards.sellerPlanRevenueInRange;
  const soldInRange = revenueAllTime
    ? revenueCards.sellerPlansSoldAllTime
    : revenueCards.sellerPlansSoldInRange;

  return (
    <div className="page dashboard-page seller-subscriptions-page">
      {revenueError ? <p className="error-banner">{revenueError}</p> : null}

      <section className="table-card finance-detail-panel">
        <div className="finance-detail-head finance-detail-head--with-toolbar">
          <div>
            <h2>Doanh thu gói Seller</h2>
            <p>Thống kê doanh thu từ các lần mua gói bán hàng</p>
          </div>
          <DashboardDateRange
            from={from}
            to={to}
            preset={preset}
            allowAll
            onApply={(range) => applyRevenueRange(range)}
          />
        </div>

        {revenueLoading && !revenueData ? (
          <p className="muted">Đang tải doanh thu...</p>
        ) : (
          <>
            <div className="admin-stats-grid-4">
              <CompactStat
                label="Doanh thu từ trước đến nay"
                value={formatPrice(revenueCards.sellerPlanRevenueAllTime)}
              />
              <CompactStat
                label="Lượt mua từ trước đến nay"
                value={formatNumber(revenueCards.sellerPlansSoldAllTime)}
              />
              <CompactStat
                label="Doanh thu trong kỳ"
                value={formatPrice(revenueInRange)}
              />
              <CompactStat
                label="Lượt mua trong kỳ"
                value={formatNumber(soldInRange)}
              />
            </div>

            {planBreakdown.length > 0 ? (
              <div className="seller-plan-breakdown">
                <h3 className="seller-plan-breakdown-title">
                  Phân bổ theo kỳ
                  <span className="seller-plan-breakdown-period"> · {periodLabel}</span>
                </h3>
                <div className="seller-plan-breakdown-grid">
                  <div className="seller-plan-breakdown-row is-head">
                    <span>Gói</span>
                    <span>Lượt mua</span>
                    <span>Doanh thu</span>
                  </div>
                  {planBreakdown.map((row) => (
                    <div className="seller-plan-breakdown-row" key={row.planName}>
                      <span className="seller-plan-breakdown-name">{row.planName}</span>
                      <span className="seller-plan-breakdown-num">{formatNumber(row.count)}</span>
                      <span className="seller-plan-breakdown-revenue">
                        {formatPrice(row.revenue)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>

      {error ? <p className="error-banner">{error}</p> : null}

      <section className="table-card">
        <div className="finance-detail-head finance-detail-head--with-filters">
          <div>
            <h2>Lịch sử mua gói</h2>
            <p>Danh sách subscription seller đã mua</p>
          </div>
          <AdminFilterPanel
            layout="inline"
            searchValue={searchInput}
            onSearchChange={setSearchInput}
            searchPlaceholder="Tìm seller / gói..."
          >
            <label>
              Trạng thái
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">Tất cả trạng thái</option>
                <option value="1">Đang hiệu lực</option>
                <option value="2">Hết hạn</option>
              </select>
            </label>
            <AdminDateFilter
              from={historyFrom}
              to={historyTo}
              preset={historyPreset}
              onApply={(range) => applyHistoryRange(range)}
            />
          </AdminFilterPanel>
        </div>
        <div className="package-history-wrap table-scroll">
          <table className="data-table finance-detail-table package-history-table">
            <thead>
              <tr>
                <th>Seller</th>
                <th>Shop</th>
                <th>Gói</th>
                <th className="col-right">Giá</th>
                <th className="col-datetime">Ngày mua</th>
                <th className="col-datetime">Có hiệu lực</th>
                <th className="col-datetime">Hết hạn</th>
                <th className="col-status">Trạng thái</th>
                <th className="col-actions">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9}>Đang tải...</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9}>Chưa có subscription.</td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr
                    key={row.id}
                    className="clickable-row"
                    onClick={() => setSelected(row)}
                  >
                    <td>
                      <div className="cell-title">
                        {row.seller?.fullName || row.seller?.userName || ''}
                      </div>
                      <div className="cell-sub">{row.seller?.email || ''}</div>
                    </td>
                    <td>
                      <div className="cell-title">{row.shop?.shopName || ''}</div>
                      <div className="cell-sub">
                        {row.shop?.shopUsername ? `@${row.shop.shopUsername}` : ''}
                      </div>
                    </td>
                    <td>{row.planName}</td>
                    <td className="col-right">{formatPrice(row.amount)}</td>
                    <td className="col-datetime">
                      {formatDate(row.ngayMua || row.CreatedAt || row.createdAt || row.purchasedAt)}
                    </td>
                    <td className="col-datetime">{formatDate(row.effectiveFrom || row.startDate)}</td>
                    <td className="col-datetime">{formatDate(row.expiresAt || row.endDate)}</td>
                    <td className="col-status">
                      <span className={statusClass(row.status)}>{row.statusLabel}</span>
                    </td>
                    <td className="col-actions">
                      <TableIconActions
                        actions={[
                          {
                            icon: Eye,
                            label: 'Chi tiết subscription',
                            onClick: (event) => {
                              event.stopPropagation();
                              setSelected(row);
                            },
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected ? (
        <SubscriptionDetailDialog row={selected} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  );
}
