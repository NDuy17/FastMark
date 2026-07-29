import { useCallback, useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';

import {
  createAdminBank,
  deleteAdminBank,
  listAdminBanks,
  updateAdminBank,
} from '../api/bankApi';
import TableIconActions from '../components/ui/TableIconActions';
import { useAuth } from '../context/AuthContext';

const emptyForm = {
  name: '',
  code: '',
};

export default function BanksPage() {
  const { getIdToken } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionId, setActionId] = useState('');

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      const payload = await listAdminBanks(token);
      setItems(payload.data?.banks || []);
    } catch (loadError) {
      setError(loadError.message || 'Không tải được danh sách ngân hàng.');
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

  function startEdit(bank) {
    setEditingId(bank.id);
    setForm({
      name: bank.name || '',
      code: bank.code || '',
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    const name = String(form.name || '').trim();
    const code = String(form.code || '').trim().toUpperCase();
    if (!name) {
      setError('Vui lòng nhập tên ngân hàng.');
      return;
    }
    if (!code || code.length < 2) {
      setError('Mã ngân hàng phải từ 2 ký tự.');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await getIdToken();
      const payload = { name, code };

      if (editingId) {
        await updateAdminBank(token, editingId, payload);
        setSuccessMessage('Cập nhật ngân hàng thành công.');
      } else {
        const result = await createAdminBank(token, payload);
        setSuccessMessage(result.message || 'Đã thêm ngân hàng.');
      }
      resetForm();
      await loadItems();
    } catch (submitError) {
      setError(submitError.message || 'Không lưu được ngân hàng.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(bank) {
    const confirmed = window.confirm(
      `Xóa ngân hàng "${bank.name}"?\nNgân hàng sẽ ẩn khỏi admin và app. Thêm lại đúng mã "${bank.code}" sẽ tự khôi phục.`
    );
    if (!confirmed) return;
    setActionId(bank.id);
    setError('');
    try {
      const token = await getIdToken();
      await deleteAdminBank(token, bank.id);
      setSuccessMessage('Đã xóa ngân hàng.');
      if (editingId === bank.id) resetForm();
      await loadItems();
    } catch (deleteError) {
      setError(deleteError.message || 'Không xóa được ngân hàng.');
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
          <h2>{editingId ? 'Sửa ngân hàng' : 'Thêm ngân hàng'}</h2>
          {editingId ? (
            <button type="button" className="ghost-btn" onClick={resetForm}>
              Hủy sửa
            </button>
          ) : null}
        </div>
        <form className="category-form" onSubmit={handleSubmit}>
          <label>
            Tên ngân hàng
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Vietcombank"
              required
            />
          </label>
          <label>
            Mã
            <input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="VCB"
              required
            />
          </label>
          <button type="submit" className="primary-btn" disabled={isSubmitting}>
            {isSubmitting ? 'Đang lưu...' : editingId ? 'Cập nhật' : 'Thêm mới'}
          </button>
        </form>
      </section>

      <section className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tên ngân hàng</th>
              <th>Mã</th>
              <th>Ngày tạo</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4}>Đang tải...</td></tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  Chưa có ngân hàng nào. Hãy thêm ít nhất một ngân hàng để user rút tiền.
                </td>
              </tr>
            ) : (
              items.map((bank) => (
                <tr key={bank.id}>
                  <td><strong>{bank.name}</strong></td>
                  <td>{bank.code}</td>
                  <td>{bank.createdAt ? new Date(bank.createdAt).toLocaleString('vi-VN') : ''}</td>
                  <td className="col-actions">
                    <TableIconActions
                      actions={[
                        {
                          icon: Pencil,
                          label: 'Sửa ngân hàng',
                          onClick: () => startEdit(bank),
                        },
                        {
                          icon: Trash2,
                          label: 'Xóa ngân hàng',
                          variant: 'danger',
                          disabled: actionId === bank.id,
                          onClick: () => handleDelete(bank),
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
    </div>
  );
}
