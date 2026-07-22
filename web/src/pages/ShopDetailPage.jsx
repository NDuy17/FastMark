import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  blockShop,
  getProductDetail,
  getShopDetail,
  unblockShop,
} from '../api/catalogApi';
import { useAuth } from '../context/AuthContext';
import { goBackOr } from '../utils/navigation';

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('vi-VN');
}

function formatPrice(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')} đ`;
}

function statusBadgeClass(status) {
  return status === 1 ? 'badge badge-success' : 'badge badge-danger';
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

export default function ShopDetailPage() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const { getIdToken } = useAuth();
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productLoading, setProductLoading] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      const payload = await getShopDetail(token, shopId);
      setShop(payload.data?.shop || null);
    } catch (loadError) {
      setError(loadError.message || 'Không tải được chi tiết gian hàng.');
      setShop(null);
    } finally {
      setLoading(false);
    }
  }, [getIdToken, shopId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  async function toggleLock() {
    if (!shop) return;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const token = await getIdToken();
      const payload =
        shop.status === 1 ? await blockShop(token, shop.id) : await unblockShop(token, shop.id);
      setShop(payload.data?.shop || shop);
      setMessage(shop.status === 1 ? 'Đã khóa gian hàng.' : 'Đã mở khóa gian hàng.');
    } catch (actionError) {
      setError(actionError.message || 'Thao tác thất bại.');
    } finally {
      setBusy(false);
    }
  }

  async function openProductDetail(productId) {
    setProductLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      const payload = await getProductDetail(token, productId);
      setSelectedProduct(payload.data?.product || null);
    } catch (detailError) {
      setError(detailError.message || 'Không tải được chi tiết sản phẩm.');
    } finally {
      setProductLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="page shop-detail-page">
        <DetailSkeleton />
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="page shop-detail-page">
        <p className="error-banner">{error || 'Không tìm thấy gian hàng.'}</p>
        <button type="button" className="ghost-btn" onClick={() => goBackOr(navigate, '/shops')}>
          ← Quay lại
        </button>
      </div>
    );
  }

  const owner = shop.owner;

  return (
    <div className="page shop-detail-page">
      <header className="account-detail-toolbar">
        <button type="button" className="ghost-btn" onClick={() => goBackOr(navigate, '/shops')}>
          ← Quay lại
        </button>
        <div className="header-actions">
          <button type="button" className="ghost-btn" onClick={loadDetail} disabled={busy}>
            Làm mới
          </button>
          <button
            type="button"
            className={shop.status === 1 ? 'danger-btn' : 'approve-btn'}
            onClick={toggleLock}
            disabled={busy}
          >
            {shop.status === 1 ? 'Khóa gian hàng' : 'Mở khóa'}
          </button>
        </div>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}
      {message ? <p className="success-banner">{message}</p> : null}

      <section className="detail-hero account-detail-hero">
        {shop.avatar || owner?.avatar ? (
          <img src={shop.avatar || owner.avatar} alt="" className="detail-avatar" />
        ) : (
          <div className="detail-avatar placeholder">
            {(shop.shopName || shop.shopUsername || 'S').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="account-detail-hero-main">
          <div className="account-detail-hero-top">
            <h2>{shop.shopName || 'Gian hàng'}</h2>
            <div className="badge-row">
              <span className={statusBadgeClass(shop.status)}>{shop.statusLabel}</span>
              <span className="badge badge-neutral">{shop.isOpenLabel || ''}</span>
              {shop.categoryName ? (
                <span className="badge badge-info">{shop.categoryName}</span>
              ) : null}
            </div>
          </div>
          <p>@{shop.shopUsername || ''}</p>
        </div>
      </section>

      <section className="stats-grid account-stats-grid">
        <article className="stat-card">
          <strong>{shop.totalProducts ?? shop.products?.length ?? 0}</strong>
          <span>Sản phẩm</span>
        </article>
        <article className="stat-card">
          <strong>{shop.soldCount || 0}</strong>
          <span>Đã bán</span>
        </article>
        <article className="stat-card">
          <strong>{Number(shop.averageRating || 0).toFixed(1)}★</strong>
          <span>{shop.totalReviews || 0} đánh giá</span>
        </article>
        <article className="stat-card">
          <strong>{shop.followersCount || 0}</strong>
          <span>Theo dõi</span>
        </article>
        <article className="stat-card">
          <strong>{shop.reservations?.length || 0}</strong>
          <span>Đơn gần đây</span>
        </article>
      </section>

      <div className="detail-grid account-detail-grid">
        <article className="detail-card">
          <h3>Thông tin cửa hàng</h3>
          <dl className="detail-list">
            <div>
              <dt>Địa chỉ</dt>
              <dd>{shop.addressHeThong || shop.systemAddress || shop.address || ''}</dd>
            </div>
            <div>
              <dt>SĐT</dt>
              <dd>{shop.phone || ''}</dd>
            </div>
            <div>
              <dt>Giờ mở</dt>
              <dd>
                {shop.openTime || shop.closeTime
                  ? `${shop.openTime || ''}${shop.openTime && shop.closeTime ? ' - ' : ''}${shop.closeTime || ''}`
                  : ''}
              </dd>
            </div>
            <div>
              <dt>Ngày tạo</dt>
              <dd>{formatDate(shop.createdAt)}</dd>
            </div>
            <div>
              <dt>Mô tả</dt>
              <dd>{shop.description || 'Chưa có mô tả.'}</dd>
            </div>
          </dl>
        </article>

        <article className="detail-card">
          <h3>Chủ gian hàng</h3>
          {owner ? (
            <>
              <div className="party-identity">
                {owner.avatar ? (
                  <img src={owner.avatar} alt="" className="thumb-sm" />
                ) : (
                  <div className="thumb-sm thumb-fallback">
                    {(owner.userName || owner.fullName || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="cell-title">{owner.fullName || ''}</div>
                  <div className="cell-sub">
                    {owner.userName ? `@${owner.userName}` : ''}
                  </div>
                </div>
              </div>
              <dl className="detail-list">
                <div>
                  <dt>Email</dt>
                  <dd>{owner.email || ''}</dd>
                </div>
                <div>
                  <dt>SĐT</dt>
                  <dd>{owner.phone || ''}</dd>
                </div>
                <div>
                  <dt>Tài khoản</dt>
                  <dd>
                    <Link className="detail-btn" to={`/accounts/${owner.id}`}>
                      Chi tiết
                    </Link>
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="muted">Không có thông tin chủ shop.</p>
          )}
        </article>
      </div>

      <section className="detail-card account-history-card">
        <div className="finance-detail-head">
          <div>
            <h3>Sản phẩm ({shop.products?.length || 0})</h3>
            <p>Bấm Chi tiết để xem biến thể và thông tin đầy đủ</p>
          </div>
          {shop.id ? (
            <Link className="detail-btn" to={`/products?shopId=${shop.id}`}>
              Xem tất cả
            </Link>
          ) : null}
        </div>
        <div className="table-scroll">
          <table className="data-table finance-detail-table">
            <thead>
              <tr>
                <th />
                <th>Sản phẩm</th>
                <th className="col-right">Giá</th>
                <th>Trạng thái</th>
                <th className="col-right">Đã bán</th>
                <th className="col-actions">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {(shop.products || []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-empty">
                    Chưa có sản phẩm.
                  </td>
                </tr>
              ) : (
                shop.products.map((product) => (
                  <tr key={product.id} className="clickable-row" onClick={() => openProductDetail(product.id)}>
                    <td className="col-thumb">
                      {product.thumbnail ? (
                        <img src={product.thumbnail} alt="" className="thumb-sm" />
                      ) : (
                        <div className="thumb-sm thumb-fallback">SP</div>
                      )}
                    </td>
                    <td>
                      <div className="cell-title">{product.productName || ''}</div>
                    </td>
                    <td className="col-right cell-price">
                      {product.minPrice === product.maxPrice
                        ? formatPrice(product.minPrice)
                        : `${formatPrice(product.minPrice)} - ${formatPrice(product.maxPrice)}`}
                    </td>
                    <td>
                      <span
                        className={
                          product.status === 1 ? 'badge badge-success' : 'badge badge-neutral'
                        }
                      >
                        {product.status === 1 ? 'Đang hiện' : 'Đã ẩn'}
                      </span>
                    </td>
                    <td className="col-right">{product.soldCount || 0}</td>
                    <td className="col-actions">
                      <button
                        type="button"
                        className="detail-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          openProductDetail(product.id);
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
        </div>
      </section>

      <div className="detail-grid account-detail-grid">
        <article className="detail-card">
          <h3>Đơn giữ hàng gần đây</h3>
          {(shop.reservations || []).length === 0 ? (
            <p className="muted">Chưa có đơn.</p>
          ) : (
            <div className="table-scroll">
              <table className="data-table finance-detail-table">
                <thead>
                  <tr>
                    <th>Trạng thái</th>
                    <th>SL</th>
                    <th>Thời gian</th>
                    <th className="col-actions" />
                  </tr>
                </thead>
                <tbody>
                  {shop.reservations.map((item) => (
                    <tr key={item.id}>
                      <td>{item.statusLabel}</td>
                      <td>{item.quantity}</td>
                      <td>{formatDate(item.pickupTime || item.createdAt)}</td>
                      <td className="col-actions">
                        <Link className="detail-btn" to={`/reservations/${item.id}`}>
                          Chi tiết
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="detail-card">
          <h3>Đánh giá</h3>
          {(shop.reviews || []).length === 0 ? (
            <p className="muted">Chưa có đánh giá.</p>
          ) : (
            <ul className="report-list">
              {shop.reviews.map((item) => (
                <li key={item.id} className="report-item">
                  <strong>
                    {item.userName || 'Khách'} · {item.rating}★
                  </strong>
                  <p>{item.comment || ''}</p>
                  <span className="cell-sub">{formatDate(item.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="detail-card">
          <h3>Báo cáo</h3>
          {(shop.reports || []).length === 0 ? (
            <p className="muted">Chưa có báo cáo.</p>
          ) : (
            <ul className="report-list">
              {shop.reports.map((item) => (
                <li key={item.id} className="report-item">
                  <strong>{item.title || 'Báo cáo'}</strong>
                  <p className="cell-sub">{formatDate(item.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>

      {productLoading ? (
        <div className="dialog-overlay">
          <div className="dialog-card">
            <p>Đang tải chi tiết sản phẩm...</p>
          </div>
        </div>
      ) : null}

      {selectedProduct ? (
        <div className="dialog-overlay" role="presentation" onClick={() => setSelectedProduct(null)}>
          <div
            className="dialog-card dialog-card-wide history-detail-dialog"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header-row">
              <div>
                <h3>{selectedProduct.productName}</h3>
                <p className="muted">{selectedProduct.categoryName || ''}</p>
              </div>
              <button type="button" className="ghost-btn" onClick={() => setSelectedProduct(null)}>
                Đóng
              </button>
            </div>
            <dl className="detail-list detail-list-grid">
              <div>
                <dt>Trạng thái</dt>
                <dd>{selectedProduct.status === 1 ? 'Đang hiện' : 'Đã ẩn'}</dd>
              </div>
              <div>
                <dt>Giá</dt>
                <dd>
                  {selectedProduct.priceLabel ||
                    formatMoney(selectedProduct.minPrice)}
                </dd>
              </div>
              <div>
                <dt>Đơn vị</dt>
                <dd>{selectedProduct.donVi || ''}</dd>
              </div>
              <div>
                <dt>Đã bán</dt>
                <dd>{selectedProduct.soldCount ?? 0}</dd>
              </div>
              <div>
                <dt>Lượt xem</dt>
                <dd>{selectedProduct.viewCount ?? 0}</dd>
              </div>
              <div>
                <dt>Lượt thích</dt>
                <dd>{selectedProduct.likeCount ?? 0}</dd>
              </div>
            </dl>
            {selectedProduct.description ? (
              <p className="history-detail-desc">{selectedProduct.description}</p>
            ) : null}
            <div className="history-variant-block">
              <h4>Phân loại / biến thể ({(selectedProduct.variants || []).length})</h4>
              {(selectedProduct.variants || []).length === 0 ? (
                <p className="muted">Chưa có biến thể.</p>
              ) : (
                <ul className="variant-list">
                  {selectedProduct.variants.map((variant) => (
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
          </div>
        </div>
      ) : null}
    </div>
  );
}
