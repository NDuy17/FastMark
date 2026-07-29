import { useCallback, useEffect, useState } from 'react';
import { Eye, Pencil, Trash2 } from 'lucide-react';

import {
  createBannerPlan,
  deleteBannerPlan,
  listBannerPlans,
  updateBannerPlan,
} from '../api/sellerPlanApi';
import TableIconActions from '../components/ui/TableIconActions';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../utils/format';

const emptyForm = {
  name: '',
  description: '',
  durationDays: '',
  price: '',
};

function formatDuration(plan) {
  const days = Number(plan.durationDays) || 0;
  return days > 0 ? `${days} ngày` : '';
}

function DetailField({ label, children }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children ?? ''}</dd>
    </div>
  );
}

function BannerPlanDetailDialog({ plan, onClose }) {
  if (!plan) return null;
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
            <h3>Chi tiết gói banner</h3>
            <p className="muted">ID: {plan.id || ''}</p>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Đóng
          </button>
        </div>
        <dl className="detail-list detail-list-grid">
          <DetailField label="Tên gói">{plan.name || ''}</DetailField>
          <DetailField label="Thời hạn">{formatDuration(plan)}</DetailField>
          <DetailField label="Giá">{formatPrice(plan.price)}</DetailField>
          <DetailField label="Mô tả">{plan.description || ''}</DetailField>
        </dl>
      </div>
    </div>
  );
}

export default function BannerPlansPage() {
  const { getIdToken } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionId, setActionId] = useState('');
  const [selectedPlan, setSelectedPlan] = useState(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      const payload = await listBannerPlans(token);
      setItems(payload.data?.plans || []);
    } catch (loadError) {
      setError(loadError.message || 'Không tải được Banner Plans.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  function resetForm() {
    setEditingId('');
    setForm(emptyForm);
  }

  function startEdit(plan) {
    setEditingId(plan.id);
    setForm({
      name: plan.name || '',
      description: plan.description || '',
      durationDays: Number(plan.durationDays) || 30,
      price: Number(plan.price) || 0,
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccessMessage('');
    const name = String(form.name || '').trim();
    const durationDays = Number(form.durationDays);
    if (!name) {
      setError('Thiếu tên gói.');
      return;
    }
    if (!Number.isFinite(durationDays) || durationDays < 1) {
      setError('Thời hạn phải >= 1 ngày.');
      return;
    }
    setIsSubmitting(true);
    try {
      const token = await getIdToken();
      const payload = {
        name,
        description: String(form.description || '').trim(),
        durationDays,
        price: Number(form.price),
      };
      if (editingId) {
        await updateBannerPlan(token, editingId, payload);
        setSuccessMessage('Cập nhật gói banner thành công.');
      } else {
        const result = await createBannerPlan(token, payload);
        setSuccessMessage(result.message || 'Tạo gói banner thành công.');
      }
      resetForm();
      await loadItems();
    } catch (submitError) {
      setError(submitError.message || 'Không lưu được gói banner.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(plan) {
    if (!window.confirm(
      `Xóa gói "${plan.name}"?\nGói sẽ ẩn khỏi admin và app. Thêm lại đúng tên sẽ tự khôi phục.`
    )) return;
    setActionId(plan.id);
    try {
      const token = await getIdToken();
      await deleteBannerPlan(token, plan.id);
      setSuccessMessage('Đã xóa gói banner.');
      if (editingId === plan.id) resetForm();
      await loadItems();
    } catch (deleteError) {
      setError(deleteError.message || 'Không xóa được gói banner.');
    } finally {
      setActionId('');
    }
  }

  return (
    <div className="page">
      {error ? <p className="error-banner">{error}</p> : null}
      {successMessage ? <p className="success-banner">{successMessage}</p> : null}

      <section className="category-form-card">
        <div className="category-form-header">
          <h2>{editingId ? 'Sửa gói banner' : 'Thêm gói banner'}</h2>
          {editingId ? (
            <button type="button" className="ghost-btn" onClick={resetForm}>
              Hủy sửa
            </button>
          ) : null}
        </div>
        <form className="category-form category-form-compact" onSubmit={handleSubmit}>
          <div className="category-form-row category-form-row-3">
            <label>
              Tên gói
              <input
                value={form.name}
                onChange={(event) => setForm((c) => ({ ...c, name: event.target.value }))}
                placeholder="VD: Banner 7 ngày"
                required
              />
            </label>
            <label>
              Thời hạn (ngày)
              <input
                type="number"
                min={1}
                value={form.durationDays}
                onChange={(event) => setForm((c) => ({ ...c, durationDays: event.target.value }))}
                placeholder="VD: 7"
                required
              />
            </label>
            <label>
              Giá (VND)
              <input
                type="number"
                min={0}
                value={form.price}
                onChange={(event) => setForm((c) => ({ ...c, price: event.target.value }))}
                placeholder="VD: 49000"
                required
              />
            </label>
          </div>
          <label>
            Chi tiết gói
            <textarea
              rows={2}
              value={form.description}
              onChange={(event) => setForm((c) => ({ ...c, description: event.target.value }))}
              placeholder="Quyền lợi, vị trí hiển thị, lưu ý..."
            />
          </label>
          <div className="category-form-actions">
            <button type="submit" className="primary-btn" disabled={isSubmitting}>
              {isSubmitting ? 'Đang lưu...' : editingId ? 'Cập nhật' : 'Tạo gói'}
            </button>
          </div>
        </form>
      </section>

      <section className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Gói</th>
              <th>Chi tiết</th>
              <th>Thời hạn</th>
              <th>Giá</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5}>Đang tải...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5}>Chưa có Banner Plan. Hãy thêm gói mới ở form phía trên.</td></tr>
            ) : (
              items.map((plan) => (
                <tr key={plan.id}>
                  <td><strong>{plan.name}</strong></td>
                  <td className="review-content-cell">{plan.description || ''}</td>
                  <td>{formatDuration(plan)}</td>
                  <td>{formatPrice(plan.price)}</td>
                  <td className="col-actions">
                    <TableIconActions
                      actions={[
                        {
                          icon: Eye,
                          label: 'Chi tiết gói banner',
                          onClick: () => setSelectedPlan(plan),
                        },
                        {
                          icon: Pencil,
                          label: 'Sửa gói banner',
                          onClick: () => startEdit(plan),
                        },
                        {
                          icon: Trash2,
                          label: 'Xóa gói banner',
                          variant: 'danger',
                          disabled: actionId === plan.id,
                          onClick: () => handleDelete(plan),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {selectedPlan ? (
        <BannerPlanDetailDialog plan={selectedPlan} onClose={() => setSelectedPlan(null)} />
      ) : null}
    </div>
  );
}
