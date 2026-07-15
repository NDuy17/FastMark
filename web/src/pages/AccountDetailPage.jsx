import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  blockAccount,
  getAccountDetail,
  unblockAccount,
} from '../api/accountApi';
import { useAuth } from '../context/AuthContext';

function formatDate(value) {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString('vi-VN');
}

function statusBadgeClass(status) {
  return status === 1 ? 'badge badge-success' : 'badge badge-danger';
}

function verificationBadgeClass(status) {
  if (status === 0) return 'badge badge-warning';
  if (status === 1) return 'badge badge-info';
  if (status === 2) return 'badge badge-danger';
  return 'badge';
}

function DetailSkeleton() {
  return (
    <div className="detail-grid">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="detail-card">
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line short" />
        </div>
      ))}
    </div>
  );
}

export default function AccountDetailPage() {
  const { accountId } = useParams();
  const navigate = useNavigate();
  const { getIdToken } = useAuth();

  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState('');
  const [confirmAction, setConfirmAction] = useState('');

  const loadAccount = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const token = await getIdToken();
      const payload = await getAccountDetail(token, accountId);
      setAccount(payload.data?.account || null);
    } catch (loadError) {
      setError(loadError.message || 'Không tải được chi tiết người dùng.');
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, [accountId, getIdToken]);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  useEffect(() => {
    if (!snackbar) {
      return undefined;
    }

    const timeoutId = setTimeout(() => setSnackbar(''), 3200);
    return () => clearTimeout(timeoutId);
  }, [snackbar]);

  async function handleStatusChange(action) {
    setActionLoading(true);
    setError('');

    try {
      const token = await getIdToken();
      const payload =
        action === 'block'
          ? await blockAccount(token, accountId)
          : await unblockAccount(token, accountId);

      setAccount(payload.data?.account || null);
      setSnackbar(payload.message || 'Cập nhật thành công.');
      setConfirmAction('');
    } catch (actionError) {
      setError(actionError.message || 'Không cập nhật được trạng thái tài khoản.');
    } finally {
      setActionLoading(false);
    }
  }

  const user = account?.user;
  const shop = account?.shop;
  const verification = account?.verification;
  const stats = account?.stats;
  const recentReports = account?.recentReports || [];
  const isActive = user?.status === 1;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <button type="button" className="ghost-btn back-link" onClick={() => navigate('/accounts')}>
            ← Danh sách người dùng
          </button>
          <h1>Chi tiết người dùng</h1>
          <p>Thông tin đầy đủ, thống kê và thao tác khóa/mở khóa tài khoản.</p>
        </div>
        <div className="header-actions">
          <button type="button" onClick={loadAccount} disabled={loading || actionLoading}>
            Làm mới
          </button>
          {user ? (
            isActive ? (
              <button
                type="button"
                className="danger-btn"
                disabled={actionLoading}
                onClick={() => setConfirmAction('block')}
              >
                Khóa tài khoản
              </button>
            ) : (
              <button
                type="button"
                className="approve-btn"
                disabled={actionLoading}
                onClick={() => setConfirmAction('unblock')}
              >
                Mở khóa tài khoản
              </button>
            )
          ) : null}
        </div>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}
      {snackbar ? <div className="snackbar">{snackbar}</div> : null}

      {loading ? <DetailSkeleton /> : null}

      {!loading && user ? (
        <>
          <section className="detail-hero">
            {user.avatar ? (
              <img src={user.avatar} alt="" className="detail-avatar" />
            ) : (
              <div className="detail-avatar placeholder">{user.userName?.charAt(0) || 'U'}</div>
            )}
            <div>
              <h2>{user.fullName}</h2>
              <p>@{user.userName} • {user.userId}</p>
              <div className="badge-row">
                <span className="badge badge-neutral">{user.roleLabel}</span>
                <span className={statusBadgeClass(user.status)}>{user.statusLabel}</span>
                {verification ? (
                  <span className={verificationBadgeClass(verification.status)}>
                    {verification.statusLabel}
                  </span>
                ) : null}
              </div>
            </div>
          </section>

          <section className="stats-grid">
            <article className="stat-card">
              <strong>{stats?.totalProducts || 0}</strong>
              <span>Sản phẩm</span>
            </article>
            <article className="stat-card">
              <strong>{stats?.totalReservations || 0}</strong>
              <span>Đơn giữ hàng</span>
            </article>
            <article className="stat-card">
              <strong>{stats?.totalReportsReceived || 0}</strong>
              <span>Báo cáo nhận</span>
            </article>
            <article className="stat-card">
              <strong>{stats?.totalReviews || 0}</strong>
              <span>Đánh giá</span>
            </article>
            <article className="stat-card">
              <strong>{stats?.totalFollowers || 0}</strong>
              <span>Người theo dõi</span>
            </article>
          </section>

          <div className="detail-grid">
            <article className="detail-card">
              <h3>Thông tin người dùng</h3>
              <dl className="detail-list">
                <div><dt>Thư điện tử</dt><dd>{user.email || '—'}</dd></div>
                <div><dt>Điện thoại</dt><dd>{user.phone || '—'}</dd></div>
                <div><dt>Giới thiệu</dt><dd>{user.bio || '—'}</dd></div>
                <div><dt>Ngày tạo</dt><dd>{formatDate(user.createdAt)}</dd></div>
                <div><dt>Cập nhật</dt><dd>{formatDate(user.updatedAt)}</dd></div>
                <div><dt>Hoạt động cuối</dt><dd>{formatDate(user.lastActiveAt)}</dd></div>
              </dl>
            </article>

            {shop ? (
              <article className="detail-card">
                <h3>Thông tin cửa hàng</h3>
                <dl className="detail-list">
                  <div><dt>Tên cửa hàng</dt><dd>{shop.shopName || '—'}</dd></div>
                  <div><dt>Tên đăng nhập shop</dt><dd>{shop.shopUsername ? `@${shop.shopUsername}` : '—'}</dd></div>
                  <div><dt>Địa chỉ</dt><dd>{shop.address || '—'}</dd></div>
                  <div><dt>Điện thoại</dt><dd>{shop.phone || '—'}</dd></div>
                  <div><dt>Giờ mở</dt><dd>{shop.openTime || '—'} - {shop.closeTime || '—'}</dd></div>
                  <div><dt>Trạng thái cửa hàng</dt><dd><span className={statusBadgeClass(shop.status)}>{shop.statusLabel}</span></dd></div>
                  <div><dt>Điểm đánh giá</dt><dd>{shop.averageRating?.toFixed?.(1) || '0.0'}</dd></div>
                  <div><dt>Người theo dõi</dt><dd>{shop.followersCount || 0}</dd></div>
                  <div><dt>Tổng đánh giá</dt><dd>{shop.totalReviews || 0}</dd></div>
                  <div><dt>Tổng sản phẩm</dt><dd>{shop.totalProducts || 0}</dd></div>
                  <div><dt>Tổng lượt bán</dt><dd>{shop.soldCount || 0}</dd></div>
                  <div><dt>Giới thiệu</dt><dd>{shop.description || '—'}</dd></div>
                </dl>
              </article>
            ) : null}

            {verification ? (
              <article className="detail-card detail-card-wide">
                <h3>Xác minh người bán</h3>
                <dl className="detail-list">
                  <div><dt>Trạng thái</dt><dd><span className={verificationBadgeClass(verification.status)}>{verification.statusLabel}</span></dd></div>
                  <div><dt>Địa chỉ đăng ký</dt><dd>{verification.address || verification.systemAddress || '—'}</dd></div>
                  <div><dt>Ngày gửi</dt><dd>{formatDate(verification.submittedAt)}</dd></div>
                  <div><dt>Ngày duyệt</dt><dd>{formatDate(verification.approvedAt)}</dd></div>
                  <div><dt>Lý do từ chối</dt><dd>{verification.rejectionReason || '—'}</dd></div>
                </dl>

                <div className="image-grid">
                  {verification.cccdFrontImage ? (
                    <a href={verification.cccdFrontImage} target="_blank" rel="noreferrer">
                      <img src={verification.cccdFrontImage} alt="CCCD mặt trước" />
                      <span>CCCD trước</span>
                    </a>
                  ) : null}
                  {verification.cccdBackImage ? (
                    <a href={verification.cccdBackImage} target="_blank" rel="noreferrer">
                      <img src={verification.cccdBackImage} alt="CCCD mặt sau" />
                      <span>CCCD sau</span>
                    </a>
                  ) : null}
                  {verification.selfieImage ? (
                    <a href={verification.selfieImage} target="_blank" rel="noreferrer">
                      <img src={verification.selfieImage} alt="Ảnh selfie" />
                      <span>Ảnh chân dung</span>
                    </a>
                  ) : null}
                </div>
              </article>
            ) : null}
          </div>

          {recentReports.length > 0 ? (
            <section className="detail-card">
              <h3>Báo cáo gần đây</h3>
              <div className="report-list">
                {recentReports.map((report) => (
                  <article key={report.id} className="report-item">
                    <strong>{report.title || 'Báo cáo'}</strong>
                    <p>{report.content || '—'}</p>
                    <span className="account-secondary">{formatDate(report.createdAt)}</span>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {!loading && !user ? (
        <div className="empty-card">
          Không tìm thấy người dùng. <Link to="/accounts">Quay lại danh sách</Link>
        </div>
      ) : null}

      {confirmAction ? (
        <div className="dialog-overlay" role="presentation" onClick={() => !actionLoading && setConfirmAction('')}>
          <div className="dialog-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h3>{confirmAction === 'block' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}</h3>
            <p>
              {confirmAction === 'block'
                ? 'Bạn có chắc chắn muốn khóa tài khoản này? Người dùng sẽ không thể đăng nhập và thao tác trên hệ thống.'
                : 'Bạn có chắc chắn muốn mở khóa tài khoản này?'}
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                className="ghost-btn"
                disabled={actionLoading}
                onClick={() => setConfirmAction('')}
              >
                Huỷ
              </button>
              <button
                type="button"
                className={confirmAction === 'block' ? 'danger-btn' : 'approve-btn'}
                disabled={actionLoading}
                onClick={() => handleStatusChange(confirmAction)}
              >
                {actionLoading ? 'Đang xử lý...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
