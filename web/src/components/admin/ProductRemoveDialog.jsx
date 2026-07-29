import { useEffect, useState } from 'react';

export default function ProductRemoveDialog({
  product,
  open,
  loading = false,
  error = '',
  onClose,
  onConfirm,
}) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) {
      setReason('');
    }
  }, [open, product?.id]);

  if (!open || !product) {
    return null;
  }

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
            <h3>Gỡ sản phẩm vi phạm</h3>
            <p className="muted">{product.productName || 'Sản phẩm'}</p>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose} disabled={loading}>
            Đóng
          </button>
        </div>

        <p className="product-remove-dialog-note">
          Sản phẩm sẽ bị gỡ khỏi hệ thống (xóa mềm) và shop sẽ nhận thông báo kèm lý do vi phạm.
        </p>

        {error ? <p className="error-banner">{error}</p> : null}

        <form className="product-remove-dialog-form" onSubmit={handleSubmit}>
          <label>
            Lý do vi phạm
            <textarea
              rows={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="VD: Hình ảnh không đúng thực tế, giá sai quy định..."
              disabled={loading}
              required
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="ghost-btn" onClick={onClose} disabled={loading}>
              Hủy
            </button>
            <button type="submit" className="danger-btn" disabled={loading || !reason.trim()}>
              {loading ? 'Đang gỡ...' : 'Gỡ sản phẩm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
