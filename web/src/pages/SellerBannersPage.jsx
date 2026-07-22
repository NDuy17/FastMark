import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  approveSellerBanner,
  cancelSellerBanner,
  listSellerBanners,
  rejectSellerBanner,
} from '../api/sellerPlanApi';
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

function DetailField({ label, children }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children ?? ''}</dd>
    </div>
  );
}

function BannerDetailDialog({ row, onClose }) {
  if (!row) return null;
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
            <h3>Chi tiết banner</h3>
            <p className="muted">ID: {row.id || ''}</p>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Đóng
          </button>
        </div>
        <dl className="detail-list detail-list-grid">
          <DetailField label="Seller">
            {row.seller?.fullName || row.seller?.userName || ''}
          </DetailField>
          <DetailField label="Email">{row.seller?.email || ''}</DetailField>
          <DetailField label="Shop">
            {row.shop?.shopName || row.shop?.description || row.shopId || ''}
          </DetailField>
          <DetailField label="Gói">{row.planName || ''}</DetailField>
          <DetailField label="Đích đến">
            {row.targetTypeLabel || ''} {row.targetId ? `(${row.targetId})` : ''}
          </DetailField>
          <DetailField label="Giá">{formatPrice(row.amount)}</DetailField>
          <DetailField label="Ngày mua">{formatDate(row.ngayMua || row.createdAt)}</DetailField>
          <DetailField label="Bắt đầu">{formatDate(row.startDate) || 'Chưa duyệt'}</DetailField>
          <DetailField label="Kết thúc">{formatDate(row.endDate) || 'Chưa duyệt'}</DetailField>
          <DetailField label="Số click">{Number(row.clickCount) || 0}</DetailField>
          <DetailField label="Trạng thái">{row.lifecycleLabel || row.statusLabel || ''}</DetailField>
          <DetailField label="Lý do vi phạm">{row.violationReason || ''}</DetailField>
        </dl>
        {row.image ? (
          <div className="image-grid account-verify-images">
            <a href={row.image} target="_blank" rel="noreferrer">
              <img src={row.image} alt="Banner" />
            </a>
          </div>
        ) : null}
        <div className="dialog-actions" style={{ justifyContent: 'flex-start', gap: 8 }}>
          {row.seller?.id || row.sellerId ? (
            <Link
              className="detail-btn"
              to={`/accounts/${row.seller?.id || row.sellerId}`}
              onClick={onClose}
            >
              Chi tiết seller
            </Link>
          ) : null}
          {row.shopId ? (
            <Link className="detail-btn" to={`/shops/${row.shopId}`} onClick={onClose}>
              Chi tiết shop
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function SellerBannersPage() {
  const { getIdToken } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [filter, setFilter] = useState('pending');
  const [actionId, setActionId] = useState('');
  const [rejectId, setRejectId] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [selected, setSelected] = useState(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      const payload = await listSellerBanners(token, {
        page: 1,
        limit: 50,
        filter,
      });
      setItems(payload.data?.items || []);
    } catch (loadError) {
      setError(loadError.message || 'Không tải được danh sách banner.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [getIdToken, filter]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  async function handleApprove(banner) {
    const confirmed = window.confirm(
      `Duyệt treo banner "${banner.planName || 'banner'}"?\nHiệu lực sẽ tính từ lúc duyệt.`
    );
    if (!confirmed) return;
    setActionId(banner.id);
    setError('');
    setSuccessMessage('');
    try {
      const token = await getIdToken();
      await approveSellerBanner(token, banner.id);
      setSuccessMessage('Đã duyệt treo banner.');
      await loadItems();
    } catch (approveError) {
      setError(approveError.message || 'Không duyệt được banner.');
    } finally {
      setActionId('');
    }
  }

  async function handleReject(bannerId) {
    const reason = rejectReason.trim();
    if (!reason) {
      setError('Vui lòng nhập lý do từ chối.');
      return;
    }
    setActionId(bannerId);
    setError('');
    setSuccessMessage('');
    try {
      const token = await getIdToken();
      await rejectSellerBanner(token, bannerId, { reason });
      setSuccessMessage('Đã từ chối. Seller có thể sửa creative và gửi lại.');
      setRejectId('');
      setRejectReason('');
      await loadItems();
    } catch (rejectError) {
      setError(rejectError.message || 'Không từ chối được banner.');
    } finally {
      setActionId('');
    }
  }

  async function handleTakeDown(banner) {
    const isActive = banner.lifecycle === 'active';
    const confirmed = window.confirm(
      isActive
        ? `Gỡ treo banner "${banner.planName || 'banner'}" khỏi Home?\nBanner sẽ ngừng hiển thị ngay.`
        : `Hủy gói banner "${banner.planName || 'banner'}"?`
    );
    if (!confirmed) return;
    setActionId(banner.id);
    setError('');
    setSuccessMessage('');
    try {
      const token = await getIdToken();
      await cancelSellerBanner(token, banner.id);
      setSuccessMessage(isActive ? 'Đã gỡ treo banner.' : 'Đã hủy banner.');
      await loadItems();
    } catch (cancelError) {
      setError(cancelError.message || 'Không cập nhật được banner.');
    } finally {
      setActionId('');
    }
  }

  return (
    <div className="page">
      <section className="filter-card">
        <h2 style={{ margin: '0 0 4px' }}>Duyệt banner</h2>
        <p className="muted" style={{ margin: '0 0 12px' }}>
          Duyệt yêu cầu treo, quản lý banner đang hiển thị trên Home, và gỡ treo khi cần.
        </p>
        <div className="filter-grid">
          <label>
            Trạng thái
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="pending">Chờ duyệt treo</option>
              <option value="active">Đang treo (Home)</option>
              <option value="inactive">Chưa hoạt động</option>
              <option value="purchased">Chưa yêu cầu treo</option>
              <option value="rejected">Bị từ chối</option>
              <option value="expired">Đã hết hạn</option>
              <option value="cancelled">Đã hủy / gỡ</option>
              <option value="">Tất cả</option>
            </select>
          </label>
        </div>
        <div className="action-row" style={{ marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            className={filter === 'pending' ? 'approve-btn' : 'ghost-btn'}
            onClick={() => setFilter('pending')}
          >
            Chờ duyệt
          </button>
          <button
            type="button"
            className={filter === 'active' ? 'approve-btn' : 'ghost-btn'}
            onClick={() => setFilter('active')}
          >
            Đang treo
          </button>
          <button
            type="button"
            className={filter === 'inactive' ? 'approve-btn' : 'ghost-btn'}
            onClick={() => setFilter('inactive')}
          >
            Chưa hoạt động
          </button>
          <button
            type="button"
            className={filter === '' ? 'approve-btn' : 'ghost-btn'}
            onClick={() => setFilter('')}
          >
            Tất cả
          </button>
        </div>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}
      {successMessage ? <p className="success-banner">{successMessage}</p> : null}

      <section className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Seller / Shop</th>
              <th>Gói</th>
              <th>Creative</th>
              <th>Giá</th>
              <th>Ngày mua</th>
              <th>Hiệu lực</th>
              <th>Số click</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9}>Đang tải...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={9}>Không có banner trong bộ lọc này.</td></tr>
            ) : (
              items.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.seller?.fullName || row.seller?.userName || ''}</strong>
                    <div className="muted">{row.seller?.email || ''}</div>
                    <div className="muted">
                      {row.shop?.shopName || row.shop?.description || `shopId: ${row.shopId || ''}`}
                    </div>
                  </td>
                  <td>{row.planName || ''}</td>
                  <td className="review-content-cell">
                    <div className="muted">{row.targetTypeLabel || ''}</div>
                    {row.image ? (
                      <img src={row.image} alt="" className="review-image-thumb" />
                    ) : (
                      <span className="muted">Chưa có ảnh</span>
                    )}
                    {row.violationReason ? (
                      <div className="muted">Lý do: {row.violationReason}</div>
                    ) : null}
                  </td>
                  <td>{formatPrice(row.amount)}</td>
                  <td>{formatDate(row.ngayMua || row.createdAt)}</td>
                  <td>
                    {row.startDate || row.endDate ? (
                      <>
                        <div>{formatDate(row.startDate)}</div>
                        <div className="muted">→ {formatDate(row.endDate)}</div>
                      </>
                    ) : (
                      <span className="muted">Chưa duyệt</span>
                    )}
                  </td>
                  <td>
                    <strong style={{ fontSize: 16 }}>{Number(row.clickCount) || 0}</strong>
                    {row.lifecycle === 'active' ? (
                      <div className="muted">lượt Quan tâm</div>
                    ) : null}
                  </td>
                  <td>
                    <span
                      className={
                        row.lifecycle === 'active'
                          ? 'badge badge-success'
                          : row.lifecycle === 'pending'
                            ? 'badge badge-warning'
                            : row.lifecycle === 'rejected'
                              ? 'badge badge-danger'
                              : row.lifecycle === 'cancelled'
                                ? 'badge badge-warning'
                                : 'badge badge-neutral'
                      }
                    >
                      {row.lifecycleLabel || row.statusLabel}
                    </span>
                  </td>
                  <td>
                    <div className="action-row" style={{ flexWrap: 'wrap', gap: 6 }}>
                      <button type="button" className="detail-btn" onClick={() => setSelected(row)}>
                        Chi tiết
                      </button>
                      {row.lifecycle === 'pending' ? (
                        rejectId === row.id ? (
                          <div className="reject-inline">
                            <textarea
                              rows={2}
                              placeholder="Lý do từ chối (seller sửa rồi gửi lại)"
                              value={rejectReason}
                              onChange={(event) => setRejectReason(event.target.value)}
                            />
                            <div className="action-row">
                              <button
                                type="button"
                                className="danger-btn"
                                disabled={actionId === row.id}
                                onClick={() => handleReject(row.id)}
                              >
                                Xác nhận từ chối
                              </button>
                              <button
                                type="button"
                                className="ghost-btn"
                                onClick={() => {
                                  setRejectId('');
                                  setRejectReason('');
                                }}
                              >
                                Hủy
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="approve-btn"
                              disabled={actionId === row.id}
                              onClick={() => handleApprove(row)}
                            >
                              Duyệt treo
                            </button>
                            <button
                              type="button"
                              className="danger-btn"
                              disabled={actionId === row.id}
                              onClick={() => setRejectId(row.id)}
                            >
                              Từ chối
                            </button>
                          </>
                        )
                      ) : null}
                      {row.lifecycle === 'active' ? (
                        <button
                          type="button"
                          className="danger-btn"
                          disabled={actionId === row.id}
                          onClick={() => handleTakeDown(row)}
                        >
                          Gỡ treo
                        </button>
                      ) : null}
                      {row.lifecycle === 'purchased' ? (
                        <button
                          type="button"
                          className="ghost-btn"
                          disabled={actionId === row.id}
                          onClick={() => handleTakeDown(row)}
                        >
                          Hủy gói
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {selected ? <BannerDetailDialog row={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
