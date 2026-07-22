import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  getReservationDetail,
  refundReservation,
  releaseReservation,
} from '../api/reservationAdminApi';
import { useAuth } from '../context/AuthContext';
import { goBackOr } from '../utils/navigation';
import { reverseGeocode } from '../utils/reverseGeocode';

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

const AUDIT_ACTION_LABELS = {
  ADMIN_REFUND_BUYER: 'Hoàn cọc cho người mua',
  ADMIN_RELEASE_SELLER: 'Giải phóng cọc cho người bán',
};

const DISPUTED_STATUS = 4;

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('vi-VN');
}

function formatPrice(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

function statusBadgeClass(status) {
  if (status === 0) return 'badge badge-warning';
  if (status === 1) return 'badge badge-danger';
  if (status === 2) return 'badge badge-info';
  if (status === 3) return 'badge badge-success';
  if (status === 4) return 'badge badge-danger';
  if (status === 5) return 'badge badge-neutral';
  if (status === 6) return 'badge badge-neutral';
  if (status === 7) return 'badge badge-danger';
  return 'badge';
}

function resolveStatusLabel(reservation) {
  if (reservation?.statusLabel) return reservation.statusLabel;
  return STATUS_LABELS[reservation?.status] || 'Không rõ';
}

function DetailSkeleton() {
  return (
    <div className="detail-grid">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="detail-card">
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line short" />
        </div>
      ))}
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

function buildTimeline(reservation) {
  const events = [
    { label: 'Tạo đơn giữ hàng', at: reservation.createdAt },
    { label: 'Shop xác nhận giữ hàng', at: reservation.sellerConfirmedAt || reservation.confirmedAt },
    { label: 'Giờ hẹn nhận hàng', at: reservation.pickupTime },
    { label: 'Mở tranh chấp', at: reservation.disputedAt, tone: 'danger' },
    { label: 'Hủy đơn', at: reservation.cancelledAt, tone: 'danger' },
    { label: 'Hoàn tất đơn', at: reservation.completedAt, tone: 'success' },
    { label: 'Quyết toán tiền cọc', at: reservation.depositSettledAt, tone: 'success' },
  ];

  return events
    .filter((event) => Boolean(event.at))
    .sort((left, right) => new Date(left.at) - new Date(right.at));
}

function ReservationTimeline({ reservation }) {
  const events = buildTimeline(reservation);
  if (!events.length) return null;

  return (
    <article className="detail-card">
      <h3>Tiến trình đơn hàng</h3>
      <ol className="order-timeline">
        {events.map((event, index) => (
          <li key={`${event.label}-${index}`} className={event.tone || ''}>
            <span className="timeline-dot" />
            <div>
              <strong>{event.label}</strong>
              <p>{formatDate(event.at)}</p>
            </div>
          </li>
        ))}
      </ol>
    </article>
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

  const orderCode =
    reservation?.code ||
    reservation?.orderCode ||
    (reservation?.id ? String(reservation.id).slice(-8).toUpperCase() : '');

  const sellerName =
    seller?.fullName ||
    shop?.fullName ||
    shop?.shopName ||
    reservation?.shopName ||
    '';
  const sellerNick =
    seller?.userName || shop?.userName || '';
  const sellerAccountId = seller?.id || shop?.userId || '';

  return (
    <div className="page reservation-detail-page">
      <header className="account-detail-toolbar">
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
          <button type="button" className="ghost-btn" onClick={() => goBackOr(navigate, '/reservations')}>
            Quay lại
          </button>
        </section>
      ) : null}

      {!loading && reservation ? (
        <>
          <section className="detail-hero reservation-detail-hero">
            <div className="account-detail-hero-main">
              <div className="account-detail-hero-top">
                <h2>{orderCode || 'Đơn giữ hàng'}</h2>
                <span className={statusBadgeClass(reservation.status)}>
                  {resolveStatusLabel(reservation)}
                </span>
              </div>
              <p>
                {product?.productName || 'Sản phẩm'}
                {reservation.variant?.variantName
                  ? ` · ${reservation.variant.variantName}`
                  : ''}
                {' · '}
                {formatPrice(reservation.reservedPrice)} × {reservation.quantity ?? 0}
                {' · Cọc '}
                {formatPrice(reservation.depositAmount)}
              </p>
            </div>
          </section>

          <div className="reservation-parties-grid">
            <article className="detail-card">
              <h3>Đơn hàng</h3>
              <dl className="detail-list">
                <div>
                  <dt>Sản phẩm</dt>
                  <dd>
                    {product?.id ? (
                      <button
                        type="button"
                        className="link-btn link-btn-plain"
                        onClick={() => navigate(`/products?search=${encodeURIComponent(product.productName || '')}`)}
                      >
                        {product.productName || ''}
                      </button>
                    ) : (
                      product?.productName || ''
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Phân loại</dt>
                  <dd>{reservation.variant?.variantName || ''}</dd>
                </div>
                <div>
                  <dt>SL / Giá</dt>
                  <dd>
                    {reservation.quantity ?? ''} · {formatPrice(reservation.reservedPrice)}
                    {reservation.agreedPrice != null &&
                    Number(reservation.agreedPrice) !== Number(reservation.reservedPrice)
                      ? ` → ${formatPrice(reservation.agreedPrice)}`
                      : ''}
                  </dd>
                </div>
                <div>
                  <dt>Cọc</dt>
                  <dd>{formatPrice(reservation.depositAmount)}</dd>
                </div>
                <div>
                  <dt>Giờ nhận</dt>
                  <dd>{formatDate(reservation.pickupTime)}</dd>
                </div>
                <div>
                  <dt>Ghi chú</dt>
                  <dd>{reservation.note || ''}</dd>
                </div>
                {reservation.cancelReason ? (
                  <div>
                    <dt>Lý do hủy</dt>
                    <dd>{reservation.cancelReason}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Thời gian</dt>
                  <dd>
                    Tạo {formatDate(reservation.createdAt)}
                    {reservation.completedAt
                      ? ` · HT ${formatDate(reservation.completedAt)}`
                      : ''}
                  </dd>
                </div>
              </dl>
            </article>

            <article className="detail-card party-card">
              <div className="party-card-head">
                <h3>Người mua</h3>
                {buyer?.id ? (
                  <Link className="detail-btn" to={`/accounts/${buyer.id}`}>
                    Chi tiết
                  </Link>
                ) : null}
              </div>
              <div className="party-identity">
                {buyer?.avatar ? (
                  <img src={buyer.avatar} alt="" className="thumb-sm" />
                ) : (
                  <div className="thumb-sm thumb-fallback">
                    {(buyer?.userName || buyer?.fullName || 'B').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="cell-title">{buyer?.fullName || ''}</div>
                  <div className="cell-sub">{buyer?.userName ? `@${buyer.userName}` : ''}</div>
                </div>
              </div>
              <dl className="detail-list">
                <div>
                  <dt>Email</dt>
                  <dd>{buyer?.email || ''}</dd>
                </div>
                <div>
                  <dt>SĐT</dt>
                  <dd>{buyer?.phone || ''}</dd>
                </div>
              </dl>
              <div className="party-stats">
                <span>
                  <strong>{buyerStats?.totalReservations || 0}</strong> đơn
                </span>
                <span>
                  <strong>{buyerStats?.successfulReservations || 0}</strong> OK
                </span>
                <span>
                  <strong>{buyerStats?.previousDisputes || 0}</strong> tranh chấp
                </span>
              </div>
            </article>

            <article className="detail-card party-card">
              <div className="party-card-head">
                <h3>Người bán</h3>
                {sellerAccountId ? (
                  <Link className="detail-btn" to={`/accounts/${sellerAccountId}`}>
                    Chi tiết
                  </Link>
                ) : null}
              </div>
              <div className="party-identity">
                {seller?.avatar || shop?.avatar ? (
                  <img src={seller?.avatar || shop?.avatar} alt="" className="thumb-sm" />
                ) : (
                  <div className="thumb-sm thumb-fallback">
                    {(sellerNick || sellerName || 'S').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="cell-title">{sellerName}</div>
                  <div className="cell-sub">{sellerNick ? `@${sellerNick}` : ''}</div>
                </div>
              </div>
              <dl className="detail-list">
                <div>
                  <dt>Email</dt>
                  <dd>{seller?.email || shop?.email || ''}</dd>
                </div>
                <div>
                  <dt>SĐT</dt>
                  <dd>{seller?.phone || shop?.phone || ''}</dd>
                </div>
                <div>
                  <dt>Địa chỉ</dt>
                  <dd>{shop?.address || ''}</dd>
                </div>
                {shop?.id ? (
                  <div>
                    <dt>Gian hàng</dt>
                    <dd>
                      <Link className="detail-btn" to={`/shops/${shop.id}`}>
                        Chi tiết
                      </Link>
                    </dd>
                  </div>
                ) : null}
              </dl>
              <div className="party-stats">
                <span>
                  <strong>{sellerStats?.totalReservations || 0}</strong> đơn
                </span>
                <span>
                  <strong>{sellerStats?.completedOrders || 0}</strong> HT
                </span>
                <span>
                  <strong>{sellerStats?.previousDisputes || 0}</strong> tranh chấp
                </span>
              </div>
            </article>
          </div>

          <div className="reservation-extra-grid">
            <ReservationTimeline reservation={reservation} />

            <article className="detail-card">
              <h3>Tranh chấp / Cọc</h3>
              <dl className="detail-list">
                <div>
                  <dt>Trạng thái</dt>
                  <dd>
                    {reservation.disputeByBuyer ||
                    reservation.disputeBySeller ||
                    reservation.disputedAt ||
                    isDisputed
                      ? 'Có tranh chấp'
                      : 'Không'}
                  </dd>
                </div>
                <div>
                  <dt>Lý do</dt>
                  <dd>
                    {reservation.disputeReasonLabel || reservation.disputeReason || ''}
                  </dd>
                </div>
                <div>
                  <dt>Mô tả</dt>
                  <dd>{reservation.disputeDescription || ''}</dd>
                </div>
                <div>
                  <dt>Báo cáo lúc</dt>
                  <dd>{formatDate(reservation.disputedAt)}</dd>
                </div>
                <div>
                  <dt>Quyết toán cọc</dt>
                  <dd>
                    {reservation.depositSettleToLabel ||
                      (Number(reservation.depositSettleTo) === 1
                        ? 'Hoàn người mua'
                        : Number(reservation.depositSettleTo) === 2
                          ? 'Giải ngân seller'
                          : 'Đang giữ')}
                    {reservation.depositSettledAt
                      ? ` · ${formatDate(reservation.depositSettledAt)}`
                      : ''}
                  </dd>
                </div>
              </dl>

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
                    <strong>{isSellerReport ? 'Seller' : 'Buyer'}: {title}</strong>
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
            </article>
          </div>

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
        </>
      ) : null}
    </div>
  );
}
