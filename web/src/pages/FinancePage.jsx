import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock3,
  Coins,
  HandCoins,
  Lock,
  RotateCcw,
  Send,
  Store,
  Users,
  Wallet,
} from 'lucide-react';

import { getFinanceOverview } from '../api/accountApi';
import DashboardDateRange, { presetDates } from '../components/DashboardDateRange';
import { useAuth } from '../context/AuthContext';
import { useAdminRealtimeRefresh } from '../hooks/useAdminRealtimeRefresh';
import { formatDate, formatDateDisplay } from '../utils/format';

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value) || 0);
}

function formatCurrency(value) {
  return `${formatNumber(value)} ₫`;
}

function MetricCard({ label, value, detail, icon: Icon, tone = 'green', active = false, onClick }) {
  function handleClick(event) {
    onClick?.(event);
    event.currentTarget.blur();
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      className={`dashboard-metric tone-${tone} clickable${active ? ' active' : ''}`}
    >
      <div className="dashboard-metric-head">
        <div className={`dashboard-metric-icon tone-${tone}`}>
          {Icon ? <Icon size={18} strokeWidth={2} aria-hidden="true" /> : null}
        </div>
        <div className="dashboard-metric-body">
          <span className="dashboard-metric-label">{label}</span>
          <div className="dashboard-metric-value">
            <strong>{value}</strong>
          </div>
          {detail ? <small className="dashboard-metric-detail">{detail}</small> : null}
        </div>
      </div>
    </button>
  );
}

const BALANCE_METRICS = [
  {
    key: 'allWallets',
    label: 'Tổng ví tất cả',
    icon: Wallet,
    tone: 'blue',
    value: (balances) =>
      (Number(balances.buyerWalletTotal) || 0) + (Number(balances.sellerWalletTotal) || 0),
    detail: (balances) =>
      `${formatNumber(
        (Number(balances.buyerWalletCount) || 0) + (Number(balances.sellerWalletCount) || 0)
      )} ví (buyer + seller)`,
  },
  {
    key: 'buyerWallets',
    label: 'Tổng ví người mua',
    icon: Users,
    tone: 'green',
    value: (balances) => balances.buyerWalletTotal,
    detail: (balances) => `${formatNumber(balances.buyerWalletCount)} ví`,
  },
  {
    key: 'sellerWallets',
    label: 'Tổng ví người bán',
    icon: Store,
    tone: 'purple',
    value: (balances) => balances.sellerWalletTotal,
    detail: (balances) => `${formatNumber(balances.sellerWalletCount)} ví`,
  },
  {
    key: 'escrow',
    label: 'Tiền treo escrow',
    icon: Lock,
    tone: 'orange',
    value: (balances) => balances.escrowBalance,
    detail: () => 'Cọc giữ hàng chưa quyết toán',
  },
  {
    key: 'pendingWithdraw',
    label: 'Rút tiền chờ duyệt',
    icon: Clock3,
    tone: 'red',
    value: (_, pendingWithdraw) => pendingWithdraw.total,
    detail: (_, pendingWithdraw) => `${formatNumber(pendingWithdraw.count)} yêu cầu`,
  },
];

const FLOW_METRICS = [
  {
    key: 'topup',
    label: 'Tổng nạp',
    icon: ArrowDownToLine,
    tone: 'green',
    value: (inRange) => inRange.topup?.total,
    detail: (inRange) => `${formatNumber(inRange.topup?.count)} giao dịch`,
  },
  {
    key: 'withdrawal',
    label: 'Tổng rút',
    icon: ArrowUpFromLine,
    tone: 'orange',
    value: (inRange) => inRange.withdrawal?.total,
    detail: (inRange) => `${formatNumber(inRange.withdrawal?.count)} giao dịch`,
  },
  {
    key: 'platformRevenue',
    label: 'Doanh thu nền tảng (gói)',
    icon: Coins,
    tone: 'blue',
    value: (inRange) => inRange.platformRevenue?.total,
    detail: (inRange) => `${formatNumber(inRange.platformRevenue?.count)} thanh toán`,
  },
  {
    key: 'depositHold',
    label: 'Cọc đã đặt',
    icon: HandCoins,
    tone: 'purple',
    value: (inRange) => inRange.depositHold?.total,
    detail: (inRange) => `${formatNumber(inRange.depositHold?.count)} lần`,
  },
  {
    key: 'depositRefund',
    label: 'Cọc hoàn buyer',
    icon: RotateCcw,
    tone: 'red',
    value: (inRange) => inRange.depositRefund?.total,
    detail: (inRange) => `${formatNumber(inRange.depositRefund?.count)} lần`,
  },
  {
    key: 'depositRelease',
    label: 'Cọc giải ngân seller',
    icon: Send,
    tone: 'green',
    value: (inRange) => inRange.depositRelease?.total,
    detail: (inRange) => `${formatNumber(inRange.depositRelease?.count)} lần`,
  },
];

const DETAIL_META = {
  allWallets: {
    title: 'Danh sách ví (buyer + seller)',
    empty: 'Không có ví nào.',
    columns: [
      {
        key: 'fullName',
        label: 'Tài khoản',
        render: (row) => (
          <div className="finance-account-cell">
            <span className="cell-title">{row.fullName || row.userName || ''}</span>
            {row.userName ? <span className="cell-sub">@{row.userName}</span> : null}
          </div>
        ),
      },
      { key: 'roleLabel', label: 'Vai trò' },
      { key: 'phone', label: 'SĐT', render: (row) => row.phone || '' },
      { key: 'email', label: 'Email', render: (row) => row.email || '' },
      {
        key: 'balance',
        label: 'Số dư',
        align: 'right',
        render: (row) => formatCurrency(row.balance),
      },
    ],
  },
  buyerWallets: {
    title: 'Ví người mua',
    empty: 'Không có ví người mua.',
    columns: [
      {
        key: 'fullName',
        label: 'Tài khoản',
        render: (row) => (
          <div className="finance-account-cell">
            <span className="cell-title">{row.fullName || row.userName || ''}</span>
            {row.userName ? <span className="cell-sub">@{row.userName}</span> : null}
          </div>
        ),
      },
      { key: 'phone', label: 'SĐT', render: (row) => row.phone || '' },
      { key: 'email', label: 'Email', render: (row) => row.email || '' },
      {
        key: 'balance',
        label: 'Số dư',
        align: 'right',
        render: (row) => formatCurrency(row.balance),
      },
    ],
  },
  sellerWallets: {
    title: 'Ví người bán',
    empty: 'Không có ví người bán.',
    columns: [
      {
        key: 'fullName',
        label: 'Tài khoản',
        render: (row) => (
          <div className="finance-account-cell">
            <span className="cell-title">{row.fullName || row.userName || ''}</span>
            {row.userName ? <span className="cell-sub">@{row.userName}</span> : null}
          </div>
        ),
      },
      { key: 'phone', label: 'SĐT', render: (row) => row.phone || '' },
      { key: 'email', label: 'Email', render: (row) => row.email || '' },
      {
        key: 'balance',
        label: 'Số dư',
        align: 'right',
        render: (row) => formatCurrency(row.balance),
      },
    ],
  },
  escrow: {
    title: 'Đơn cọc đang treo (chưa quyết toán)',
    empty: 'Không có đơn cọc đang treo.',
    columns: [
      {
        key: 'id',
        label: 'Đơn',
        render: (row) => (row.id ? String(row.id).slice(-8).toUpperCase() : ''),
      },
      { key: 'productName', label: 'Sản phẩm' },
      { key: 'shopName', label: 'Gian hàng' },
      { key: 'buyerName', label: 'Người mua' },
      { key: 'statusLabel', label: 'Trạng thái' },
      {
        key: 'depositAmount',
        label: 'Tiền cọc',
        align: 'right',
        render: (row) => formatCurrency(row.depositAmount),
      },
      {
        key: 'depositPaidAt',
        label: 'Đặt cọc',
        render: (row) => formatDate(row.depositPaidAt),
      },
    ],
  },
  pendingWithdraw: {
    title: 'Phiếu rút tiền chờ duyệt',
    empty: 'Không có phiếu rút đang chờ.',
    columns: [
      {
        key: 'id',
        label: 'Phiếu',
        render: (row) => (row.id ? String(row.id).slice(-8).toUpperCase() : ''),
      },
      { key: 'userName', label: 'Người rút', render: (row) => row.userName || '' },
      {
        key: 'bank',
        label: 'Ngân hàng',
        render: (row) =>
          [row.bankName, row.accountNumber].filter(Boolean).join(' · ') || '',
      },
      { key: 'accountName', label: 'Chủ TK', render: (row) => row.accountName || '' },
      {
        key: 'amount',
        label: 'Số tiền',
        align: 'right',
        render: (row) => formatCurrency(row.amount),
      },
      {
        key: 'createdAt',
        label: 'Tạo lúc',
        render: (row) => formatDate(row.createdAt),
      },
    ],
  },
  topup: {
    title: 'Giao dịch nạp tiền',
    empty: 'Không có giao dịch nạp trong khoảng đã chọn.',
    columns: txColumns(),
  },
  withdrawal: {
    title: 'Giao dịch rút tiền',
    empty: 'Không có giao dịch rút trong khoảng đã chọn.',
    columns: txColumns(),
  },
  platformRevenue: {
    title: 'Thanh toán gói / doanh thu nền tảng',
    empty: 'Không có thanh toán trong khoảng đã chọn.',
    columns: txColumns(),
  },
  depositHold: {
    title: 'Giao dịch đặt cọc',
    empty: 'Không có giao dịch đặt cọc trong khoảng đã chọn.',
    columns: txColumns({ showReservation: true }),
  },
  depositRefund: {
    title: 'Giao dịch hoàn cọc buyer',
    empty: 'Không có giao dịch hoàn cọc trong khoảng đã chọn.',
    columns: txColumns({ showReservation: true }),
  },
  depositRelease: {
    title: 'Giao dịch giải ngân cọc seller',
    empty: 'Không có giao dịch giải ngân trong khoảng đã chọn.',
    columns: txColumns({ showReservation: true }),
  },
};

function txColumns({ showReservation = false } = {}) {
  const cols = [
    {
      key: 'orderCode',
      label: 'Mã GD',
      render: (row) => row.orderCode || String(row.id).slice(-8).toUpperCase(),
    },
    { key: 'userName', label: 'Tài khoản', render: (row) => row.userName || '' },
    { key: 'roleLabel', label: 'Vai trò', render: (row) => row.roleLabel || '' },
    {
      key: 'description',
      label: 'Mô tả',
      render: (row) => row.description || row.typeLabel || '',
    },
    {
      key: 'amount',
      label: 'Số tiền',
      align: 'right',
      render: (row) => formatCurrency(row.amount),
    },
    {
      key: 'createdAt',
      label: 'Thời gian',
      render: (row) => formatDate(row.createdAt),
    },
  ];
  if (showReservation) {
    cols.splice(1, 0, {
      key: 'reservationId',
      label: 'Đơn',
      render: (row) =>
        row.reservationId ? String(row.reservationId).slice(-8).toUpperCase() : '',
    });
  }
  return cols;
}

function DetailField({ label, children }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children ?? ''}</dd>
    </div>
  );
}

function buildDetailFields(selectedKey, row) {
  if (!row) return [];

  if (
    selectedKey === 'allWallets' ||
    selectedKey === 'buyerWallets' ||
    selectedKey === 'sellerWallets'
  ) {
    return [
      { label: 'Họ tên', value: row.fullName || '' },
      { label: 'Username', value: row.userName ? `@${row.userName}` : '' },
      { label: 'Vai trò', value: row.roleLabel || '' },
      { label: 'SĐT', value: row.phone || '' },
      { label: 'Email', value: row.email || '' },
      { label: 'Số dư ví', value: formatCurrency(row.balance) },
      {
        label: 'Tài khoản',
        value: row.id ? <Link to={`/accounts/${row.id}`}>Xem trang tài khoản</Link> : '',
      },
    ];
  }

  if (selectedKey === 'escrow') {
    return [
      {
        label: 'Mã đơn',
        value: row.id ? (
          <Link to={`/reservations/${row.id}`}>{String(row.id).slice(-8).toUpperCase()}</Link>
        ) : (
          ''
        ),
      },
      { label: 'Sản phẩm', value: row.productName || '' },
      { label: 'Gian hàng', value: row.shopName || '' },
      { label: 'Người mua', value: row.buyerName || '' },
      { label: 'SĐT buyer', value: row.buyerPhone || '' },
      { label: 'Trạng thái', value: row.statusLabel || '' },
      { label: 'Số lượng', value: row.quantity ?? '' },
      { label: 'Đơn giá', value: row.reservedPrice != null ? formatCurrency(row.reservedPrice) : '' },
      { label: 'Tiền cọc', value: formatCurrency(row.depositAmount) },
      { label: 'Đặt cọc lúc', value: formatDate(row.depositPaidAt) },
      { label: 'Giờ nhận', value: formatDate(row.pickupTime) },
    ];
  }

  if (selectedKey === 'pendingWithdraw') {
    return [
      { label: 'Mã phiếu', value: row.id ? String(row.id).slice(-8).toUpperCase() : '' },
      { label: 'Người rút', value: row.userName || '' },
      { label: 'SĐT', value: row.userPhone || '' },
      { label: 'Email', value: row.userEmail || '' },
      { label: 'Ngân hàng', value: row.bankName || '' },
      { label: 'Mã NH', value: row.bankCode || '' },
      { label: 'Số tài khoản', value: row.accountNumber || '' },
      { label: 'Chủ tài khoản', value: row.accountName || '' },
      { label: 'Số tiền', value: formatCurrency(row.amount) },
      { label: 'Trạng thái', value: row.statusLabel || '' },
      { label: 'Tạo lúc', value: formatDate(row.createdAt) },
      {
        label: 'Danh sách rút',
        value: <Link to="/withdrawals">Mở trang rút tiền</Link>,
      },
    ];
  }

  // Giao dịch ví (nạp / rút / gói / cọc…)
  return [
    {
      label: 'Mã GD',
      value: row.orderCode || (row.id ? String(row.id).slice(-8).toUpperCase() : ''),
    },
    { label: 'Loại', value: row.typeLabel || '' },
    { label: 'Tài khoản', value: row.userName || '' },
    { label: 'Vai trò', value: row.roleLabel || '' },
    { label: 'SĐT', value: row.userPhone || '' },
    { label: 'Email', value: row.userEmail || '' },
    { label: 'Số tiền', value: formatCurrency(row.amount) },
    { label: 'Mô tả', value: row.description || '' },
    {
      label: 'Đơn liên quan',
      value: row.reservationId ? (
        <Link to={`/reservations/${row.reservationId}`}>
          {String(row.reservationId).slice(-8).toUpperCase()}
        </Link>
      ) : (
        ''
      ),
    },
    { label: 'Thời gian', value: formatDate(row.createdAt) },
  ];
}

function FinanceItemDialog({ selectedKey, row, onClose }) {
  if (!row) return null;
  const meta = DETAIL_META[selectedKey];
  const fields = buildDetailFields(selectedKey, row);

  return (
    <div className="dialog-overlay" role="presentation" onClick={onClose}>
      <div
        className="dialog-card dialog-card-wide finance-item-dialog"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header-row">
          <div>
            <h3>Chi tiết</h3>
            <p className="muted">{meta?.title || 'Mục tài chính'}</p>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Đóng
          </button>
        </div>
        <dl className="detail-list detail-list-grid">
          {fields.map((field) => (
            <DetailField key={field.label} label={field.label}>
              {field.value}
            </DetailField>
          ))}
        </dl>
      </div>
    </div>
  );
}

function DetailPanel({ selectedKey, rows }) {
  const meta = DETAIL_META[selectedKey];
  const [selectedRow, setSelectedRow] = useState(null);
  if (!meta) return null;
  const list = Array.isArray(rows) ? rows : [];

  return (
    <section className="table-card finance-detail-panel">
      <div className="finance-detail-head">
        <div>
          <h2>{meta.title}</h2>
          <p>
            {list.length
              ? `${formatNumber(list.length)} mục · bấm dòng hoặc Chi tiết để xem đầy đủ`
              : 'Không có dữ liệu'}
          </p>
        </div>
      </div>
      {list.length === 0 ? (
        <p className="empty-inline">{meta.empty}</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table finance-detail-table">
            <thead>
              <tr>
                {meta.columns.map((col) => (
                  <th
                    key={col.key}
                    className={col.align === 'right' ? 'col-right' : undefined}
                  >
                    {col.label}
                  </th>
                ))}
                <th className="col-actions">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {list.map((row) => (
                <tr
                  key={row.id}
                  className="clickable-row"
                  onClick={() => setSelectedRow(row)}
                >
                  {meta.columns.map((col) => (
                    <td
                      key={col.key}
                      className={col.align === 'right' ? 'col-right' : undefined}
                    >
                      {col.render ? col.render(row) : row[col.key] ?? ''}
                    </td>
                  ))}
                  <td className="col-actions">
                    <button
                      type="button"
                      className="detail-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedRow(row);
                      }}
                    >
                      Chi tiết
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedRow ? (
        <FinanceItemDialog
          selectedKey={selectedKey}
          row={selectedRow}
          onClose={() => setSelectedRow(null)}
        />
      ) : null}
    </section>
  );
}

export default function FinancePage() {
  const { getIdToken } = useAuth();
  const initial = useMemo(() => presetDates(1), []);
  const [preset, setPreset] = useState('today');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedKey, setSelectedKey] = useState(null);

  const toggleSelect = useCallback((key) => {
    setSelectedKey((prev) => (prev === key ? null : key));
  }, []);

  const load = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      const payload = await getFinanceOverview(token, { from, to });
      setData(payload.data || null);
    } catch (loadError) {
      setError(loadError.message || 'Không tải được dữ liệu tài chính.');
    } finally {
      setLoading(false);
    }
  }, [from, to, getIdToken]);

  useEffect(() => {
    load();
  }, [load]);

  useAdminRealtimeRefresh(['wallet', 'withdraw'], load);

  const balances = data?.balances || {};
  const inRange = data?.inRange || {};
  const pendingWithdraw = data?.pendingWithdraw || {};
  const details = data?.details || {};

  return (
    <div className="page dashboard-page finance-page">
      <section className="dashboard-toolbar">
        <DashboardDateRange
          from={from}
          to={to}
          preset={preset}
          onApply={(range) => {
            setPreset(range.preset);
            setFrom(range.from);
            setTo(range.to);
            setSelectedKey(null);
          }}
        />
        <span className="dashboard-updated">
          Dữ liệu đến {new Date().toLocaleString('vi-VN')}
        </span>
      </section>

      {error ? <div className="error-box">{error}</div> : null}
      {loading && !data ? (
        <div className="dashboard-skeleton">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="skeleton skeleton-card" />
          ))}
        </div>
      ) : null}

      {data ? (
        <>
          <section className="finance-section">
            <div className="finance-section-card">
              <div className="dashboard-section-heading">
                <h2>Số dư hiện tại</h2>
                <span>Bấm thẻ để xem chi tiết · bấm lại để ẩn</span>
              </div>
              <div className="dashboard-metric-grid finance-metric-grid--5">
                {BALANCE_METRICS.map((metric) => (
                  <MetricCard
                    key={metric.key}
                    label={metric.label}
                    icon={metric.icon}
                    tone={metric.tone}
                    value={formatCurrency(metric.value(balances, pendingWithdraw))}
                    detail={metric.detail(balances, pendingWithdraw)}
                    active={selectedKey === metric.key}
                    onClick={() => toggleSelect(metric.key)}
                  />
                ))}
              </div>
            </div>
          </section>

          <section className="finance-section">
            <div className="finance-section-card">
              <div className="dashboard-section-heading">
                <h2>Dòng tiền trong khoảng đã chọn</h2>
                <span>
                  {from === to
                    ? formatDateDisplay(from)
                    : `${formatDateDisplay(from)} → ${formatDateDisplay(to)}`}
                </span>
              </div>
              <div className="dashboard-metric-grid finance-metric-grid--3">
                {FLOW_METRICS.map((metric) => (
                  <MetricCard
                    key={metric.key}
                    label={metric.label}
                    icon={metric.icon}
                    tone={metric.tone}
                    value={formatCurrency(metric.value(inRange))}
                    detail={metric.detail(inRange)}
                    active={selectedKey === metric.key}
                    onClick={() => toggleSelect(metric.key)}
                  />
                ))}
              </div>
            </div>
          </section>

          {selectedKey ? (
            <DetailPanel selectedKey={selectedKey} rows={details[selectedKey]} />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
