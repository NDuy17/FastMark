import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { listSellerSubscriptions } from '../api/sellerPlanApi';
import { useAuth } from '../context/AuthContext';

function formatPrice(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

function formatDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('vi-VN');
  } catch {
    return '';
  }
}

function statusClass(status) {
  if (status === 1) return 'badge badge-success';
  if (status === 0) return 'badge badge-warning';
  if (status === 3) return 'badge badge-danger';
  return 'badge badge-neutral';
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
  const shopName =
    shop.shopName || seller.fullName || seller.userName || shop.description || '';
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
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

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
      });
      setItems(payload.data?.items || []);
    } catch (loadError) {
      setError(loadError.message || 'Không tải được danh sách subscription.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [getIdToken, status, search]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  return (
    <div className="page">
      {error ? <p className="error-banner">{error}</p> : null}

      <section className="filter-card">
        <div className="filter-grid">
          <label className="filter-search">
            Tìm kiếm
            <input
              placeholder="Tìm seller / gói..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label>
            Trạng thái
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Tất cả trạng thái</option>
              <option value="0">Chờ thanh toán</option>
              <option value="1">Đang hiệu lực</option>
              <option value="2">Hết hạn</option>
              <option value="3">Đã hủy</option>
            </select>
          </label>
        </div>
      </section>

      <section className="table-card">
        <table className="data-table finance-detail-table">
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
                    <div className="cell-title">
                      {row.shop?.shopName ||
                        row.seller?.fullName ||
                        row.shop?.description ||
                        ''}
                    </div>
                    <div className="cell-sub">
                      {row.shop?.addressHeThong ||
                        row.shop?.systemAddress ||
                        row.shop?.address ||
                        ''}
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
                    <button
                      type="button"
                      className="detail-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelected(row);
                      }}
                    >
                      Chi tiết
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {selected ? (
        <SubscriptionDetailDialog row={selected} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  );
}
