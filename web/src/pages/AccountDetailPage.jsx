import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  blockAccount,
  getAccountDetail,
  getAccountFinance,
  getAccountHistory,
  unblockAccount,
} from '../api/accountApi';
import { getProductDetail } from '../api/catalogApi';
import { getReportDetail } from '../api/reportApi';
import { getReservationDetail } from '../api/reservationAdminApi';
import { EmptyState } from '../components/ui/Feedback';
import { useAuth } from '../context/AuthContext';
import { goBackOr } from '../utils/navigation';

function formatDate(value) {
  if (!value) {
    return '';
  }
  return new Date(value).toLocaleString('vi-VN');
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')} đ`;
}

function statusBadgeClass(status) {
  return status === 1 ? 'badge badge-success' : 'badge badge-danger';
}

function verificationBadgeClass(status) {
  if (status === 0) return 'badge badge-warning';
  if (status === 1) return 'badge badge-info';
  if (status === 2) return 'badge badge-danger';
  return 'badge';
}

function DetailSkeleton() {
  return (
    <div className="detail-grid">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="detail-card">
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line short" />
        </div>
      ))}
    </div>
  );
}

const HISTORY_TABS = [
  { id: 'wallet', label: 'Giao dịch ví' },
  { id: 'withdrawals', label: 'Rút tiền' },
  { id: 'products', label: 'Sản phẩm' },
  { id: 'reservations', label: 'Đơn đã đặt' },
  { id: 'shop-reservations', label: 'Đơn của shop' },
  { id: 'reports-filed', label: 'Báo cáo đã gửi' },
  { id: 'reports-received', label: 'Báo cáo bị nhận' },
  { id: 'reviews', label: 'Đánh giá đã viết' },
];

function txAmountClass(type) {
  // Nạp/hoàn/nhận cọc là tiền vào, còn lại là tiền ra.
  return [1, 3, 6, 7].includes(type) ? 'badge badge-success' : 'badge badge-warning';
}

function resolveMediaUrls(sources = [], fallback = '') {
  const fromList = sources
    .map((item) => (typeof item === 'string' ? item : item?.imageUrl || item?.url || ''))
    .filter(Boolean);
  if (fromList.length) return fromList;
  return fallback ? [fallback] : [];
}

function DetailField({ label, children }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children ?? ''}</dd>
    </div>
  );
}

function HistoryDetailDialog({ tab, item, detail, loading, error, onClose }) {
  if (!item) return null;

  const titleMap = {
    wallet: 'Chi tiết giao dịch ví',
    withdrawals: 'Chi tiết rút tiền',
    products: 'Chi tiết sản phẩm',
    reservations: 'Chi tiết đơn giữ hàng',
    'shop-reservations': 'Chi tiết đơn của shop',
    'reports-filed': 'Chi tiết báo cáo đã gửi',
    'reports-received': 'Chi tiết báo cáo bị nhận',
    reviews: 'Chi tiết đánh giá',
  };

  const product = detail || item;
  const reservation = detail?.reservation || detail || item;
  const report = detail || item;

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
            <h3>{titleMap[tab] || 'Chi tiết'}</h3>
            <p className="muted">ID: {item.id || ''}</p>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Đóng
          </button>
        </div>

        {error ? <p className="error-banner">{error}</p> : null}
        {loading ? (
          <div className="modal-loading">
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line short" />
            <div className="skeleton skeleton-line" />
          </div>
        ) : null}

        {!loading && tab === 'wallet' ? (
          <dl className="detail-list detail-list-grid">
            <DetailField label="Loại">
              <span className={txAmountClass(item.type)}>{item.typeLabel}</span>
            </DetailField>
            <DetailField label="Số tiền">{formatMoney(item.amount)}</DetailField>
            <DetailField label="Trạng thái">{item.statusLabel}</DetailField>
            <DetailField label="Số dư trước">
              {item.balanceBefore == null ? '' : formatMoney(item.balanceBefore)}
            </DetailField>
            <DetailField label="Số dư sau">
              {item.balanceAfter == null ? '' : formatMoney(item.balanceAfter)}
            </DetailField>
            <DetailField label="Mã đơn">{item.orderCode || ''}</DetailField>
            <DetailField label="Tham chiếu">
              {[item.referenceType, item.referenceId].filter(Boolean).join(' · ') || ''}
            </DetailField>
            <DetailField label="Reservation">{item.reservationId || ''}</DetailField>
            <DetailField label="Mô tả">{item.description || ''}</DetailField>
            <DetailField label="Thời gian">{formatDate(item.createdAt)}</DetailField>
          </dl>
        ) : null}

        {!loading && tab === 'withdrawals' ? (
          <dl className="detail-list detail-list-grid">
            <DetailField label="Số tiền">{formatMoney(item.amount)}</DetailField>
            <DetailField label="Trạng thái">{item.statusLabel}</DetailField>
            <DetailField label="Ngân hàng">
              {item.bankName}
              {item.bankCode ? ` (${item.bankCode})` : ''}
            </DetailField>
            <DetailField label="Số tài khoản">{item.accountNumber || ''}</DetailField>
            <DetailField label="Chủ tài khoản">{item.accountName || ''}</DetailField>
            <DetailField label="Ghi chú admin">{item.adminNote || ''}</DetailField>
            <DetailField label="Xử lý lúc">{formatDate(item.processedAt)}</DetailField>
            <DetailField label="Tạo lúc">{formatDate(item.createdAt)}</DetailField>
          </dl>
        ) : null}

        {!loading && tab === 'products' ? (
          <>
            <dl className="detail-list detail-list-grid">
              <DetailField label="Tên">{product.productName || item.productName || ''}</DetailField>
              <DetailField label="Danh mục">{product.categoryName || item.categoryName || ''}</DetailField>
              <DetailField label="Giá">
                {product.priceLabel ||
                  item.priceLabel ||
                  formatMoney(product.minPrice ?? item.minPrice)}
              </DetailField>
              <DetailField label="Đơn vị">{product.donVi || item.donVi || ''}</DetailField>
              <DetailField label="Trạng thái">
                {(product.status ?? item.status) === 1 ? 'Đang hiện' : 'Đã ẩn'}
              </DetailField>
              <DetailField label="Đã bán">{product.soldCount ?? item.soldCount ?? 0}</DetailField>
              <DetailField label="Lượt xem">{product.viewCount ?? item.viewCount ?? 0}</DetailField>
              <DetailField label="Lượt thích">{product.likeCount ?? item.likeCount ?? 0}</DetailField>
              <DetailField label="Yêu thích">{product.favoriteCount ?? ''}</DetailField>
              <DetailField label="Đơn giữ hàng">
                {product.reservationCount ?? 0} (hoàn thành {product.completedReservations ?? 0})
              </DetailField>
              <DetailField label="Gian hàng">
                {product.shopName || item.shopName || ''}
                {product.shopUsername || item.shopUsername
                  ? ` (@${product.shopUsername || item.shopUsername})`
                  : ''}
              </DetailField>
              <DetailField label="Tạo lúc">
                {formatDate(product.createdAt || item.createdAt)}
              </DetailField>
            </dl>
            {product.description || item.description ? (
              <p className="history-detail-desc">{product.description || item.description}</p>
            ) : null}
            <div className="history-variant-block">
              <h4>Phân loại / biến thể ({(product.variants || []).length})</h4>
              {(product.variants || []).length === 0 ? (
                <p className="muted">Chưa có biến thể.</p>
              ) : (
                <ul className="variant-list">
                  {(product.variants || []).map((variant) => (
                    <li key={variant.id}>
                      <strong>{variant.variantName || ''}</strong>
                      <span>
                        {formatMoney(variant.price)} · Tồn {variant.quantity ?? 0} · Đã bán{' '}
                        {variant.soldCount ?? 0}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {resolveMediaUrls(
              product.images || product.thumbnails || [],
              product.thumbnail || item.thumbnail
            ).length ? (
              <div className="image-grid account-verify-images">
                {resolveMediaUrls(
                  product.images || product.thumbnails || [],
                  product.thumbnail || item.thumbnail
                ).map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt="Ảnh sản phẩm" />
                  </a>
                ))}
              </div>
            ) : null}
          </>
        ) : null}

        {!loading && (tab === 'reservations' || tab === 'shop-reservations') ? (
          <>
            <dl className="detail-list detail-list-grid">
              <DetailField label="Trạng thái">
                {reservation.statusLabel || item.statusLabel}
              </DetailField>
              <DetailField label="Mã đơn">
                {reservation.code ||
                  reservation.orderCode ||
                  (item.id ? String(item.id).slice(-8).toUpperCase() : '')}
              </DetailField>
              <DetailField label="Sản phẩm">
                {reservation.product?.productName ||
                  reservation.product?.name ||
                  item.product?.name ||
                  ''}
              </DetailField>
              <DetailField label="Shop">
                {reservation.shopInfo?.shopName ||
                  reservation.shop?.shopName ||
                  reservation.shopName ||
                  item.shop?.shopName ||
                  ''}
              </DetailField>
              <DetailField label="Người bán">
                {reservation.seller?.fullName ||
                  reservation.seller?.userName ||
                  reservation.shopInfo?.fullName ||
                  ''}
              </DetailField>
              <DetailField label="Người mua">
                {reservation.buyer?.fullName ||
                  reservation.buyer?.userName ||
                  item.buyer?.fullName ||
                  item.buyer?.userName ||
                  ''}
              </DetailField>
              <DetailField label="Email buyer">
                {reservation.buyer?.email || item.buyer?.email || ''}
              </DetailField>
              <DetailField label="SĐT buyer">
                {reservation.buyer?.phone || ''}
              </DetailField>
              <DetailField label="Số lượng">{reservation.quantity ?? item.quantity}</DetailField>
              <DetailField label="Đơn giá">
                {formatMoney(reservation.reservedPrice ?? item.reservedPrice)}
              </DetailField>
              <DetailField label="Tổng tiền">
                {formatMoney(
                  reservation.totalPrice ??
                    item.totalPrice ??
                    (Number(reservation.reservedPrice || 0) *
                      Number(reservation.quantity || 0))
                )}
              </DetailField>
              <DetailField label="Cọc">
                {formatMoney(reservation.depositAmount ?? item.depositAmount)}
              </DetailField>
              <DetailField label="Ghi chú">{reservation.note || ''}</DetailField>
              <DetailField label="Lý do hủy">{reservation.cancelReason || ''}</DetailField>
              <DetailField label="Lý do tranh chấp">
                {reservation.disputeReasonLabel || reservation.disputeReason || ''}
              </DetailField>
              <DetailField label="Mô tả tranh chấp">
                {reservation.disputeDescription || ''}
              </DetailField>
              <DetailField label="Nhận hàng">
                {formatDate(reservation.pickupTime || item.pickupTime)}
              </DetailField>
              <DetailField label="Tranh chấp buyer">
                {reservation.disputeByBuyer || item.disputeByBuyer ? 'Có' : 'Không'}
              </DetailField>
              <DetailField label="Tranh chấp seller">
                {reservation.disputeBySeller || item.disputeBySeller ? 'Có' : 'Không'}
              </DetailField>
              <DetailField label="Tạo lúc">
                {formatDate(reservation.createdAt || item.createdAt)}
              </DetailField>
              <DetailField label="Hoàn thành">
                {formatDate(reservation.completedAt || item.completedAt)}
              </DetailField>
            </dl>
            {item.id ? (
              <div className="dialog-actions">
                <Link className="primary-btn" to={`/reservations/${item.id}`} onClick={onClose}>
                  Mở trang đơn đầy đủ
                </Link>
              </div>
            ) : null}
          </>
        ) : null}

        {!loading && (tab === 'reports-filed' || tab === 'reports-received') ? (
          <>
            <dl className="detail-list detail-list-grid">
              <DetailField label="Loại">{report.reportTypeLabel || item.reportTypeLabel}</DetailField>
              <DetailField label="Trạng thái">{report.statusLabel || item.statusLabel}</DetailField>
              <DetailField label="Vai trò người gửi">
                {report.reporterRoleLabel || item.reporterRoleLabel || ''}
              </DetailField>
              <DetailField label="Tiêu đề">{report.title || item.title || ''}</DetailField>
              <DetailField label="Lý do">{report.reasonLabel || ''}</DetailField>
              <DetailField label="Đơn liên quan">
                {report.reservationId || item.reservationId || ''}
              </DetailField>
              <DetailField label="Tạo lúc">
                {formatDate(report.createdAt || item.createdAt)}
              </DetailField>
              <DetailField label="Xử lý lúc">
                {formatDate(report.processedAt || item.processedAt)}
              </DetailField>
            </dl>
            <p className="history-detail-desc">{report.content || item.content || ''}</p>
            {resolveMediaUrls(report.evidenceImages || []).length ? (
              <div className="image-grid account-verify-images">
                {resolveMediaUrls(report.evidenceImages || []).map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt="Bằng chứng" />
                  </a>
                ))}
              </div>
            ) : null}
          </>
        ) : null}

        {!loading && tab === 'reviews' ? (
          <dl className="detail-list detail-list-grid">
            <DetailField label="Sản phẩm">{item.product?.name || ''}</DetailField>
            <DetailField label="Shop">{item.shop?.shopName || ''}</DetailField>
            <DetailField label="Số sao">{'★'.repeat(item.rating || 0) || ''}</DetailField>
            <DetailField label="Nội dung">{item.comment || ''}</DetailField>
            <DetailField label="Hiển thị">
              {item.isDeleted ? 'Đã xóa' : item.isHidden ? 'Đang ẩn' : 'Hiển thị'}
            </DetailField>
            <DetailField label="Thời gian">{formatDate(item.createdAt)}</DetailField>
          </dl>
        ) : null}
      </div>
    </div>
  );
}

function HistoryTable({ tab, items, onViewDetail }) {
  if (!items.length) {
    return <EmptyState title="Chưa có dữ liệu" description="Không có bản ghi nào trong mục này." />;
  }

  if (tab === 'wallet') {
    return (
      <table className="data-table">
        <thead>
          <tr>
            <th>Loại</th>
            <th>Số tiền</th>
            <th>Trạng thái</th>
            <th>Mô tả</th>
            <th>Số dư sau</th>
            <th>Thời gian</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((tx) => (
            <tr key={tx.id}>
              <td><span className={txAmountClass(tx.type)}>{tx.typeLabel}</span></td>
              <td><strong>{formatMoney(tx.amount)}</strong></td>
              <td>{tx.statusLabel}</td>
              <td className="category-desc-cell">{tx.description || ''}</td>
              <td>{tx.balanceAfter === null ? '' : formatMoney(tx.balanceAfter)}</td>
              <td>{formatDate(tx.createdAt)}</td>
              <td>
                <button type="button" className="detail-btn" onClick={() => onViewDetail(tx)}>
                  Chi tiết
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (tab === 'withdrawals') {
    return (
      <table className="data-table">
        <thead>
          <tr>
            <th>Số tiền</th>
            <th>Ngân hàng</th>
            <th>Tài khoản</th>
            <th>Trạng thái</th>
            <th>Ghi chú admin</th>
            <th>Thời gian</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id}>
              <td><strong>{formatMoney(row.amount)}</strong></td>
              <td>{row.bankName}{row.bankCode ? ` (${row.bankCode})` : ''}</td>
              <td>{row.accountNumber} — {row.accountName}</td>
              <td>{row.statusLabel}</td>
              <td className="category-desc-cell">{row.adminNote || ''}</td>
              <td>{formatDate(row.createdAt)}</td>
              <td>
                <button type="button" className="detail-btn" onClick={() => onViewDetail(row)}>
                  Chi tiết
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (tab === 'products') {
    return (
      <table className="data-table">
        <thead>
          <tr>
            <th />
            <th>Sản phẩm</th>
            <th>Giá</th>
            <th>Trạng thái</th>
            <th>Đã bán</th>
            <th>Thời gian</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id}>
              <td className="col-thumb">
                {row.thumbnail ? (
                  <img src={row.thumbnail} alt="" className="thumb-sm" />
                ) : (
                  <div className="thumb-sm thumb-fallback">SP</div>
                )}
              </td>
              <td>
                <div className="cell-title">{row.productName || ''}</div>
                <div className="cell-sub">{row.categoryName || 'Chưa có danh mục'}</div>
              </td>
              <td className="cell-price">{row.priceLabel || formatMoney(row.minPrice)}</td>
              <td>
                <span className={row.status === 1 ? 'badge badge-success' : 'badge badge-neutral'}>
                  {row.statusLabel || (row.status === 1 ? 'Đang hiện' : 'Đã ẩn')}
                </span>
              </td>
              <td>{row.soldCount || 0}</td>
              <td>{formatDate(row.createdAt)}</td>
              <td>
                <button type="button" className="detail-btn" onClick={() => onViewDetail(row)}>
                  Chi tiết
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (tab === 'reservations' || tab === 'shop-reservations') {
    return (
      <table className="data-table">
        <thead>
          <tr>
            <th>Sản phẩm</th>
            <th>{tab === 'reservations' ? 'Shop' : 'Người mua'}</th>
            <th>SL</th>
            <th>Tổng tiền</th>
            <th>Cọc</th>
            <th>Trạng thái</th>
            <th>Thời gian</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id}>
              <td>{row.product?.name || ''}</td>
              <td>
                {tab === 'reservations'
                  ? row.shop?.shopName || ''
                  : row.buyer?.fullName || row.buyer?.userName || ''}
              </td>
              <td>{row.quantity}</td>
              <td>{formatMoney(row.totalPrice)}</td>
              <td>{formatMoney(row.depositAmount)}</td>
              <td>{row.statusLabel}</td>
              <td>{formatDate(row.createdAt)}</td>
              <td>
                <button type="button" className="detail-btn" onClick={() => onViewDetail(row)}>
                  Chi tiết
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (tab === 'reports-filed' || tab === 'reports-received') {
    return (
      <table className="data-table">
        <thead>
          <tr>
            <th>Loại</th>
            <th>Tiêu đề</th>
            <th>Nội dung</th>
            <th>Trạng thái</th>
            <th>Thời gian</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id}>
              <td>{row.reportTypeLabel}</td>
              <td>{row.title || ''}</td>
              <td className="category-desc-cell">{row.content || ''}</td>
              <td>{row.statusLabel}</td>
              <td>{formatDate(row.createdAt)}</td>
              <td>
                <button type="button" className="detail-btn" onClick={() => onViewDetail(row)}>
                  Chi tiết
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Sản phẩm</th>
          <th>Shop</th>
          <th>Số sao</th>
          <th>Nội dung</th>
          <th>Hiển thị</th>
          <th>Thời gian</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {items.map((row) => (
          <tr key={row.id}>
            <td>{row.product?.name || ''}</td>
            <td>{row.shop?.shopName || ''}</td>
            <td>{'★'.repeat(row.rating)}</td>
            <td className="category-desc-cell">{row.comment || ''}</td>
            <td>{row.isDeleted ? 'Đã xóa' : row.isHidden ? 'Đang ẩn' : 'Hiển thị'}</td>
            <td>{formatDate(row.createdAt)}</td>
            <td>
              <button type="button" className="detail-btn" onClick={() => onViewDetail(row)}>
                Chi tiết
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AccountHistorySection({ accountId, getIdToken }) {
  const [tab, setTab] = useState('wallet');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const token = await getIdToken();
        const payload = await getAccountHistory(token, accountId, { tab, page, limit: 10 });
        if (!cancelled) {
          setData({
            items: payload.data?.items || [],
            pagination: payload.data?.pagination || null,
          });
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || 'Không tải được lịch sử.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [accountId, tab, page, getIdToken]);

  async function openDetail(item) {
    setSelected(item);
    setDetail(null);
    setDetailError('');

    const needsFetch =
      tab === 'products' ||
      tab === 'reservations' ||
      tab === 'shop-reservations' ||
      tab === 'reports-filed' ||
      tab === 'reports-received';

    if (!needsFetch || !item?.id) {
      return;
    }

    setDetailLoading(true);
    try {
      const token = await getIdToken();
      if (tab === 'products') {
        const payload = await getProductDetail(token, item.id);
        setDetail(payload.data?.product || null);
      } else if (tab === 'reservations' || tab === 'shop-reservations') {
        const payload = await getReservationDetail(token, item.id);
        setDetail(payload.data?.reservation || null);
      } else {
        const payload = await getReportDetail(token, item.id);
        setDetail(payload.data?.report || payload.data || null);
      }
    } catch (fetchError) {
      setDetailError(fetchError.message || 'Không tải được chi tiết.');
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setSelected(null);
    setDetail(null);
    setDetailError('');
    setDetailLoading(false);
  }

  const pagination = data.pagination;

  return (
    <section className="detail-card account-history-card">
      <h3>Lịch sử hoạt động</h3>
      <div className="detail-tabs">
        {HISTORY_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? 'active' : undefined}
            onClick={() => {
              setTab(item.id);
              setPage(1);
              closeDetail();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? <p className="error-banner">{error}</p> : null}
      {loading ? (
        <div className="skeleton skeleton-line" style={{ height: 120 }} />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <HistoryTable tab={tab} items={data.items} onViewDetail={openDetail} />
        </div>
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

      {selected ? (
        <HistoryDetailDialog
          tab={tab}
          item={selected}
          detail={detail}
          loading={detailLoading}
          error={detailError}
          onClose={closeDetail}
        />
      ) : null}
    </section>
  );
}

export default function AccountDetailPage() {
  const { accountId } = useParams();
  const navigate = useNavigate();
  const { getIdToken } = useAuth();

  const [account, setAccount] = useState(null);
  const [finance, setFinance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState('');
  const [confirmAction, setConfirmAction] = useState('');

  const loadAccount = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const token = await getIdToken();
      const [payload, financePayload] = await Promise.all([
        getAccountDetail(token, accountId),
        getAccountFinance(token, accountId).catch(() => null),
      ]);
      setAccount(payload.data?.account || null);
      setFinance(financePayload?.data?.finance || null);
    } catch (loadError) {
      setError(loadError.message || 'Không tải được chi tiết người dùng.');
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, [accountId, getIdToken]);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  useEffect(() => {
    if (!snackbar) {
      return undefined;
    }

    const timeoutId = setTimeout(() => setSnackbar(''), 3200);
    return () => clearTimeout(timeoutId);
  }, [snackbar]);

  async function handleStatusChange(action) {
    setActionLoading(true);
    setError('');

    try {
      const token = await getIdToken();
      const payload =
        action === 'block'
          ? await blockAccount(token, accountId)
          : await unblockAccount(token, accountId);

      setAccount(payload.data?.account || null);
      setSnackbar(payload.message || 'Cập nhật thành công.');
      setConfirmAction('');
    } catch (actionError) {
      setError(actionError.message || 'Không cập nhật được trạng thái tài khoản.');
    } finally {
      setActionLoading(false);
    }
  }

  const user = account?.user;
  const shop = account?.shop;
  const verification = account?.verification;
  const stats = account?.stats;
  const isActive = user?.status === 1;

  return (
    <div className="page account-detail-page">
      <header className="account-detail-toolbar">
        <button type="button" className="ghost-btn" onClick={() => goBackOr(navigate, '/accounts')}>
          ← Quay lại
        </button>
        <div className="header-actions">
          <button type="button" className="ghost-btn" onClick={loadAccount} disabled={loading || actionLoading}>
            Làm mới
          </button>
          {user ? (
            isActive ? (
              <button
                type="button"
                className="danger-btn"
                disabled={actionLoading}
                onClick={() => setConfirmAction('block')}
              >
                Khóa
              </button>
            ) : (
              <button
                type="button"
                className="approve-btn"
                disabled={actionLoading}
                onClick={() => setConfirmAction('unblock')}
              >
                Mở khóa
              </button>
            )
          ) : null}
        </div>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}
      {snackbar ? <div className="snackbar">{snackbar}</div> : null}

      {loading ? <DetailSkeleton /> : null}

      {!loading && user ? (
        <>
          <section className="detail-hero account-detail-hero">
            {user.avatar ? (
              <img src={user.avatar} alt="" className="detail-avatar" />
            ) : (
              <div className="detail-avatar placeholder">{user.userName?.charAt(0) || 'U'}</div>
            )}
            <div className="account-detail-hero-main">
              <div className="account-detail-hero-top">
                <h2>{user.fullName || ''}</h2>
                <div className="badge-row">
                  <span className="badge badge-neutral">{user.roleLabel}</span>
                  <span className={statusBadgeClass(user.status)}>{user.statusLabel}</span>
                  {verification ? (
                    <span className={verificationBadgeClass(verification.status)}>
                      {verification.statusLabel}
                    </span>
                  ) : null}
                </div>
              </div>
              <p>@{user.userName}</p>
            </div>
          </section>

          <section className="stats-grid account-stats-grid">
            <article className="stat-card">
              <strong>{stats?.totalProducts || 0}</strong>
              <span>Sản phẩm</span>
            </article>
            <article className="stat-card">
              <strong>{stats?.totalReservations || 0}</strong>
              <span>Đơn giữ hàng</span>
            </article>
            <article className="stat-card">
              <strong>{stats?.totalReportsReceived || 0}</strong>
              <span>Báo cáo nhận</span>
            </article>
            <article className="stat-card">
              <strong>{stats?.totalReviews || 0}</strong>
              <span>Đánh giá</span>
            </article>
            <article className="stat-card">
              <strong>{stats?.totalFollowers || 0}</strong>
              <span>Theo dõi</span>
            </article>
          </section>

          {finance ? (
            <section className="account-finance-block">
              <div className="dashboard-section-heading">
                <h2>Tài chính</h2>
                <span>Giao dịch ví thành công</span>
              </div>
              <div className="account-finance-grid">
                <article className="dashboard-metric tone-green">
                  <span>Số dư ví</span>
                  <strong>{formatMoney(finance.walletBalance)}</strong>
                </article>
                <article className="dashboard-metric">
                  <span>Tổng nạp</span>
                  <strong>{formatMoney(finance.totalTopup)}</strong>
                  <small>{finance.topupCount} GD</small>
                </article>
                <article className="dashboard-metric">
                  <span>Tổng rút</span>
                  <strong>{formatMoney(finance.totalWithdrawal)}</strong>
                  <small>
                    {finance.withdrawalCount} GD
                    {finance.pendingWithdrawCount
                      ? ` · ${finance.pendingWithdrawCount} chờ`
                      : ''}
                  </small>
                </article>
                <article className="dashboard-metric">
                  <span>Thanh toán gói</span>
                  <strong>{formatMoney(finance.totalPayment)}</strong>
                  <small>{finance.paymentCount} GD</small>
                </article>
                <article className="dashboard-metric tone-orange">
                  <span>Đã đặt cọc</span>
                  <strong>{formatMoney(finance.totalDepositHold)}</strong>
                  <small>{finance.depositHoldCount} lần</small>
                </article>
                <article className="dashboard-metric">
                  <span>Hoàn cọc</span>
                  <strong>{formatMoney(finance.totalDepositRefund)}</strong>
                  <small>{finance.depositRefundCount} lần</small>
                </article>
                <article className="dashboard-metric tone-blue">
                  <span>Nhận cọc</span>
                  <strong>{formatMoney(finance.totalDepositRelease)}</strong>
                  <small>{finance.depositReleaseCount} lần</small>
                </article>
                <article className="dashboard-metric">
                  <span>Hoàn tiền</span>
                  <strong>{formatMoney(finance.totalRefund)}</strong>
                  <small>{finance.refundCount} GD</small>
                </article>
              </div>
            </section>
          ) : null}

          <div className="detail-grid account-detail-grid">
            <article className="detail-card">
              <h3>Người dùng</h3>
              <dl className="detail-list">
                <div><dt>Email</dt><dd>{user.email || ''}</dd></div>
                <div><dt>SĐT</dt><dd>{user.phone || ''}</dd></div>
                <div><dt>Giới thiệu</dt><dd>{user.bio || ''}</dd></div>
                <div><dt>Tạo lúc</dt><dd>{formatDate(user.createdAt)}</dd></div>
                <div><dt>Cập nhật</dt><dd>{formatDate(user.updatedAt)}</dd></div>
                <div><dt>Hoạt động</dt><dd>{formatDate(user.lastActiveAt)}</dd></div>
              </dl>
            </article>

            {shop ? (
              <article className="detail-card">
                <h3>Cửa hàng</h3>
                <dl className="detail-list">
                  <div><dt>Tên</dt><dd>{shop.shopName || ''}</dd></div>
                  <div><dt>Username</dt><dd>{shop.shopUsername ? `@${shop.shopUsername}` : ''}</dd></div>
                  <div><dt>Địa chỉ</dt><dd>{shop.addressHeThong || shop.systemAddress || shop.address || ''}</dd></div>
                  <div><dt>SĐT</dt><dd>{shop.phone || ''}</dd></div>
                  <div><dt>Giờ mở</dt><dd>{shop.openTime || ''} - {shop.closeTime || ''}</dd></div>
                  <div>
                    <dt>Trạng thái</dt>
                    <dd>
                      <span className={statusBadgeClass(shop.status)}>{shop.statusLabel}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Thống kê</dt>
                    <dd>
                      ★ {shop.averageRating?.toFixed?.(1) || '0.0'} · {shop.totalProducts || 0} SP ·{' '}
                      {shop.followersCount || 0} theo dõi · {shop.soldCount || 0} bán
                    </dd>
                  </div>
                  <div><dt>Mô tả</dt><dd>{shop.description || ''}</dd></div>
                  {shop.id ? (
                    <div>
                      <dt>Chi tiết</dt>
                      <dd>
                        <Link className="detail-btn" to={`/shops/${shop.id}`}>
                          Chi tiết
                        </Link>
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </article>
            ) : null}

            {verification ? (
              <article className="detail-card detail-card-wide">
                <h3>Xác minh người bán</h3>
                <dl className="detail-list">
                  <div>
                    <dt>Trạng thái</dt>
                    <dd>
                      <span className={verificationBadgeClass(verification.status)}>
                        {verification.statusLabel}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>Địa chỉ ĐK</dt>
                    <dd>
                      {verification.addressHeThong ||
                        verification.systemAddress ||
                        verification.DiaChiHeThong ||
                        verification.address ||
                        ''}
                    </dd>
                  </div>
                  <div><dt>Ngày gửi</dt><dd>{formatDate(verification.submittedAt)}</dd></div>
                  <div><dt>Ngày duyệt</dt><dd>{formatDate(verification.approvedAt)}</dd></div>
                  <div><dt>Lý do từ chối</dt><dd>{verification.rejectionReason || ''}</dd></div>
                </dl>

                <div className="image-grid account-verify-images">
                  {verification.cccdFrontImage ? (
                    <a href={verification.cccdFrontImage} target="_blank" rel="noreferrer">
                      <img src={verification.cccdFrontImage} alt="CCCD mặt trước" />
                      <span>CCCD trước</span>
                    </a>
                  ) : null}
                  {verification.cccdBackImage ? (
                    <a href={verification.cccdBackImage} target="_blank" rel="noreferrer">
                      <img src={verification.cccdBackImage} alt="CCCD mặt sau" />
                      <span>CCCD sau</span>
                    </a>
                  ) : null}
                  {verification.selfieImage ? (
                    <a href={verification.selfieImage} target="_blank" rel="noreferrer">
                      <img src={verification.selfieImage} alt="Ảnh selfie" />
                      <span>Ảnh chân dung</span>
                    </a>
                  ) : null}
                </div>
              </article>
            ) : null}
          </div>

          <AccountHistorySection accountId={accountId} getIdToken={getIdToken} />
        </>
      ) : null}

      {!loading && !user ? (
        <div className="empty-card">
          Không tìm thấy người dùng.{' '}
          <button type="button" className="link-btn" onClick={() => goBackOr(navigate, '/accounts')}>
            Quay lại
          </button>
        </div>
      ) : null}

      {confirmAction ? (
        <div className="dialog-overlay" role="presentation" onClick={() => !actionLoading && setConfirmAction('')}>
          <div className="dialog-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h3>{confirmAction === 'block' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}</h3>
            <p>
              {confirmAction === 'block'
                ? 'Bạn có chắc chắn muốn khóa tài khoản này? Người dùng sẽ không thể đăng nhập và thao tác trên hệ thống.'
                : 'Bạn có chắc chắn muốn mở khóa tài khoản này?'}
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                className="ghost-btn"
                disabled={actionLoading}
                onClick={() => setConfirmAction('')}
              >
                Huỷ
              </button>
              <button
                type="button"
                className={confirmAction === 'block' ? 'danger-btn' : 'approve-btn'}
                disabled={actionLoading}
                onClick={() => handleStatusChange(confirmAction)}
              >
                {actionLoading ? 'Đang xử lý...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
