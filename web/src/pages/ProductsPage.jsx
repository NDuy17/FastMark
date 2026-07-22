import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import {
  deleteProduct,
  getProductDetail,
  hideProduct,
  listProducts,
  showProduct,
} from '../api/catalogApi';
import { listCategories } from '../api/categoryApi';
import { useAuth } from '../context/AuthContext';

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: '1', label: 'Đang hiện' },
  { value: '0', label: 'Đã ẩn' },
];

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('vi-VN');
}

export default function ProductsPage() {
  const { getIdToken } = useAuth();
  const [searchParams] = useSearchParams();
  const shopIdFilter = searchParams.get('shopId') || '';
  const productIdParam = searchParams.get('productId') || '';
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getIdToken();
        const payload = await listCategories(token, 'products');
        if (!cancelled) {
          setCategories(payload.data?.categories || payload.data?.items || []);
        }
      } catch {
        if (!cancelled) setCategories([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getIdToken]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      const payload = await listProducts(token, {
        search,
        status,
        categoryId,
        shopId: shopIdFilter || undefined,
        page,
        limit: 20,
      });
      setItems(payload.data?.items || []);
      setPagination(payload.data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (loadError) {
      setError(loadError.message || 'Không tải được danh sách sản phẩm.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [categoryId, getIdToken, page, search, shopIdFilter, status]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (!productIdParam) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const token = await getIdToken();
        const payload = await getProductDetail(token, productIdParam);
        if (!cancelled) {
          setSelected(payload.data?.product || null);
        }
      } catch {
        // ignore auto-open failures
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getIdToken, productIdParam]);

  async function runAction(productId, action) {
    setBusyId(productId);
    setMessage('');
    setError('');
    try {
      const token = await getIdToken();
      if (action === 'hide') await hideProduct(token, productId);
      if (action === 'show') await showProduct(token, productId);
      if (action === 'delete') {
        const confirmed = window.confirm('Ẩn/xóa sản phẩm này?');
        if (!confirmed) return;
        await deleteProduct(token, productId);
      }
      setMessage('Cập nhật sản phẩm thành công.');
      await loadItems();
    } catch (actionError) {
      setError(actionError.message || 'Thao tác thất bại.');
    } finally {
      setBusyId('');
    }
  }

  async function openDetail(productId) {
    try {
      const token = await getIdToken();
      const payload = await getProductDetail(token, productId);
      setSelected(payload.data?.product || null);
    } catch (detailError) {
      setError(detailError.message || 'Không tải được chi tiết sản phẩm.');
    }
  }

  const categoryOptions = [
    { value: '', label: 'Tất cả danh mục' },
    ...categories.map((item) => ({
      value: String(item.id || item._id || ''),
      label: item.name || item.categoryName || 'Danh mục',
    })),
  ];

  return (
    <div className="page catalog-page">
      {error ? <p className="error-banner">{error}</p> : null}
      {message ? <p className="success-banner">{message}</p> : null}
      {shopIdFilter ? (
        <p className="muted">
          Đang lọc theo gian hàng · <Link to="/products">Xóa bộ lọc</Link>
        </p>
      ) : null}

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
            Tìm kiếm
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Tên sản phẩm, tên gian hàng, @username..."
            />
          </label>
          <button type="submit" className="primary-btn">
            Tìm
          </button>
        </form>
        <div className="filter-grid filter-grid-2">
          <label>
            Danh mục
            <select
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value);
                setPage(1);
              }}
            >
              {categoryOptions.map((option) => (
                <option key={option.value || 'all-cat'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Trạng thái
            <select
              value={status}
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
        </div>
      </section>

      <section className="table-card">
        <div className="table-scroll">
          <table className="data-table catalog-table">
            <thead>
              <tr>
                <th className="col-thumb">Ảnh</th>
                <th>Sản phẩm</th>
                <th>Gian hàng</th>
                <th className="col-price">Giá</th>
                <th className="col-status">Trạng thái</th>
                <th className="col-actions">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="table-empty">
                    Đang tải...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-empty">
                    Không có sản phẩm.
                  </td>
                </tr>
              ) : (
                items.map((product) => (
                  <tr key={product.id}>
                    <td className="col-thumb">
                      {product.thumbnail ? (
                        <img src={product.thumbnail} alt="" className="thumb-sm" />
                      ) : (
                        <div className="thumb-sm thumb-fallback">SP</div>
                      )}
                    </td>
                    <td>
                      <div className="cell-title">{product.productName}</div>
                      <div className="cell-sub">{product.categoryName || 'Chưa có danh mục'}</div>
                    </td>
                    <td>
                      {product.shopId ? (
                        <Link to={`/shops/${product.shopId}`} className="shop-cell-link">
                          <span className="cell-title">{product.shopName || 'Gian hàng'}</span>
                          {product.shopUsername ? (
                            <span className="cell-sub">@{product.shopUsername}</span>
                          ) : null}
                        </Link>
                      ) : (
                        <span className="cell-sub" />
                      )}
                    </td>
                    <td className="col-price cell-price">{product.priceLabel}</td>
                    <td className="col-status">
                      <span
                        className={
                          product.status === 1 ? 'badge badge-success' : 'badge badge-neutral'
                        }
                      >
                        {product.status === 1 ? 'Đang hiện' : 'Đã ẩn'}
                      </span>
                    </td>
                    <td className="col-actions">
                      <div className="table-actions">
                        <button type="button" className="detail-btn" onClick={() => openDetail(product.id)}>
                          Chi tiết
                        </button>
                        {product.status === 1 ? (
                          <button
                            type="button"
                            disabled={busyId === product.id}
                            onClick={() => runAction(product.id, 'hide')}
                          >
                            Ẩn
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busyId === product.id}
                            onClick={() => runAction(product.id, 'show')}
                          >
                            Hiện
                          </button>
                        )}
                        <button
                          type="button"
                          className="danger-btn"
                          disabled={busyId === product.id}
                          onClick={() => runAction(product.id, 'delete')}
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination-row">
          <span>
            Trang {pagination.page}/{pagination.totalPages} · {pagination.total} sản phẩm
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

      {selected ? (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal-card catalog-modal" onClick={(event) => event.stopPropagation()}>
            <header className="modal-header">
              <div>
                <h2>{selected.productName}</h2>
                <p>
                  {selected.shopId ? (
                    <Link to={`/shops/${selected.shopId}`}>
                      {selected.shopName || 'Gian hàng'}
                      {selected.shopUsername ? ` (@${selected.shopUsername})` : ''}
                    </Link>
                  ) : (
                    selected.shopName || ''
                  )}
                  {' · '}
                  {selected.categoryName || ''}
                </p>
              </div>
              <button type="button" className="ghost-btn" onClick={() => setSelected(null)}>
                Đóng
              </button>
            </header>
            <dl className="detail-list detail-list-grid">
              <div>
                <dt>Trạng thái</dt>
                <dd>{selected.status === 1 ? 'Đang hiện' : 'Đã ẩn'}</dd>
              </div>
              <div>
                <dt>Đơn vị</dt>
                <dd>{selected.donVi || ''}</dd>
              </div>
              <div>
                <dt>Lượt xem</dt>
                <dd>{selected.viewCount}</dd>
              </div>
              <div>
                <dt>Lượt thích</dt>
                <dd>{selected.likeCount}</dd>
              </div>
              <div>
                <dt>Yêu thích</dt>
                <dd>{selected.favoriteCount ?? ''}</dd>
              </div>
              <div>
                <dt>Đã bán</dt>
                <dd>{selected.soldCount}</dd>
              </div>
              <div>
                <dt>Đơn giữ hàng</dt>
                <dd>
                  {selected.reservationCount ?? 0} (hoàn thành {selected.completedReservations ?? 0})
                </dd>
              </div>
              <div>
                <dt>Chuyển đổi</dt>
                <dd>{selected.conversionRate ?? 0}% (xem → giữ hàng)</dd>
              </div>
              <div>
                <dt>Ngày tạo</dt>
                <dd>{formatDate(selected.createdAt)}</dd>
              </div>
            </dl>
            {(selected.thumbnails || []).length > 0 ? (
              <div className="image-grid">
                {selected.thumbnails.slice(0, 6).map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt="Ảnh sản phẩm" />
                  </a>
                ))}
              </div>
            ) : null}
            <p className="modal-description">{selected.description || 'Chưa có mô tả.'}</p>
            <h3 className="modal-section-title">Phân loại</h3>
            <ul className="variant-list">
              {(selected.variants || []).map((variant) => (
                <li key={variant.id}>
                  <strong>{variant.variantName}</strong>
                  <span>
                    {Number(variant.price || 0).toLocaleString('vi-VN')}đ · Tồn {variant.quantity} ·
                    Đã bán {variant.soldCount}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
