import { useEffect, useState } from 'react';

export default function ReviewModerationDialog({
  review,
  action = 'hide',
  open,
  loading = false,
  error = '',
  onClose,
  onConfirm,
}) {
  const [reason, setReason] = useState('');
  const isDelete = action === 'delete';

  useEffect(() => {
    if (open) {
      setReason('');
    }
  }, [open, review?.id, action]);

  if (!open || !review) {
    return null;
  }

  const reviewerName = review.reviewer?.fullName || review.reviewer?.userName || 'Người dùng';
  const productName = review.productName || 'sản phẩm';

  function handleSubmit(event) {
    event.preventDefault();
    onConfirm?.(reason.trim());
  }

  return (
    <div className="dialog-overlay" role="presentation" onClick={onClose}>
      <div
        className="dialog-card product-remove-dialog"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header-row">
          <div>
            <h3>{isDelete ? 'Xóa đánh giá' : 'Ẩn đánh giá'}</h3>
            <p className="muted">
              {reviewerName} · {productName}
            </p>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose} disabled={loading}>
            Đóng
          </button>
        </div>

        <p className="product-remove-dialog-note">
          {isDelete
            ? 'Đánh giá sẽ bị xóa mềm và người viết sẽ nhận thông báo kèm lý do.'
            : 'Đánh giá sẽ không còn hiển thị công khai. Người viết sẽ nhận thông báo kèm lý do.'}
        </p>

        {error ? <p className="error-banner">{error}</p> : null}

        <form className="product-remove-dialog-form" onSubmit={handleSubmit}>
          <label>
            Lý do
            <textarea
              rows={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="VD: Nội dung không phù hợp, ảnh không liên quan sản phẩm..."
              disabled={loading}
              required
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="ghost-btn" onClick={onClose} disabled={loading}>
              Hủy
            </button>
            <button
              type="submit"
              className="danger-btn"
              disabled={loading || !reason.trim()}
            >
              {loading
                ? isDelete
                  ? 'Đang xóa...'
                  : 'Đang ẩn...'
                : isDelete
                  ? 'Xóa đánh giá'
                  : 'Ẩn đánh giá'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
