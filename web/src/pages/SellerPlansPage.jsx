import { useCallback, useEffect, useState } from 'react';

import {
  createSellerPlan,
  deleteSellerPlan,
  listSellerPlans,
  updateSellerPlan,
} from '../api/sellerPlanApi';
import { useAuth } from '../context/AuthContext';

const emptyForm = {
  name: '',
  description: '',
  durationDays: '',
  price: '',
  isActive: true,
};

function formatPrice(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

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

function PlanDetailDialog({ plan, onClose }) {
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
            <h3>Chi tiết gói seller</h3>
            <p className="muted">ID: {plan.id || ''}</p>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Đóng
          </button>
        </div>
        <dl className="detail-list detail-list-grid">
          <DetailField label="Tên gói">{plan.name || plan.label || ''}</DetailField>
          <DetailField label="Thời hạn">{formatDuration(plan)}</DetailField>
          <DetailField label="Giá">{formatPrice(plan.price)}</DetailField>
          <DetailField label="Trạng thái">
            {plan.isActive ? 'Đang bán' : 'Ngừng bán'}
          </DetailField>
          <DetailField label="Mô tả">{plan.description || ''}</DetailField>
        </dl>
      </div>
    </div>
  );
}

export default function SellerPlansPage() {
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
      const payload = await listSellerPlans(token);
      setItems(payload.data?.plans || []);
    } catch (loadError) {
      setError(loadError.message || 'Không tải được Seller Plans.');
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
      name: plan.name || plan.label || '',
      description: plan.description || '',
      durationDays: Number(plan.durationDays) || 30,
      price: Number(plan.price) || 0,
      isActive: plan.isActive !== false,
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    const name = String(form.name || '').trim();
    const durationDays = Number(form.durationDays);
    const price = Number(form.price);

    if (!name) {
      setError('Vui lòng nhập tên gói.');
      return;
    }
    if (!Number.isFinite(durationDays) || durationDays < 1) {
      setError('Thời hạn phải >= 1 ngày.');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setError('Giá gói không hợp lệ.');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await getIdToken();
      const payload = {
        name,
        description: String(form.description || '').trim(),
        durationDays,
        price,
        isActive: Boolean(form.isActive),
      };

      if (editingId) {
        await updateSellerPlan(token, editingId, payload);
        setSuccessMessage('Cập nhật gói thành công.');
      } else {
        await createSellerPlan(token, payload);
        setSuccessMessage('Tạo gói thành công.');
      }
      resetForm();
      await loadItems();
    } catch (submitError) {
      setError(submitError.message || 'Không lưu được gói.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggle(plan) {
    setActionId(plan.id);
    setError('');
    try {
      const token = await getIdToken();
      await updateSellerPlan(token, plan.id, { isActive: !plan.isActive });
      setSuccessMessage(plan.isActive ? 'Đã ngừng bán gói.' : 'Đã kích hoạt gói.');
      await loadItems();
    } catch (toggleError) {
      setError(toggleError.message || 'Không đổi trạng thái gói.');
    } finally {
      setActionId('');
    }
  }

  async function handleDelete(plan) {
    const confirmed = window.confirm(`Ngừng bán gói "${plan.name || plan.label}"?`);
    if (!confirmed) return;
    setActionId(plan.id);
    try {
      const token = await getIdToken();
      await deleteSellerPlan(token, plan.id);
      setSuccessMessage('Đã ngừng bán gói.');
      if (editingId === plan.id) resetForm();
      await loadItems();
    } catch (deleteError) {
      setError(deleteError.message || 'Không ngừng bán được gói.');
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
          <h2>{editingId ? 'Sửa gói' : 'Thêm gói mới'}</h2>
          {editingId ? (
            <button type="button" className="ghost-btn" onClick={resetForm}>
              Hủy sửa
            </button>
          ) : null}
        </div>

        <form className="category-form" onSubmit={handleSubmit}>
          <div className="category-form-row category-form-row-4">
            <label>
              Tên gói
              <input
                value={form.name}
                onChange={(event) => setForm((c) => ({ ...c, name: event.target.value }))}
                placeholder="VD: Gói 30 ngày"
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
                placeholder="VD: 30"
                required
              />
            </label>
            <label>
              Giá (VND)
              <input
                type="number"
                min={0}
                step={1000}
                value={form.price}
                onChange={(event) => setForm((c) => ({ ...c, price: event.target.value }))}
                placeholder="VD: 100000"
                required
              />
            </label>
            <label>
              Trạng thái
              <select
                className="category-select"
                value={form.isActive ? 1 : 0}
                onChange={(event) =>
                  setForm((c) => ({ ...c, isActive: Number(event.target.value) === 1 }))
                }
              >
                <option value={1}>Đang bán</option>
                <option value={0}>Ngừng bán</option>
              </select>
            </label>
          </div>
          <label>
            Mô tả
            <textarea
              rows={2}
              value={form.description}
              onChange={(event) => setForm((c) => ({ ...c, description: event.target.value }))}
              placeholder="VD: Mở gian hàng công khai trong 30 ngày"
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
              <th>Thời hạn</th>
              <th>Giá</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5}>Đang tải...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5}>Chưa có gói. Tạo gói mới (ví dụ 30 ngày / 100.000đ).</td></tr>
            ) : (
              items.map((plan) => (
                <tr key={plan.id}>
                  <td>
                    <strong>{plan.name || plan.label}</strong>
                    {plan.description ? <div className="muted">{plan.description}</div> : null}
                  </td>
                  <td>{formatDuration(plan)}</td>
                  <td>{formatPrice(plan.price)}</td>
                  <td>
                    <span className={plan.isActive ? 'badge badge-success' : 'badge badge-neutral'}>
                      {plan.isActive ? 'Đang bán' : 'Ngừng bán'}
                    </span>
                  </td>
                  <td>
                    <div className="action-row">
                      <button type="button" className="detail-btn" onClick={() => setSelectedPlan(plan)}>
                        Chi tiết
                      </button>
                      <button type="button" onClick={() => startEdit(plan)}>
                        Sửa
                      </button>
                      <button
                        type="button"
                        disabled={actionId === plan.id}
                        onClick={() => handleToggle(plan)}
                      >
                        {plan.isActive ? 'Ngừng bán' : 'Kích hoạt'}
                      </button>
                      <button
                        type="button"
                        className="danger-btn"
                        disabled={actionId === plan.id}
                        onClick={() => handleDelete(plan)}
                      >
                        Ẩn
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {selectedPlan ? (
        <PlanDetailDialog plan={selectedPlan} onClose={() => setSelectedPlan(null)} />
      ) : null}
    </div>
  );
}
