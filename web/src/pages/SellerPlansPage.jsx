import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Pencil, Trash2, Wallet } from 'lucide-react';

import {
  createSellerPlan,
  deleteSellerPlan,
  listSellerPlans,
  updateSellerPlan,
} from '../api/sellerPlanApi';
import AdminPageShell from '../components/admin/AdminPageShell';
import AdminPagination from '../components/admin/AdminPagination';
import DataTableShell from '../components/admin/DataTableShell';
import TableIconActions from '../components/ui/TableIconActions';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_PAGE_SIZE } from '../constants/pagination';
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
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);

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
      };

      if (editingId) {
        await updateSellerPlan(token, editingId, payload);
        setSuccessMessage('Cập nhật gói thành công.');
      } else {
        const result = await createSellerPlan(token, payload);
        setSuccessMessage(result.message || 'Tạo gói thành công.');
      }
      resetForm();
      await loadItems();
    } catch (submitError) {
      setError(submitError.message || 'Không lưu được gói.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(plan) {
    const confirmed = window.confirm(
      `Xóa gói "${plan.name || plan.label}"?\nGói sẽ ẩn khỏi admin và app. Thêm lại đúng tên sẽ tự khôi phục.`
    );
    if (!confirmed) return;
    setActionId(plan.id);
    setError('');
    try {
      const token = await getIdToken();
      await deleteSellerPlan(token, plan.id);
      setSuccessMessage('Đã xóa gói.');
      if (editingId === plan.id) resetForm();
      await loadItems();
    } catch (deleteError) {
      setError(deleteError.message || 'Không xóa được gói.');
    } finally {
      setActionId('');
    }
  }

  const totalPages = Math.max(1, Math.ceil(items.length / limit));
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * limit;
    return items.slice(start, start + limit);
  }, [items, limit, page]);

  return (
    <AdminPageShell
      icon={Wallet}
      title="Quản lý gói Seller"
      description="Tạo và cấu hình các gói đăng ký gian hàng cho người bán trên FastMark."
      stats={[
        { label: 'Tổng gói', value: loading ? '…' : items.length, icon: Wallet, tone: 'green' },
        { label: 'Đang bán', value: loading ? '…' : items.length, icon: Wallet, tone: 'blue' },
      ]}
    >
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

        <form className="category-form category-form-compact" onSubmit={handleSubmit}>
          <div className="category-form-row category-form-row-3">
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

      <DataTableShell
        title="Danh sách gói"
        pagination={
          <AdminPagination
            page={page}
            totalPages={totalPages}
            total={items.length}
            label="gói"
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
        <table className="data-table admin-data-table">
          <thead>
            <tr>
              <th>Gói</th>
              <th>Thời hạn</th>
              <th>Giá</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="table-empty">Đang tải...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={4} className="table-empty">Chưa có gói. Tạo gói mới (ví dụ 30 ngày / 100.000đ).</td></tr>
            ) : (
              paginatedItems.map((plan) => (
                <tr key={plan.id}>
                  <td>
                    <strong>{plan.name || plan.label}</strong>
                    {plan.description ? <div className="muted">{plan.description}</div> : null}
                  </td>
                  <td>{formatDuration(plan)}</td>
                  <td>{formatPrice(plan.price)}</td>
                  <td className="col-actions">
                    <TableIconActions
                      actions={[
                        {
                          icon: Eye,
                          label: 'Chi tiết gói',
                          onClick: () => setSelectedPlan(plan),
                        },
                        {
                          icon: Pencil,
                          label: 'Sửa gói',
                          onClick: () => startEdit(plan),
                        },
                        {
                          icon: Trash2,
                          label: 'Xóa gói',
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
      </DataTableShell>

      {selectedPlan ? (
        <PlanDetailDialog plan={selectedPlan} onClose={() => setSelectedPlan(null)} />
      ) : null}
    </AdminPageShell>
  );
}
