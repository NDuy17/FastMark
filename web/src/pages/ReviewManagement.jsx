import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Star, Trash2 } from 'lucide-react';

import {
  deleteAdminReview,
  hideAdminReview,
  listAdminReviews,
  showAdminReview,
} from '../api/adminReviewApi';
import AdminFilterPanel from '../components/admin/AdminFilterPanel';
import AdminDateFilter from '../components/admin/AdminDateFilter';
import ReviewModerationDialog from '../components/admin/ReviewModerationDialog';
import AdminPageShell from '../components/admin/AdminPageShell';
import AdminPagination from '../components/admin/AdminPagination';
import DataTableShell from '../components/admin/DataTableShell';
import TableIconActions from '../components/ui/TableIconActions';
import { useDebouncedSearch } from '../hooks/useDebouncedSearch';
import { useAdminDateFilter } from '../hooks/useAdminDateFilter';
import { useAdminRealtimeRefresh } from '../hooks/useAdminRealtimeRefresh';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_PAGE_SIZE } from '../constants/pagination';
import { REALTIME_COALESCE_MS } from '../constants/realtime';
import { formatDate } from '../utils/format';
import { keepIfSame, mergeListById } from '../utils/realtimeList';

const RATING_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: '5', label: '5 sao' },
  { value: '4', label: '4 sao' },
  { value: '3', label: '3 sao' },
  { value: '2', label: '2 sao' },
  { value: '1', label: '1 sao' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'visible', label: 'Đang hiển thị' },
  { value: 'hidden', label: 'Đã ẩn' },
];

function StarRating({ rating }) {
  const normalized = Math.max(0, Math.min(5, Number(rating) || 0));

  return (
    <div className="review-stars" aria-label={`${normalized} trên 5 sao`}>
      {Array.from({ length: 5 }).map((_, index) => {
        const starNumber = index + 1;
        const isActive = starNumber <= normalized;
        return (
          <span key={starNumber} className={isActive ? 'review-star review-star-active' : 'review-star'}>
            {isActive ? '★' : '☆'}
          </span>
        );
      })}
    </div>
  );
}

export default function ReviewManagement() {
  const { getIdToken } = useAuth();
  const [searchParams] = useSearchParams();
  const scopeFromUrl = searchParams.get('scope') || '';
  const productIdFromUrl = searchParams.get('productId') || '';

  const [reviews, setReviews] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const { input: searchInput, debounced: search, setInput: setSearchInput } = useDebouncedSearch();
  const {
    from: dateFrom,
    to: dateTo,
    preset: datePreset,
    applyRange: applyDateRange,
    resetRange: resetDateRange,
    queryParams: dateQueryParams,
  } = useAdminDateFilter();
  const [ratingFilter, setRatingFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState('');
  const [snackbar, setSnackbar] = useState('');
  const [moderationTarget, setModerationTarget] = useState(null);
  const [moderationLoading, setModerationLoading] = useState(false);
  const [moderationError, setModerationError] = useState('');

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    resetDateRange();
    setPage(1);
  }, [scopeFromUrl, resetDateRange]);

  const loadReviews = useCallback(async ({ silent = false } = {}) => {
    // silent = đồng bộ realtime: không bật loading, chỉ dòng nào đổi mới render lại.
    if (!silent) {
      setLoading(true);
      setError('');
    }

    try {
      const token = await getIdToken();
      const payload = await listAdminReviews(token, {
        search,
        rating: ratingFilter,
        status: statusFilter,
        productId: productIdFromUrl || undefined,
        page,
        limit,
        ...dateQueryParams,
      });

      setReviews((current) => mergeListById(current, payload.data?.items || []));
      setPagination((current) =>
        keepIfSame(current, payload.data?.pagination || {
          page: 1,
          limit: DEFAULT_PAGE_SIZE,
          total: 0,
          totalPages: 1,
        }),
      );
    } catch (loadError) {
      if (silent) {
        return;
      }
      setError(loadError.message || 'Không tải được danh sách đánh giá.');
      setReviews([]);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [getIdToken, limit, page, productIdFromUrl, ratingFilter, search, statusFilter, dateFrom, dateTo, dateQueryParams]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  useAdminRealtimeRefresh('review', () => loadReviews({ silent: true }), {
    coalesceMs: REALTIME_COALESCE_MS,
  });

  useEffect(() => {
    if (!snackbar) {
      return undefined;
    }

    const timer = window.setTimeout(() => setSnackbar(''), 3200);
    return () => window.clearTimeout(timer);
  }, [snackbar]);

  function showMessage(message) {
    setSnackbar(message);
  }

  function handleStatusChange(event) {
    setPage(1);
    setStatusFilter(event.target.value);
  }

  const pageMeta = useMemo(() => {
    if (scopeFromUrl === 'product') {
      return { title: 'Đánh giá sản phẩm', description: 'Quản lý đánh giá do người mua gửi cho sản phẩm.' };
    }
    if (scopeFromUrl === 'shop') {
      return { title: 'Đánh giá gian hàng', description: 'Quản lý đánh giá do người mua gửi cho gian hàng.' };
    }
    return {
      title: 'Quản lý đánh giá',
      description: 'Theo dõi và điều phối đánh giá trên toàn hệ thống FastMark.',
    };
  }, [scopeFromUrl]);

  const visibleCount = reviews.filter((review) => !review.isHidden).length;
  const hiddenCount = reviews.filter((review) => review.isHidden).length;

  function handleRatingChange(event) {
    setPage(1);
    setRatingFilter(event.target.value);
  }

  async function handleToggleHidden(review) {
    if (!review.isHidden) {
      setModerationError('');
      setModerationTarget({ review, action: 'hide' });
      return;
    }

    setActionLoadingId(review.id);
    setError('');

    try {
      const token = await getIdToken();
      const payload = await showAdminReview(token, review.id);
      const updatedReview = payload.data?.review;

      if (updatedReview) {
        setReviews((current) =>
          current.map((item) => (item.id === updatedReview.id ? updatedReview : item))
        );
      } else {
        await loadReviews();
      }

      showMessage(payload.message || 'Đã hiện lại đánh giá.');
    } catch (actionError) {
      setError(actionError.message || 'Không cập nhật được trạng thái đánh giá.');
    } finally {
      setActionLoadingId('');
    }
  }

  function closeModerationDialog() {
    if (moderationLoading) return;
    setModerationTarget(null);
    setModerationError('');
  }

  async function handleConfirmModeration(reason) {
    if (!moderationTarget?.review) return;

    setModerationLoading(true);
    setModerationError('');
    setError('');

    try {
      const token = await getIdToken();
      const { review, action } = moderationTarget;

      if (action === 'hide') {
        const payload = await hideAdminReview(token, review.id, { reason });
        const updatedReview = payload.data?.review;

        if (updatedReview) {
          setReviews((current) =>
            current.map((item) => (item.id === updatedReview.id ? updatedReview : item))
          );
        } else {
          await loadReviews();
        }

        showMessage(payload.message || 'Đã ẩn đánh giá.');
      } else {
        const payload = await deleteAdminReview(token, review.id, { reason });
        setReviews((current) => current.filter((item) => item.id !== review.id));
        setPagination((current) => ({
          ...current,
          total: Math.max(0, (current.total || 0) - 1),
        }));
        showMessage(payload.message || 'Đã xóa mềm đánh giá.');
      }

      setModerationTarget(null);
    } catch (actionError) {
      setModerationError(actionError.message || 'Không thực hiện được thao tác.');
    } finally {
      setModerationLoading(false);
    }
  }

  return (
    <AdminPageShell
      icon={Star}
      title={pageMeta.title}
      description={pageMeta.description}
      stats={[
        { label: 'Tổng đánh giá', value: loading ? '…' : pagination.total, icon: Star, tone: 'green' },
        { label: 'Đang hiển thị (trang)', value: loading ? '…' : visibleCount, icon: Eye, tone: 'blue' },
        { label: 'Đã ẩn (trang)', value: loading ? '…' : hiddenCount, icon: EyeOff, tone: 'amber' },
      ]}
    >
      {error ? <p className="error-banner">{error}</p> : null}
      {snackbar ? <p className="snackbar">{snackbar}</p> : null}

      <DataTableShell
        title="Danh sách đánh giá"
        filters={
          <AdminFilterPanel
            layout="inline"
            searchValue={searchInput}
            onSearchChange={setSearchInput}
            searchPlaceholder="Nội dung đánh giá, tên sản phẩm..."
          >
            <label>
              Số sao
              <select value={ratingFilter} onChange={handleRatingChange}>
                {RATING_OPTIONS.map((option) => (
                  <option key={option.value || 'all-rating'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Trạng thái
              <select value={statusFilter} onChange={handleStatusChange}>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value || 'all-status'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <AdminDateFilter
              from={dateFrom}
              to={dateTo}
              preset={datePreset}
              onApply={(range) => applyDateRange(range, () => setPage(1))}
            />
          </AdminFilterPanel>
        }
        pagination={
          <AdminPagination
            page={pagination.page || page}
            totalPages={pagination.totalPages || 1}
            total={pagination.total}
            label="đánh giá"
            limit={limit}
            onLimitChange={(next) => {
              setLimit(next);
              setPage(1);
            }}
            loading={loading}
            onPageChange={setPage}
          />
        }
      >
        <table className="account-table review-table admin-data-table">
          <thead>
            <tr>
              <th>Người đánh giá</th>
              <th>Đối tượng</th>
              <th>Đánh giá</th>
              <th>Thời gian</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="table-empty">
                  Đang tải danh sách đánh giá...
                </td>
              </tr>
            ) : reviews.length === 0 ? (
              <tr>
                <td colSpan={5} className="table-empty">
                  Không tìm thấy đánh giá phù hợp.
                </td>
              </tr>
            ) : (
              reviews.map((review) => (
                <tr key={review.id}>
                  <td>
                    <div className="account-primary">
                      {review.reviewer.fullName || review.reviewer.userName}
                    </div>
                    <div className="account-secondary">{review.reviewer.email || ''}</div>
                  </td>
                  <td>
                    <div className="account-primary">{review.productName}</div>
                    <div className="account-secondary">Gian hàng: {review.shopName}</div>
                  </td>
                  <td className="review-content-cell">
                    <StarRating rating={review.rating} />
                    <p className="review-comment">{review.comment}</p>
                    {Array.isArray(review.images) && review.images.length > 0 ? (
                      <div className="review-image-row">
                        {review.images.map((image, index) => {
                          const src = image.imageUrl || image.ImageUrl || image;
                          if (!src || typeof src !== 'string') return null;
                          return (
                            <img
                              key={`${review.id}-img-${index}`}
                              src={src}
                              alt="Ảnh đánh giá"
                              className="review-image-thumb"
                            />
                          );
                        })}
                      </div>
                    ) : review.imageUrl ? (
                      <img
                        src={review.imageUrl}
                        alt="Ảnh đánh giá"
                        className="review-image-thumb"
                      />
                    ) : null}
                    {review.isHidden ? (
                      <span className="badge badge-neutral review-status-badge">Đã ẩn</span>
                    ) : (
                      <span className="badge badge-success review-status-badge">Đang hiển thị</span>
                    )}
                  </td>
                  <td>
                    <div className="account-secondary">{formatDate(review.createdAt)}</div>
                  </td>
                  <td className="col-actions">
                    <TableIconActions
                      actions={[
                        review.isHidden
                          ? {
                              icon: Eye,
                              label: 'Hiện lại đánh giá',
                              variant: 'primary',
                              disabled: actionLoadingId === review.id,
                              onClick: () => handleToggleHidden(review),
                            }
                          : {
                              icon: EyeOff,
                              label: 'Ẩn đánh giá',
                              variant: 'warning',
                              disabled: actionLoadingId === review.id,
                              onClick: () => handleToggleHidden(review),
                            },
                        {
                          icon: Trash2,
                          label: 'Xóa đánh giá',
                          variant: 'danger',
                          onClick: () => {
                            setModerationError('');
                            setModerationTarget({ review, action: 'delete' });
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
      </DataTableShell>

      <ReviewModerationDialog
        review={moderationTarget?.review}
        action={moderationTarget?.action || 'hide'}
        open={Boolean(moderationTarget)}
        loading={moderationLoading}
        error={moderationError}
        onClose={closeModerationDialog}
        onConfirm={handleConfirmModeration}
      />
    </AdminPageShell>
  );
}
