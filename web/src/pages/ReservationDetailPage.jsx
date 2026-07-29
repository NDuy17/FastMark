import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  getReservationDetail,
  refundReservation,
  releaseReservation,
} from '../api/reservationAdminApi';
import ReservationOrderProgress from '../components/admin/ReservationOrderProgress';
import { useAuth } from '../context/AuthContext';
import { useAdminOrderSocket } from '../hooks/useAdminOrderSocket';
import { goBackOr } from '../utils/navigation';
import { formatDate, formatDateActivity, formatDateTimeDetail, formatPrice } from '../utils/format';
import { formatReservationOrderCode } from '../utils/reservationOrderCode';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import { reverseGeocode } from '../utils/reverseGeocode';

const AUDIT_ACTION_LABELS = {
  ADMIN_REFUND_BUYER: 'Hoàn cọc cho người mua',
  ADMIN_RELEASE_SELLER: 'Giải phóng cọc cho người bán',
};

const DISPUTED_STATUS = 4;

function resolveListStatusMeta(status) {
  const value = Number(status);
  if (value === 3 || value === 5) {
    return { label: 'Hoàn thành', className: 'badge badge-success' };
  }
  if (value === 4) {
    return { label: 'Tranh chấp', className: 'badge badge-warning' };
  }
  if (value === 0 || value === 2) {
    return { label: 'Giữ hàng', className: 'badge badge-warning' };
  }
  return { label: 'Đã hủy', className: 'badge badge-danger' };
}

function DetailSkeleton() {
  return (
    <div className="reservation-order-layout">
      <div className="skeleton skeleton-card reservation-order-header-card" />
      <div className="reservation-order-cards">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="skeleton skeleton-card reservation-order-info-card" />
        ))}
      </div>
    </div>
  );
}

function DisputeGpsBlock({ latitude, longitude, storedAddress }) {
  const [resolvedAddress, setResolvedAddress] = useState(storedAddress || '');

  useEffect(() => {
    setResolvedAddress(storedAddress || '');
    if (storedAddress || latitude == null || longitude == null) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const label = await reverseGeocode(latitude, longitude);
      if (!cancelled && label) {
        setResolvedAddress(label);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [latitude, longitude, storedAddress]);

  return (
    <>
      <p className="cell-sub">
        GPS:{' '}
        {latitude != null && longitude != null ? (
          <a
            className="link-btn"
            href={`https://www.google.com/maps?q=${latitude},${longitude}`}
            target="_blank"
            rel="noreferrer"
          >
            {Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)}
          </a>
        ) : (
          ''
        )}
      </p>
      {resolvedAddress ? (
        <p className="cell-sub dispute-report-address">
          Địa chỉ:{' '}
          {latitude != null && longitude != null ? (
            <a
              className="link-btn"
              href={`https://www.google.com/maps?q=${latitude},${longitude}`}
              target="_blank"
              rel="noreferrer"
            >
              {resolvedAddress}
            </a>
          ) : (
            resolvedAddress
          )}
        </p>
      ) : latitude != null && longitude != null ? (
        <p className="cell-sub muted">Đang lấy địa chỉ…</p>
      ) : null}
    </>
  );
}

function PartyAvatar({ src, fallback }) {
  if (src) {
    return <img src={src} alt="" className="reservation-party-avatar" />;
  }
  return (
    <div className="reservation-party-avatar reservation-party-avatar--fallback">
      {String(fallback || '?').charAt(0).toUpperCase()}
    </div>
  );
}

function resolveUnitPrice(reservation) {
  const agreed = Number(reservation?.agreedPrice);
  const reserved = Number(reservation?.reservedPrice) || 0;
  if (Number.isFinite(agreed) && agreed > 0) {
    return agreed;
  }
  return reserved;
}

function resolveOriginalUnitPrice(reservation) {
  const variantPrice = Number(reservation?.variant?.price) || 0;
  const unitPrice = resolveUnitPrice(reservation);
  if (variantPrice > unitPrice) {
    return variantPrice;
  }
  const reserved = Number(reservation?.reservedPrice) || 0;
  if (reserved > unitPrice) {
    return reserved;
  }
  return 0;
}

function resolveDiscountPercent(originalPrice, unitPrice) {
  if (!originalPrice || originalPrice <= unitPrice) {
    return 0;
  }
  return Math.round(((originalPrice - unitPrice) / originalPrice) * 100);
}

function formatPickupTime(value) {
  const formatted = formatDateActivity(value);
  if (!formatted) return '—';
  return `${formatted.time} · ${formatted.day}`;
}

function OrderSummaryRow({ label, value, emphasize = false }) {
  return (
    <div className="reservation-order-summary-row">
      <span>{label}</span>
      <strong className={emphasize ? 'reservation-order-summary-emphasis' : undefined}>{value}</strong>
    </div>
  );
}

function OrderProductLine({ product, variant, quantity, unitPrice, originalUnitPrice, discountPercent, onOpenProduct }) {
  const thumb = resolveMediaUrl(
    product?.thumbnail || variant?.imageUrl || product?.thumbnails?.[0] || '',
  );
  const productName = product?.productName || '—';
  const variantName = variant?.variantName || '—';

  return (
    <div className="reservation-order-product-line">
      {thumb ? (
        <img src={thumb} alt="" className="reservation-order-product-thumb" />
      ) : (
        <span className="reservation-order-product-thumb reservation-order-product-thumb--placeholder">SP</span>
      )}
      <div className="reservation-order-product-body">
        <div className="reservation-order-product-name-row">
          {product?.id ? (
            <button type="button" className="link-btn link-btn-plain" onClick={onOpenProduct}>
              {productName}
            </button>
          ) : (
            <strong>{productName}</strong>
          )}
        </div>
        <p className="reservation-order-product-variant">Phân loại: {variantName}</p>
        <div className="reservation-order-product-price-row">
          {originalUnitPrice > unitPrice ? (
            <>
              <span className="reservation-order-price-original">{formatPrice(originalUnitPrice)}</span>
              <span>{formatPrice(unitPrice)}</span>
              {discountPercent > 0 ? (
                <span className="reservation-order-price-discount">Giảm {discountPercent}%</span>
              ) : null}
            </>
          ) : (
            <span>{formatPrice(unitPrice)}</span>
          )}
          <span className="reservation-order-product-qty">× {quantity || 0}</span>
        </div>
      </div>
    </div>
  );
}

export default function ReservationDetailPage() {
  const { reservationId } = useParams();
  const navigate = useNavigate();
  const { getIdToken } = useAuth();

  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      const payload = await getReservationDetail(token, reservationId);
      setReservation(payload.data?.reservation || null);
    } catch (loadError) {
      setError(loadError.message || 'Không tải được chi tiết đơn giữ hàng.');
      setReservation(null);
    } finally {
      setLoading(false);
    }
  }, [getIdToken, reservationId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleOrderUpdated = useCallback(
    (payload) => {
      if (!payload?.reservationId || String(payload.reservationId) !== String(reservationId)) {
        return;
      }
      loadDetail();
    },
    [loadDetail, reservationId]
  );

  useAdminOrderSocket({
    enabled: Boolean(reservationId),
    getIdToken,
    onOrderUpdated: handleOrderUpdated,
  });

  useEffect(() => {
    if (!message) return undefined;
    const timeoutId = setTimeout(() => setMessage(''), 3200);
    return () => clearTimeout(timeoutId);
  }, [message]);

  async function handleRefund() {
    if (
      !window.confirm(
        'Xác nhận hoàn cọc cho người mua? Tiền cọc sẽ được hoàn về ví buyer.'
      )
    ) {
      return;
    }
    const note = window.prompt('Ghi chú xử lý (tuỳ chọn):', 'Admin hoàn cọc cho người mua.');
    if (note === null) return;

    setActionLoading('refund');
    setError('');
    try {
      const token = await getIdToken();
      const payload = await refundReservation(token, reservationId, note);
      setReservation(payload.data?.reservation || null);
      setMessage(payload.message || 'Đã hoàn cọc cho người mua.');
    } catch (actionError) {
      setError(actionError.message || 'Không hoàn cọc được.');
    } finally {
      setActionLoading('');
    }
  }

  async function handleRelease() {
    if (
      !window.confirm(
        'Xác nhận giải phóng cọc cho người bán? Tiền cọc sẽ được chuyển vào ví seller.'
      )
    ) {
      return;
    }
    const note = window.prompt('Ghi chú xử lý (tuỳ chọn):', 'Admin giải phóng cọc cho người bán.');
    if (note === null) return;

    setActionLoading('release');
    setError('');
    try {
      const token = await getIdToken();
      const payload = await releaseReservation(token, reservationId, note);
      setReservation(payload.data?.reservation || null);
      setMessage(payload.message || 'Đã giải phóng cọc cho người bán.');
    } catch (actionError) {
      setError(actionError.message || 'Không giải phóng cọc được.');
    } finally {
      setActionLoading('');
    }
  }

  const buyer = reservation?.buyer;
  const seller = reservation?.seller;
  const shop = reservation?.shopInfo || reservation?.shop;
  const product = reservation?.product;
  const buyerStats = reservation?.buyerStats;
  const sellerStats = reservation?.sellerStats || reservation?.shopStats;
  const auditLogs = reservation?.auditLogs || [];
  const isDisputed = Number(reservation?.status) === DISPUTED_STATUS;

  const orderCode = formatReservationOrderCode(reservation);
  const statusMeta = resolveListStatusMeta(reservation?.status);
  const quantity = Number(reservation?.quantity) || 0;
  const unitPrice = resolveUnitPrice(reservation);
  const originalUnitPrice = resolveOriginalUnitPrice(reservation);
  const discountPercent = resolveDiscountPercent(originalUnitPrice, unitPrice);
  const subtotal = unitPrice * quantity;
  const depositAmount = Number(reservation?.depositAmount) || 0;
  const cashDueOnPickup = Math.max(0, subtotal - depositAmount);

  const sellerName =
    shop?.shopName || reservation?.shopName || seller?.fullName || '';
  const sellerNick = shop?.shopUsername || shop?.userName || seller?.userName || '';
  const sellerAvatar = shop?.avatar || seller?.avatar || '';
  const sellerAccountId = seller?.id || shop?.userId || '';
  const shopAddress = shop?.address || shop?.addressHeThong || shop?.systemAddress || '';

  const hasDisputeSection =
    isDisputed ||
    reservation?.disputeByBuyer ||
    reservation?.disputeBySeller ||
    reservation?.disputedAt ||
    (Array.isArray(reservation?.disputeReports) && reservation.disputeReports.length > 0);

  return (
    <div className="admin-detail-page reservation-detail-page reservation-order-page">
      <header className="admin-detail-toolbar reservation-order-toolbar no-print">
        <button
          type="button"
          className="ghost-btn"
          onClick={() => goBackOr(navigate, '/reservations')}
        >
          ← Quay lại
        </button>
        <div className="header-actions">
          <button
            type="button"
            className="ghost-btn"
            onClick={loadDetail}
            disabled={loading || Boolean(actionLoading)}
          >
            Làm mới
          </button>
          {isDisputed ? (
            <>
              <button
                type="button"
                className="danger-btn"
                disabled={Boolean(actionLoading)}
                onClick={handleRefund}
              >
                {actionLoading === 'refund' ? '...' : 'Hoàn cọc buyer'}
              </button>
              <button
                type="button"
                className="approve-btn"
                disabled={Boolean(actionLoading)}
                onClick={handleRelease}
              >
                {actionLoading === 'release' ? '...' : 'Giải phóng seller'}
              </button>
            </>
          ) : null}
        </div>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}
      {message ? <div className="snackbar">{message}</div> : null}

      {loading ? <DetailSkeleton /> : null}

      {!loading && !reservation ? (
        <section className="table-card">
          <p>Không tìm thấy đơn giữ hàng.</p>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => goBackOr(navigate, '/reservations')}
          >
            Quay lại
          </button>
        </section>
      ) : null}

      {!loading && reservation ? (
        <div className="reservation-order-layout">
          <section className="reservation-order-header-card">
            <div className="reservation-order-header-main">
              <div className="reservation-order-header-copy">
                <h1>Đơn hàng #{orderCode}</h1>
                <div className="reservation-order-header-meta">
                  <span>
                    <strong>Đặt lúc:</strong> {formatDateTimeDetail(reservation.createdAt)}
                  </span>
                  <span>
                    <strong>Cập nhật cuối:</strong> {formatDateTimeDetail(reservation.updatedAt)}
                  </span>
                </div>
              </div>
              <span className={`reservation-order-header-status ${statusMeta.className}`}>
                {statusMeta.label}
              </span>
            </div>
            <ReservationOrderProgress reservation={reservation} />
          </section>

          <div className="reservation-order-cards">
            <article className="reservation-order-info-card">
              <h2>Thông tin đơn hàng</h2>

              <OrderProductLine
                product={product}
                variant={reservation.variant}
                quantity={quantity}
                unitPrice={unitPrice}
                originalUnitPrice={originalUnitPrice}
                discountPercent={discountPercent}
                onOpenProduct={() =>
                  navigate(`/products?search=${encodeURIComponent(product?.productName || '')}`)
                }
              />

              <div className="reservation-order-summary">
                <OrderSummaryRow label="Tổng tiền hàng" value={formatPrice(subtotal)} />
                <OrderSummaryRow label="Tiền đặt cọc" value={formatPrice(depositAmount)} />
                <OrderSummaryRow
                  label="Giờ nhận hàng"
                  value={formatPickupTime(reservation.pickupTime)}
                />
                {reservation.note ? (
                  <div className="reservation-order-note-block">
                    <span className="reservation-order-note-label">Ghi chú</span>
                    <p className="reservation-order-note-text">{reservation.note}</p>
                  </div>
                ) : null}
              </div>

              <div className="reservation-order-total-row">
                <span>Thanh toán khi nhận hàng</span>
                <strong>{formatPrice(cashDueOnPickup)}</strong>
              </div>
            </article>

            <article className="reservation-order-info-card reservation-order-party-card">
              <h2>Người mua</h2>
              <div className="reservation-party-head">
                <PartyAvatar
                  src={buyer?.avatar}
                  fallback={buyer?.fullName || buyer?.userName || 'B'}
                />
                <div className="reservation-party-head-text">
                  <div className="reservation-party-name-row">
                    <strong>{buyer?.fullName || '—'}</strong>
                  </div>
                  <span className="reservation-party-handle">
                    {buyer?.userName ? `@${buyer.userName}` : '—'}
                  </span>
                </div>
                {buyer?.id ? (
                  <Link className="detail-btn reservation-party-link" to={`/accounts/${buyer.id}`}>
                    Chi tiết
                  </Link>
                ) : null}
              </div>
              <dl className="reservation-order-fields">
                <div>
                  <dt>Email</dt>
                  <dd>{buyer?.email || '—'}</dd>
                </div>
                <div>
                  <dt>SĐT</dt>
                  <dd>{buyer?.phone || '—'}</dd>
                </div>
              </dl>
              <div className="reservation-party-stats">
                <div>
                  <strong>{buyerStats?.totalReservations || 0}</strong>
                  <span>Tổng đơn đã mua</span>
                </div>
                <div>
                  <strong>{buyerStats?.successfulReservations || 0}</strong>
                  <span>Đơn hoàn thành</span>
                </div>
                <div>
                  <strong>{buyerStats?.previousDisputes || 0}</strong>
                  <span>Đơn tranh chấp</span>
                </div>
              </div>
            </article>

            <article className="reservation-order-info-card reservation-order-party-card">
              <h2>Người bán</h2>
              <div className="reservation-party-head">
                <PartyAvatar src={sellerAvatar} fallback={sellerNick || sellerName || 'S'} />
                <div className="reservation-party-head-text">
                  <div className="reservation-party-name-row">
                    <strong>{sellerName || '—'}</strong>
                  </div>
                  <span className="reservation-party-handle">
                    {sellerNick ? `@${sellerNick}` : '—'}
                  </span>
                </div>
                {sellerAccountId ? (
                  <Link
                    className="detail-btn reservation-party-link"
                    to={`/accounts/${sellerAccountId}`}
                  >
                    Chi tiết
                  </Link>
                ) : null}
              </div>
              <dl className="reservation-order-fields">
                <div>
                  <dt>SĐT shop</dt>
                  <dd>{seller?.phone || shop?.phone || '—'}</dd>
                </div>
                <div>
                  <dt>Địa chỉ shop</dt>
                  <dd>{shopAddress || '—'}</dd>
                </div>
              </dl>
              <div className="reservation-party-stats">
                <div>
                  <strong>{sellerStats?.totalReservations || 0}</strong>
                  <span>Tổng đơn đã bán</span>
                </div>
                <div>
                  <strong>{sellerStats?.completedOrders || 0}</strong>
                  <span>Đơn hoàn thành</span>
                </div>
                <div>
                  <strong>{sellerStats?.previousDisputes || 0}</strong>
                  <span>Đơn tranh chấp</span>
                </div>
              </div>
            </article>
          </div>

          {hasDisputeSection ? (
            <section className="reservation-order-info-card reservation-order-dispute-card">
              <h2>Tranh chấp</h2>

              {(reservation.disputeReports || []).map((report) => {
                const isSellerReport = report.reporterSide === 'seller';
                const title = isSellerReport
                  ? report.sellerTitle || report.title || 'Báo cáo seller'
                  : report.title || report.reasonLabel || 'Báo cáo buyer';
                const content = isSellerReport
                  ? report.sellerContent || report.content
                  : report.content;
                const lat = isSellerReport
                  ? report.sellerLatitude ?? report.latitude
                  : report.latitude;
                const lng = isSellerReport
                  ? report.sellerLongitude ?? report.longitude
                  : report.longitude;
                const address = isSellerReport
                  ? report.sellerAddress || report.address || ''
                  : report.address || '';
                return (
                  <div
                    key={report.id}
                    className={`dispute-report-card ${isSellerReport ? 'seller' : 'buyer'}`}
                  >
                    <strong>
                      {isSellerReport ? 'Seller' : 'Buyer'}: {title}
                    </strong>
                    <p>{content || ''}</p>
                    <DisputeGpsBlock
                      latitude={lat}
                      longitude={lng}
                      storedAddress={address}
                    />
                    <p className="cell-sub">{formatDate(report.createdAt)}</p>
                    {Array.isArray(report.images) && report.images.length ? (
                      <div className="dispute-report-images">
                        {report.images.map((image) => (
                          <a
                            key={image.id || image.imageUrl}
                            href={image.imageUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <img src={image.imageUrl} alt="evidence" />
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </section>
          ) : null}

          <section className="table-card reservation-audit-card">
            <h3>Nhật ký xử lý</h3>
            {auditLogs.length === 0 ? (
              <p className="cell-sub">Chưa có nhật ký xử lý.</p>
            ) : (
              <div className="table-scroll">
                <table className="data-table catalog-table">
                  <thead>
                    <tr>
                      <th>Thời gian</th>
                      <th>Hành động</th>
                      <th>Quyết định</th>
                      <th>Ghi chú</th>
                      <th>Admin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{formatDate(log.createdAt)}</td>
                        <td>{AUDIT_ACTION_LABELS[log.action] || log.action || ''}</td>
                        <td>{log.decision || ''}</td>
                        <td>{log.note || ''}</td>
                        <td>{log.adminId ? String(log.adminId).slice(-6) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
