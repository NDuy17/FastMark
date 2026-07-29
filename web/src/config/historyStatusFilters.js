export const HISTORY_STATUS_FILTER_ALL = 'all';

/** Nhãn khớp RESERVATION_STATUS_LABEL trên backend / cột TRẠNG THÁI bảng đơn. */
const RESERVATION_FILTERS = [
  { value: HISTORY_STATUS_FILTER_ALL, label: 'Tất cả' },
  { value: '0', label: 'Chờ shop xác nhận' },
  { value: '1', label: 'Đã từ chối' },
  { value: '2', label: 'Chờ nhận hàng' },
  { value: '3', label: 'Hoàn thành' },
  { value: '4', label: 'Tranh chấp' },
  { value: '5', label: 'Tự hoàn thành' },
  { value: '6', label: 'Đã hủy' },
];

/** Nhãn khớp REPORT_STATUS_LABELS. */
const REPORT_FILTERS = [
  { value: HISTORY_STATUS_FILTER_ALL, label: 'Tất cả' },
  { value: '0', label: 'Chờ xử lý' },
  { value: '1', label: 'Đã xử lý' },
  { value: '2', label: 'Đã bác bỏ' },
];

/** Nhãn khớp WALLET_TX_STATUS_LABEL. */
const WALLET_FILTERS = [
  { value: HISTORY_STATUS_FILTER_ALL, label: 'Tất cả' },
  { value: '0', label: 'Đang chờ' },
  { value: '1', label: 'Thành công' },
  { value: '2', label: 'Thất bại' },
  { value: '3', label: 'Đã hủy' },
];

/** Nhãn khớp cột TRẠNG THÁI tab sản phẩm. */
const PRODUCT_FILTERS = [
  { value: HISTORY_STATUS_FILTER_ALL, label: 'Tất cả' },
  { value: 'active', label: 'Đang hiện' },
  { value: 'hidden', label: 'Đã ẩn' },
  { value: 'removed', label: 'Đã gỡ' },
];

/** Nhãn khớp cột Hiển thị tab đánh giá. */
const REVIEW_FILTERS = [
  { value: HISTORY_STATUS_FILTER_ALL, label: 'Tất cả' },
  { value: 'visible', label: 'Hiển thị' },
  { value: 'hidden', label: 'Đang ẩn' },
  { value: 'deleted', label: 'Đã xóa' },
];

/** Nhãn khớp SELLER_SUBSCRIPTION_STATUS_LABEL. */
const SUBSCRIPTION_FILTERS = [
  { value: HISTORY_STATUS_FILTER_ALL, label: 'Tất cả' },
  { value: '0', label: 'Chờ thanh toán' },
  { value: '1', label: 'Đang hiệu lực' },
  { value: '2', label: 'Hết hạn' },
  { value: '3', label: 'Đã hủy' },
];

/** Nhãn khớp SELLER_BANNER_STATUS_LABEL. */
const BANNER_FILTERS = [
  { value: HISTORY_STATUS_FILTER_ALL, label: 'Tất cả' },
  { value: '0', label: 'Chưa yêu cầu treo' },
  { value: '4', label: 'Chờ duyệt treo' },
  { value: '1', label: 'Đang treo' },
  { value: '2', label: 'Đã hủy / gỡ' },
  { value: '3', label: 'Bị từ chối — có thể sửa gửi lại' },
];

/** Cấu hình bộ lọc trạng thái theo từng tab lịch sử hoạt động. */
export const HISTORY_TAB_STATUS_FILTERS = {
  reservations: RESERVATION_FILTERS,
  'shop-reservations': RESERVATION_FILTERS,
  'reports-filed': REPORT_FILTERS,
  'reports-received': REPORT_FILTERS,
  reports: REPORT_FILTERS,
  reviews: REVIEW_FILTERS,
  'shop-reviews': REVIEW_FILTERS,
  wallet: WALLET_FILTERS,
  products: PRODUCT_FILTERS,
  'seller-subscriptions': SUBSCRIPTION_FILTERS,
  'seller-banners': BANNER_FILTERS,
};

export function getHistoryStatusFilters(tab) {
  return HISTORY_TAB_STATUS_FILTERS[tab] || null;
}
