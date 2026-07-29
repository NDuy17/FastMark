/** Số thứ tự dòng bảng admin (tính theo phân trang). */
export function getTableRowStt(page, limit, index) {
  return (Math.max(1, Number(page) || 1) - 1) * Math.max(1, Number(limit) || 1) + index + 1;
}
