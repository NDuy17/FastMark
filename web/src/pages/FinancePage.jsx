import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { getFinanceOverview } from '../api/accountApi';
import DashboardDateRange, { presetDates } from '../components/DashboardDateRange';
import { useAuth } from '../context/AuthContext';

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value) || 0);
}

function formatCurrency(value) {
  return `${formatNumber(value)} ₫`;
}

function formatDateDisplay(value) {
  const [year, month, day] = String(value || '').split('-');
  return year && month && day ? `${day}-${month}-${year}` : value;
}

function formatDateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('vi-VN');
}

function MetricCard({ label, value, detail, active = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`dashboard-metric clickable${active ? ' active' : ''}`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </button>
  );
}

function LineChart({ data = [], color = '#076F32' }) {
  const width = 760;
  const height = 210;
  const padding = 28;
  const values = data.map((item) => Number(item.total) || 0);
  const max = Math.max(...values, 1);
  const stepX = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;
  const points = data.map((item, index) => {
    const x = padding + index * stepX;
    const y = height - padding - ((Number(item.total) || 0) / max) * (height - padding * 2);
    return `${x},${y}`;
  });

  if (!data.length) {
    return <p className="empty-inline">Không có giao dịch trong khoảng đã chọn.</p>;
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img">
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e2e8f0" />
      <polyline fill="none" stroke={color} strokeWidth="3" points={points.join(' ')} />
      {data.map((item, index) => {
        const [x, y] = points[index].split(',');
        return (
          <g key={`${item.date}-${index}`}>
            <circle cx={x} cy={y} r="4" fill={color} />
            {index === 0 || index === data.length - 1 || data.length <= 7 ? (
              <text x={x} y={height - 7} textAnchor="middle" fontSize="10" fill="#64748b">
                {item.date?.slice(5)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

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
        render: (row) => formatDateTime(row.depositPaidAt),
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
        render: (row) => formatDateTime(row.createdAt),
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
      render: (row) => formatDateTime(row.createdAt),
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
      { label: 'Đặt cọc lúc', value: formatDateTime(row.depositPaidAt) },
      { label: 'Giờ nhận', value: formatDateTime(row.pickupTime) },
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
      { label: 'Tạo lúc', value: formatDateTime(row.createdAt) },
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
    { label: 'Thời gian', value: formatDateTime(row.createdAt) },
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

  const balances = data?.balances || {};
  const inRange = data?.inRange || {};
  const pendingWithdraw = data?.pendingWithdraw || {};
  const series = data?.series || {};
  const details = data?.details || {};

  return (
    <div className="page dashboard-page">
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
          <section>
            <div className="dashboard-section-heading">
              <h2>Số dư hiện tại</h2>
              <span>Bấm thẻ để xem chi tiết · bấm lại để ẩn</span>
            </div>
            <div className="dashboard-metric-grid">
              <MetricCard
                label="Tổng ví tất cả"
                value={formatCurrency(
                  (Number(balances.buyerWalletTotal) || 0) +
                    (Number(balances.sellerWalletTotal) || 0)
                )}
                detail={`${formatNumber(
                  (Number(balances.buyerWalletCount) || 0) +
                    (Number(balances.sellerWalletCount) || 0)
                )} ví (buyer + seller)`}
                active={selectedKey === 'allWallets'}
                onClick={() => toggleSelect('allWallets')}
              />
              <MetricCard
                label="Tổng ví người mua"
                value={formatCurrency(balances.buyerWalletTotal)}
                detail={`${formatNumber(balances.buyerWalletCount)} ví`}
                active={selectedKey === 'buyerWallets'}
                onClick={() => toggleSelect('buyerWallets')}
              />
              <MetricCard
                label="Tổng ví người bán"
                value={formatCurrency(balances.sellerWalletTotal)}
                detail={`${formatNumber(balances.sellerWalletCount)} ví`}
                active={selectedKey === 'sellerWallets'}
                onClick={() => toggleSelect('sellerWallets')}
              />
              <MetricCard
                label="Tiền treo escrow"
                value={formatCurrency(balances.escrowBalance)}
                detail="Cọc giữ hàng chưa quyết toán"
                active={selectedKey === 'escrow'}
                onClick={() => toggleSelect('escrow')}
              />
              <MetricCard
                label="Rút tiền chờ duyệt"
                value={formatCurrency(pendingWithdraw.total)}
                detail={`${formatNumber(pendingWithdraw.count)} yêu cầu`}
                active={selectedKey === 'pendingWithdraw'}
                onClick={() => toggleSelect('pendingWithdraw')}
              />
            </div>
          </section>

          <section>
            <div className="dashboard-section-heading">
              <h2>Dòng tiền trong khoảng đã chọn</h2>
              <span>
                {from === to
                  ? formatDateDisplay(from)
                  : `${formatDateDisplay(from)} → ${formatDateDisplay(to)}`}
              </span>
            </div>
            <div className="dashboard-metric-grid">
              <MetricCard
                label="Tổng nạp"
                value={formatCurrency(inRange.topup?.total)}
                detail={`${formatNumber(inRange.topup?.count)} giao dịch`}
                active={selectedKey === 'topup'}
                onClick={() => toggleSelect('topup')}
              />
              <MetricCard
                label="Tổng rút"
                value={formatCurrency(inRange.withdrawal?.total)}
                detail={`${formatNumber(inRange.withdrawal?.count)} giao dịch`}
                active={selectedKey === 'withdrawal'}
                onClick={() => toggleSelect('withdrawal')}
              />
              <MetricCard
                label="Doanh thu nền tảng (gói)"
                value={formatCurrency(inRange.platformRevenue?.total)}
                detail={`${formatNumber(inRange.platformRevenue?.count)} thanh toán`}
                active={selectedKey === 'platformRevenue'}
                onClick={() => toggleSelect('platformRevenue')}
              />
              <MetricCard
                label="Cọc đã đặt"
                value={formatCurrency(inRange.depositHold?.total)}
                detail={`${formatNumber(inRange.depositHold?.count)} lần`}
                active={selectedKey === 'depositHold'}
                onClick={() => toggleSelect('depositHold')}
              />
              <MetricCard
                label="Cọc hoàn buyer"
                value={formatCurrency(inRange.depositRefund?.total)}
                detail={`${formatNumber(inRange.depositRefund?.count)} lần`}
                active={selectedKey === 'depositRefund'}
                onClick={() => toggleSelect('depositRefund')}
              />
              <MetricCard
                label="Cọc giải ngân seller"
                value={formatCurrency(inRange.depositRelease?.total)}
                detail={`${formatNumber(inRange.depositRelease?.count)} lần`}
                active={selectedKey === 'depositRelease'}
                onClick={() => toggleSelect('depositRelease')}
              />
            </div>
          </section>

          {selectedKey ? (
            <DetailPanel selectedKey={selectedKey} rows={details[selectedKey]} />
          ) : null}

          <div className="dashboard-grid">
            <section className="panel">
              <h2>Nạp tiền theo ngày</h2>
              <LineChart data={series.topup || []} />
            </section>
            <section className="panel">
              <h2>Rút tiền theo ngày</h2>
              <LineChart data={series.withdrawal || []} color="#f97316" />
            </section>
            <section className="panel">
              <h2>Doanh thu nền tảng theo ngày</h2>
              <LineChart data={series.platformRevenue || []} color="#2563eb" />
            </section>
            <section className="panel">
              <h2>Giải ngân cọc theo ngày</h2>
              <LineChart data={series.depositRelease || []} color="#9333ea" />
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
