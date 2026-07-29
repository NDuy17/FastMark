/** Đưa mục đã xóa/ẩn xuống cuối danh sách, giữ thứ tự tương đối còn lại. */
export function sortDeletedLast(items = [], isDeleted = () => false) {
  return [...items].sort((left, right) => {
    const leftRank = isDeleted(left) ? 1 : 0;
    const rightRank = isDeleted(right) ? 1 : 0;
    return leftRank - rightRank;
  });
}
