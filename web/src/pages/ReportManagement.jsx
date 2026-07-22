import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  approveReport,
  dismissReport,
  getReportDetail,
  listReports,
} from '../api/reportApi';
import { useAuth } from '../context/AuthContext';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';

const REPORT_TYPE_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: '1', label: 'Đánh giá' },
  { value: '2', label: 'Người dùng' },
  { value: '3', label: 'Gian hàng' },
  { value: '4', label: 'Sản phẩm' },
  { value: '8', label: 'Hệ thống lỗi' },
  { value: '9', label: 'Khác' },
];

const STATUS_FILTER_OPTIONS = [
  { value: 'pending', label: 'Chờ xử lý' },
  { value: 'processed', label: 'Đã xử lý' },
];

const REPORT_TYPE = {
  REVIEW: 1,
  USER: 2,
  SHOP: 3,
  PRODUCT: 4,
  SYSTEM: 8,
  OTHER: 9,
};

const APPROVE_REPLY_TEMPLATES = [
  'Cảm ơn bạn đã báo cáo. Chúng tôi đã tiếp nhận và sẽ xem xét lại nội dung này.',
  'Cảm ơn bạn đã tố cáo. Đội ngũ FastMark đã ghi nhận và đang xử lý.',
  'Báo cáo của bạn đã được duyệt. Chúng tôi sẽ theo dõi và xử lý phù hợp.',
];

const DISMISS_REPLY_TEMPLATES = [
  'Báo cáo của bạn đã bị bác bỏ. Cảm ơn bạn đã đóng góp ý kiến.',
  'Sau khi xem xét, chúng tôi chưa đủ căn cứ để xử lý tố cáo này.',
  'Tố cáo chưa đủ thông tin nên đã bị bác bỏ. Bạn có thể gửi lại với chi tiết rõ hơn.',
];

function formatDate(value) {
  if (!value) {
    return '';
  }
  return new Date(value).toLocaleString('vi-VN');
}

function statusBadgeClass(status) {
  if (status === 0) return 'badge badge-warning';
  if (status === 1) return 'badge badge-success';
  if (status === 2) return 'badge badge-neutral';
  return 'badge';
}

function reasonBadgeClass(title = '') {
  const normalized = title.toLowerCase();
  if (normalized.includes('spam') || normalized.includes('lừa')) {
    return 'badge badge-danger';
  }
  if (normalized.includes('xúc phạm') || normalized.includes('thô tục')) {
    return 'badge badge-warning';
  }
  if (normalized.includes('sai sự thật') || normalized.includes('giả mạo')) {
    return 'badge badge-info';
  }
  return 'badge badge-danger';
}

function typeBadgeClass(reportType) {
  if (reportType === REPORT_TYPE.REVIEW) return 'badge badge-info';
  if (reportType === REPORT_TYPE.SHOP) return 'badge badge-warning';
  if (reportType === REPORT_TYPE.PRODUCT) return 'badge badge-danger';
  if (reportType === REPORT_TYPE.SYSTEM) return 'badge badge-danger';
  if (reportType === REPORT_TYPE.OTHER) return 'badge badge-neutral';
  return 'badge badge-neutral';
}

function getReportTargetLabel(item) {
  const productName = item?.targetProductName || item?.target_product_name || '';
  const shopName = item?.targetShopName || item?.target_shop_name || '';

  if (productName) {
    return `Sản phẩm: ${productName}`;
  }
  if (shopName) {
    return `Gian hàng: ${shopName}`;
  }
  return '';
}

function formatTargetUserLine(user) {
  if (!user) return '';
  const name = user.fullName || user.userName || '';
  if (!name && !user.email) return '';
  if (user.userName && user.fullName) {
    return `${user.fullName} (@${user.userName})`;
  }
  return name || user.email || '';
}

function getAvatarInitial(person) {
  const raw = String(person?.fullName || person?.userName || person?.name || '?').trim();
  return raw.charAt(0).toUpperCase() || '?';
}

function PartyAvatar({ person, name }) {
  const avatarUrl = resolveMediaUrl(person?.avatar || '');
  const initial = getAvatarInitial(person || { fullName: name });
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className="report-party-avatar" />;
  }
  return <div className="report-party-avatar placeholder">{initial}</div>;
}

function getReportedAccountId(detail) {
  if (detail?.targetUser?.id) {
    return String(detail.targetUser.id);
  }
  if (detail?.shop?.userId) {
    return String(detail.shop.userId);
  }
  return '';
}

function getReportedSubjectFieldLabel(reportType) {
  switch (reportType) {
    case REPORT_TYPE.SHOP:
      return 'Gian hàng bị báo cáo';
    case REPORT_TYPE.USER:
      return 'Người dùng bị báo cáo';
    case REPORT_TYPE.PRODUCT:
      return 'Sản phẩm bị báo cáo';
    case REPORT_TYPE.REVIEW:
      return 'Đánh giá bị báo cáo';
    case REPORT_TYPE.SYSTEM:
      return 'Đối tượng bị báo cáo';
    case REPORT_TYPE.OTHER:
      return 'Đối tượng bị báo cáo';
    default:
      return 'Đối tượng bị báo cáo';
  }
}

function getReportedSubjectValue(detail) {
  const reportType = detail?.reportType;

  if (reportType === REPORT_TYPE.SHOP) {
    return (
      detail?.shop?.name ||
      detail?.targetShopName ||
      detail?.target_shop_name ||
      detail?.targetUser?.fullName ||
      detail?.targetUser?.userName ||
      ''
    );
  }

  if (reportType === REPORT_TYPE.USER) {
    return formatTargetUserLine(detail?.targetUser);
  }

  if (reportType === REPORT_TYPE.PRODUCT) {
    return detail?.product?.name || detail?.targetProductName || detail?.target_product_name || '';
  }

  if (reportType === REPORT_TYPE.REVIEW) {
    const review = detail?.review;
    if (review) {
      const summary = review.comment
        ? `${review.userName || 'Khách hàng'} • ★ ${review.rating}/5 — ${review.comment}`
        : `${review.userName || 'Khách hàng'} • ★ ${review.rating}/5`;
      return summary;
    }
    return detail?.content || '';
  }

  return detail?.targetSubjectLabel || getReportTargetLabel(detail) || '';
}

function getReportedOwnerLines(detail) {
  const lines = [];
  const targetUser = detail?.targetUser;
  const ownerLine = formatTargetUserLine(targetUser);
  const shopBio = String(detail?.shop?.description || '').trim();

  if (detail?.reportType === REPORT_TYPE.SHOP) {
    if (shopBio) {
      lines.push(`Bio: ${shopBio}`);
    }
    if (targetUser?.userName) {
      lines.push(`@${targetUser.userName}`);
    }
    if (targetUser?.email) {
      lines.push(targetUser.email);
    }
    return lines;
  }

  if (detail?.reportType === REPORT_TYPE.PRODUCT) {
    const shopName =
      detail?.shop?.name ||
      detail?.targetShopName ||
      detail?.target_shop_name ||
      targetUser?.fullName ||
      targetUser?.userName ||
      '';
    if (shopName) {
      lines.push(`Gian hàng: ${shopName}`);
    }
    if (shopBio) {
      lines.push(`Bio: ${shopBio}`);
    }
    if (ownerLine) {
      lines.push(`Chủ gian hàng: ${ownerLine}`);
    }
    if (targetUser?.email) {
      lines.push(targetUser.email);
    }
    return lines;
  }

  if (detail?.reportType === REPORT_TYPE.USER && targetUser?.email) {
    lines.push(targetUser.email);
  }

  if (shouldShowRelatedTargetField(detail?.reportType) && getRelatedTargetValue(detail)) {
    lines.push(getRelatedTargetValue(detail));
  }

  return lines;
}

function getRelatedTargetValue(detail) {
  const productName =
    detail?.targetProductName || detail?.target_product_name || detail?.product?.name || '';
  const shopName = detail?.targetShopName || detail?.target_shop_name || detail?.shop?.name || '';

  if (productName && shopName) {
    return `${productName} • ${shopName}`;
  }
  if (productName) {
    return productName;
  }
  if (shopName) {
    return shopName;
  }
  return '';
}

function shouldShowRelatedTargetField(reportType) {
  return reportType === REPORT_TYPE.REVIEW;
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <tr key={index}>
          <td><div className="skeleton skeleton-line" /></td>
          <td><div className="skeleton skeleton-line" /></td>
          <td><div className="skeleton skeleton-line short" /></td>
          <td><div className="skeleton skeleton-line" /></td>
          <td><div className="skeleton skeleton-line short" /></td>
          <td><div className="skeleton skeleton-line short" /></td>
          <td><div className="skeleton skeleton-line short" /></td>
        </tr>
      ))}
    </>
  );
}

function EvidenceImagesSection({ images, onPreview }) {
  return (
    <div className="evidence-section">
      <div className="evidence-section-header">
        <h4>Hình ảnh bằng chứng</h4>
        {images.length > 0 ? <span className="badge badge-info">{images.length} ảnh</span> : null}
      </div>
      {images.length > 0 ? (
        <div className="evidence-thumbnail-grid">
          {images.map((image, index) => {
            const imageSrc = resolveMediaUrl(image.url);
            return (
            <button
              key={image.id}
              type="button"
              className="evidence-thumbnail"
              onClick={() => onPreview(imageSrc, index)}
              aria-label={`Xem bằng chứng ${index + 1}`}
            >
              <img src={imageSrc} alt={`Bằng chứng ${index + 1}`} loading="lazy" />
            </button>
            );
          })}
        </div>
      ) : (
        <div className="evidence-empty-box">Không có hình ảnh bằng chứng</div>
      )}
    </div>
  );
}

function ImagePreviewModal({ imageUrl, onClose }) {
  if (!imageUrl) {
    return null;
  }

  return (
    <div className="image-preview-overlay" role="presentation" onClick={onClose}>
      <div className="image-preview-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="ghost-btn image-preview-close" onClick={onClose}>
          Đóng
        </button>
        <img src={imageUrl} alt="Hình ảnh bằng chứng phóng to" className="image-preview-full" />
      </div>
    </div>
  );
}

function ReportDetailModal({
  detail,
  loading,
  actionLoading,
  onClose,
  onDismiss,
  onApprove,
  showApproveOptions,
  showDismissOptions,
  replyMessage,
  onChangeReplyMessage,
  onPickReplyTemplate,
  onConfirmApprove,
  onConfirmDismiss,
  onCancelAction,
}) {
  const isPending = detail?.status === 0;
  const review = detail?.review;
  const shop = detail?.shop;
  const product = detail?.product;
  const evidenceImages = detail?.evidenceImages || [];
  const [previewImage, setPreviewImage] = useState('');
  const replyTemplates = showDismissOptions ? DISMISS_REPLY_TEMPLATES : APPROVE_REPLY_TEMPLATES;
  const composingReply = showApproveOptions || showDismissOptions;

  function handlePreview(url) {
    setPreviewImage(url);
  }

  function closePreview() {
    setPreviewImage('');
  }

  return (
    <div className="dialog-overlay" role="presentation" onClick={() => !actionLoading && onClose()}>
      <div
        className="dialog-card dialog-card-wide"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header-row">
          <div>
            <h3>Chi tiết báo cáo vi phạm</h3>
            <p>Mã báo cáo: {detail?.id || ''}</p>
          </div>
          <button type="button" className="ghost-btn" disabled={actionLoading} onClick={onClose}>
            Đóng
          </button>
        </div>

        {loading ? (
          <div className="modal-loading">
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line short" />
            <div className="skeleton skeleton-line" />
          </div>
        ) : (
          <div className="report-modal-body">
            <div className="report-modal-grid">
              <section className="modal-section report-info-section">
                <div className="report-chip-row">
                  <span className={typeBadgeClass(detail?.reportType)}>
                    {detail?.reportTypeLabel || '—'}
                  </span>
                  <span className={statusBadgeClass(detail?.status)}>
                    {detail?.statusLabel || '—'}
                  </span>
                </div>

                <div className="report-party-grid">
                  <article className="report-party-card">
                    <span className="report-party-label">Người báo cáo</span>
                    <div className="report-party-head">
                      <PartyAvatar person={detail?.reporter} />
                      <div className="report-party-head-copy">
                        <strong className="report-party-name">
                          {detail?.reporter?.fullName || detail?.reporter?.userName || '—'}
                        </strong>
                        {detail?.reporter?.userName ? (
                          <span className="report-party-meta">@{detail.reporter.userName}</span>
                        ) : null}
                        {detail?.reporter?.email ? (
                          <span className="report-party-meta">{detail.reporter.email}</span>
                        ) : null}
                      </div>
                    </div>
                    <span className="report-party-meta">
                      Gửi lúc {formatDate(detail?.createdAt) || '—'}
                    </span>
                    {detail?.reporter?.id ? (
                      <Link
                        className="detail-btn report-party-link"
                        to={`/accounts/${detail.reporter.id}`}
                        onClick={onClose}
                      >
                        Xem chi tiết tài khoản
                      </Link>
                    ) : null}
                  </article>

                  <article className="report-party-card">
                    <span className="report-party-label">
                      {getReportedSubjectFieldLabel(detail?.reportType)}
                    </span>
                    <div className="report-party-head">
                      <PartyAvatar
                        person={
                          detail?.reportType === REPORT_TYPE.SHOP
                            ? detail?.targetUser
                            : detail?.targetUser || detail?.shop
                        }
                        name={getReportedSubjectValue(detail)}
                      />
                      <div className="report-party-head-copy">
                        <strong className="report-party-name">
                          {getReportedSubjectValue(detail) || 'Chưa gắn đối tượng'}
                        </strong>
                        {!getReportedSubjectValue(detail) ? (
                          <span className="report-party-meta">
                            Báo cáo lúc gửi chưa lưu gian hàng / user.
                          </span>
                        ) : null}
                        {getReportedOwnerLines(detail).map((line) => (
                          <span key={line} className="report-party-meta">
                            {line}
                          </span>
                        ))}
                      </div>
                    </div>
                    {detail?.reasonLabel ? (
                      <span className={`report-party-reason ${reasonBadgeClass(detail.reasonLabel)}`}>
                        {detail.reasonLabel}
                      </span>
                    ) : null}
                    {getReportedAccountId(detail) ? (
                      <Link
                        className="detail-btn report-party-link"
                        to={`/accounts/${getReportedAccountId(detail)}`}
                        onClick={onClose}
                      >
                        Xem chi tiết tài khoản
                      </Link>
                    ) : null}
                  </article>
                </div>

                <div className="report-content-block">
                  <h4>Nội dung báo cáo</h4>
                  <p className="report-content-text">{detail?.content || 'Không có nội dung.'}</p>
                </div>

                <div className="report-evidence-block">
                  <EvidenceImagesSection images={evidenceImages} onPreview={handlePreview} />
                </div>

                {detail?.processedBy || detail?.processedAt ? (
                  <dl className="detail-list report-process-meta">
                    {detail?.processedBy ? (
                      <div>
                        <dt>Người xử lý</dt>
                        <dd>{detail.processedBy.fullName || detail.processedBy.userName || ''}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>Thời gian xử lý</dt>
                      <dd>{formatDate(detail?.processedAt)}</dd>
                    </div>
                  </dl>
                ) : null}
              </section>

              <section className="modal-section modal-section-actions">
                <h4>Phản hồi người tố cáo</h4>
                {!isPending ? (
                  <div className="empty-card">Báo cáo này đã được xử lý trước đó.</div>
                ) : composingReply ? (
                  <div className="action-option-group">
                    <p>
                      {showDismissOptions
                        ? 'Chọn hoặc nhập nội dung thông báo khi bác bỏ.'
                        : 'Chọn hoặc nhập nội dung thông báo khi duyệt.'}
                    </p>

                    <label className="report-reply-field">
                      <strong>Thông báo gửi người tố cáo</strong>
                      <div className="report-reply-templates">
                        {replyTemplates.map((template, index) => (
                          <button
                            key={`tpl-${index}`}
                            type="button"
                            className="ghost-btn report-reply-template"
                            onClick={() => onPickReplyTemplate(template)}
                          >
                            {template}
                          </button>
                        ))}
                      </div>
                      <textarea
                        rows={4}
                        value={replyMessage}
                        onChange={(event) => onChangeReplyMessage(event.target.value)}
                        placeholder="Nhập nội dung thông báo..."
                      />
                    </label>

                    <div className="report-action-row">
                      <button
                        type="button"
                        className="report-btn report-btn-ghost"
                        disabled={actionLoading}
                        onClick={onCancelAction}
                      >
                        Quay lại
                      </button>
                      {showDismissOptions ? (
                        <button
                          type="button"
                          className="report-btn report-btn-reject"
                          disabled={actionLoading || !String(replyMessage || '').trim()}
                          onClick={onConfirmDismiss}
                        >
                          {actionLoading ? 'Đang xử lý...' : 'Xác nhận bác bỏ'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="report-btn report-btn-approve"
                          disabled={actionLoading || !String(replyMessage || '').trim()}
                          onClick={onConfirmApprove}
                        >
                          {actionLoading ? 'Đang xử lý...' : 'Xác nhận duyệt'}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="report-action-hint">
                      Duyệt hoặc bác bỏ. Hệ thống chỉ gửi thông báo phản hồi cho người tố cáo.
                    </p>
                    <div className="report-action-row">
                      <button
                        type="button"
                        className="report-btn report-btn-reject"
                        disabled={actionLoading}
                        onClick={onDismiss}
                      >
                        Bác bỏ
                      </button>
                      <button
                        type="button"
                        className="report-btn report-btn-approve"
                        disabled={actionLoading}
                        onClick={onApprove}
                      >
                        Duyệt
                      </button>
                    </div>
                  </>
                )}
              </section>
            </div>

            {shop && detail?.reportType !== REPORT_TYPE.SHOP ? (
              <section className="modal-section modal-section-full">
                <h4>Thông tin gian hàng liên quan</h4>
                <dl className="detail-list">
                  <div>
                    <dt>Tên gian hàng</dt>
                    <dd>{shop.name || ''}</dd>
                  </div>
                  <div>
                    <dt>Địa chỉ</dt>
                    <dd>{shop.addressHeThong || shop.systemAddress || shop.address || ''}</dd>
                  </div>
                  <div>
                    <dt>Số điện thoại</dt>
                    <dd>{shop.phone || ''}</dd>
                  </div>
                </dl>
              </section>
            ) : null}

            {product && detail?.reportType === REPORT_TYPE.PRODUCT ? (
              <section className="modal-section modal-section-full">
                <h4>Thông tin bổ sung sản phẩm</h4>
                <dl className="detail-list">
                  {product.shopName ? (
                    <div>
                      <dt>Gian hàng</dt>
                      <dd>{product.shopName}</dd>
                    </div>
                  ) : null}
                  {product.description ? (
                    <div>
                      <dt>Mô tả</dt>
                      <dd>{product.description}</dd>
                    </div>
                  ) : null}
                </dl>
              </section>
            ) : null}

            {product && detail?.reportType !== REPORT_TYPE.PRODUCT ? (
              <section className="modal-section modal-section-full">
                <h4>Thông tin sản phẩm liên quan</h4>
                <dl className="detail-list">
                  <div>
                    <dt>Tên sản phẩm</dt>
                    <dd>{product.name || ''}</dd>
                  </div>
                  {product.shopName ? (
                    <div>
                      <dt>Gian hàng</dt>
                      <dd>{product.shopName}</dd>
                    </div>
                  ) : null}
                  {product.description ? (
                    <div>
                      <dt>Mô tả</dt>
                      <dd>{product.description}</dd>
                    </div>
                  ) : null}
                </dl>
              </section>
            ) : null}

            {review ? (
              <section className="modal-section modal-section-full">
                <h4>Đánh giá bị tố cáo</h4>
                <article className="report-item">
                  <p>
                    <strong>{review.userName}</strong> • ★ {review.rating}/5
                  </p>
                  <p>{review.comment || 'Không có nội dung đánh giá.'}</p>
                  <span className="account-secondary">{formatDate(review.createdAt)}</span>
                </article>
              </section>
            ) : null}
          </div>
        )}
      </div>

      <ImagePreviewModal imageUrl={previewImage} onClose={closePreview} />
    </div>
  );
}

export default function ReportManagement() {
  const { getIdToken } = useAuth();
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [reportType, setReportType] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [page, setPage] = useState(1);
  const [dataMeta, setDataMeta] = useState(null);

  const [selectedReportId, setSelectedReportId] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showApproveOptions, setShowApproveOptions] = useState(false);
  const [showDismissOptions, setShowDismissOptions] = useState(false);
  const [replyMessage, setReplyMessage] = useState(APPROVE_REPLY_TEMPLATES[0]);

  const statusParam = statusFilter === 'pending' ? '0' : 'processed';

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const token = await getIdToken();
      const payload = await listReports(token, {
        search,
        reportType,
        status: statusParam,
        page,
        limit: 20,
      });

      setItems(payload.data?.items || []);
      setPagination(payload.data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
      setDataMeta(payload.data?.meta || null);
    } catch (loadError) {
      setError(loadError.message || 'Không tải được danh sách báo cáo.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [getIdToken, page, reportType, search, statusParam]);

  const loadDetail = useCallback(
    async (reportId) => {
      setDetail(null);
      setDetailLoading(true);
      setError('');

      try {
        const token = await getIdToken();
        const payload = await getReportDetail(token, reportId);
        setDetail(payload.data?.report || null);
      } catch (loadError) {
        setError(loadError.message || 'Không tải được chi tiết báo cáo.');
        setDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [getIdToken]
  );

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (!snackbar) {
      return undefined;
    }

    const timeoutId = setTimeout(() => setSnackbar(''), 3200);
    return () => clearTimeout(timeoutId);
  }, [snackbar]);

  function handleSearchSubmit(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function handleFilterChange(setter, value) {
    setter(value);
    setPage(1);
  }

  function openDetail(reportId) {
    setSelectedReportId(reportId);
    setShowApproveOptions(false);
    setShowDismissOptions(false);
    setReplyMessage(APPROVE_REPLY_TEMPLATES[0]);
    loadDetail(reportId);
  }

  function closeDetail() {
    if (actionLoading) {
      return;
    }
    setSelectedReportId('');
    setDetail(null);
    setShowApproveOptions(false);
    setShowDismissOptions(false);
  }

  async function refreshAfterAction(message, updatedReport) {
    setSnackbar(message);
    setDetail(updatedReport);
    setShowApproveOptions(false);
    setShowDismissOptions(false);
    await loadItems();
  }

  function handleDismissClick() {
    setShowDismissOptions(true);
    setShowApproveOptions(false);
    setReplyMessage(DISMISS_REPLY_TEMPLATES[0]);
  }

  async function handleConfirmDismiss() {
    if (!selectedReportId) {
      return;
    }
    const message = String(replyMessage || '').trim();
    if (!message) {
      setError('Vui lòng nhập thông báo gửi người tố cáo.');
      return;
    }

    setActionLoading(true);
    setError('');

    try {
      const token = await getIdToken();
      const payload = await dismissReport(token, selectedReportId, message);
      await refreshAfterAction(payload.message || 'Đã bác bỏ báo cáo vi phạm.', payload.data?.report);
    } catch (actionError) {
      setError(actionError.message || 'Không bác bỏ được báo cáo.');
    } finally {
      setActionLoading(false);
    }
  }

  function handleApproveClick() {
    setShowApproveOptions(true);
    setShowDismissOptions(false);
    setReplyMessage(APPROVE_REPLY_TEMPLATES[0]);
  }

  async function handleConfirmApprove() {
    if (!selectedReportId) {
      return;
    }
    const message = String(replyMessage || '').trim();
    if (!message) {
      setError('Vui lòng nhập thông báo gửi người tố cáo.');
      return;
    }

    setActionLoading(true);
    setError('');

    try {
      const token = await getIdToken();
      const payload = await approveReport(token, selectedReportId, 'resolve', message);
      await refreshAfterAction(payload.message || 'Đã duyệt vi phạm thành công.', payload.data?.report);
    } catch (actionError) {
      setError(actionError.message || 'Không duyệt được báo cáo.');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="page">
      <section className="filter-card">
        <form className="filter-form" onSubmit={handleSearchSubmit}>
          <label className="filter-search">
            Tìm kiếm
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Nội dung, lý do, tên người báo cáo..."
            />
          </label>
          <button type="submit" className="primary-btn">
            Tìm
          </button>
        </form>

        <div className="filter-grid">
          <label>
            Trạng thái
            <select
              value={statusFilter}
              onChange={(event) => {
                handleFilterChange(setStatusFilter, event.target.value);
                setShowApproveOptions(false);
                setShowDismissOptions(false);
              }}
            >
              {STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Loại vi phạm
            <select
              value={reportType}
              onChange={(event) => handleFilterChange(setReportType, event.target.value)}
            >
              {REPORT_TYPE_OPTIONS.map((option) => (
                <option key={option.value || 'all-type'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {snackbar ? <p className="snackbar">{snackbar}</p> : null}
      {error ? <p className="error-banner">{error}</p> : null}

      <section className="table-card">
        <div className="table-toolbar">
          <strong>
            {statusFilter === 'pending' ? 'Báo cáo chờ xử lý' : 'Báo cáo đã xử lý'} ·{' '}
            {pagination.total} phiếu
          </strong>
        </div>
        <div className="account-table-wrap">
          <table className="account-table">
            <thead>
              <tr>
                <th>Nội dung vi phạm</th>
                <th>Loại</th>
                <th>Lý do vi phạm</th>
                <th>Người báo cáo</th>
                <th>Trạng thái</th>
                <th>Thời gian</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? <SkeletonRows /> : null}
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-card">
                      {statusFilter === 'pending'
                        ? 'Không có báo cáo chờ xử lý.'
                        : 'Không có báo cáo đã xử lý.'}
                    </div>
                  </td>
                </tr>
              ) : null}
              {!loading
                ? items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="account-primary">{item.content || item.title || ''}</div>
                        {getReportTargetLabel(item) ? (
                          <div className="report-target-meta">{getReportTargetLabel(item)}</div>
                        ) : null}
                      </td>
                      <td>
                        <span className={typeBadgeClass(item.reportType)}>{item.reportTypeLabel}</span>
                      </td>
                      <td>
                        <span className={reasonBadgeClass(item.reasonLabel)}>{item.reasonLabel}</span>
                      </td>
                      <td>
                        <div>{item.reporter?.fullName || item.reporter?.userName || ''}</div>
                        <div className="account-secondary">{item.reporter?.email || ''}</div>
                      </td>
                      <td>
                        <span className={statusBadgeClass(item.status)}>{item.statusLabel}</span>
                      </td>
                      <td>
                        <div className="account-secondary">Gửi: {formatDate(item.createdAt)}</div>
                        <div className="account-secondary">Xử lý: {formatDate(item.processedAt)}</div>
                      </td>
                      <td>
                        <button type="button" className="detail-btn" onClick={() => openDetail(item.id)}>
                          Chi tiết
                        </button>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className="pagination-row">
        <span>
          Trang {pagination.page}/{pagination.totalPages} • {pagination.total} báo cáo
          {dataMeta?.dataSource ? ` • Nguồn: ${dataMeta.dataSource}` : ''}
        </span>
        <div className="pagination-actions">
          <button
            type="button"
            className="ghost-btn"
            disabled={loading || pagination.page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Trước
          </button>
          <button
            type="button"
            className="ghost-btn"
            disabled={loading || pagination.page >= pagination.totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Sau
          </button>
        </div>
      </div>

      {selectedReportId ? (
        <ReportDetailModal
          detail={detail}
          loading={detailLoading}
          actionLoading={actionLoading}
          onClose={closeDetail}
          onDismiss={handleDismissClick}
          onApprove={handleApproveClick}
          showApproveOptions={showApproveOptions}
          showDismissOptions={showDismissOptions}
          replyMessage={replyMessage}
          onChangeReplyMessage={setReplyMessage}
          onPickReplyTemplate={setReplyMessage}
          onConfirmApprove={handleConfirmApprove}
          onConfirmDismiss={handleConfirmDismiss}
          onCancelAction={() => {
            setShowApproveOptions(false);
            setShowDismissOptions(false);
          }}
        />
      ) : null}
    </div>
  );
}
