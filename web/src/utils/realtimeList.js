/**
 * Cập nhật danh sách theo từng phần tử cho luồng realtime (admin web).
 *
 * Nguyên tắc: chỉ tạo mảng/object mới khi dữ liệu thật sự đổi và giữ nguyên
 * tham chiếu của các item không đổi. Nhờ vậy hàng nào không đổi thì không
 * render lại → bảng không nháy, không mất vị trí cuộn.
 */

const MAX_COMPARE_DEPTH = 6;

export function getItemId(item) {
  if (!item || typeof item !== 'object') {
    return '';
  }
  return String(item.id ?? item._id ?? '');
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object';
}

/** So sánh dữ liệu JSON để biết có thay đổi thật hay không. */
export function isSameData(left, right, depth = 0) {
  if (left === right) {
    return true;
  }
  if (depth >= MAX_COMPARE_DEPTH || !isRecord(left) || !isRecord(right)) {
    return false;
  }

  const leftIsArray = Array.isArray(left);
  if (leftIsArray !== Array.isArray(right)) {
    return false;
  }

  if (leftIsArray) {
    return (
      left.length === right.length &&
      left.every((value, index) => isSameData(value, right[index], depth + 1))
    );
  }

  const leftKeys = Object.keys(left);
  if (leftKeys.length !== Object.keys(right).length) {
    return false;
  }
  return leftKeys.every((key) => isSameData(left[key], right[key], depth + 1));
}

/**
 * Hợp nhất dữ liệu vừa tải với danh sách đang hiển thị: giữ tham chiếu hàng cũ
 * nếu nội dung không đổi, trả về đúng mảng cũ nếu cả danh sách không đổi.
 */
export function mergeListById(current = [], incoming = [], resolveKey = getItemId) {
  const currentList = Array.isArray(current) ? current : [];
  const incomingList = Array.isArray(incoming) ? incoming : [];

  const currentById = new Map();
  currentList.forEach((item) => {
    const id = resolveKey(item);
    if (id) {
      currentById.set(id, item);
    }
  });

  let changed = currentList.length !== incomingList.length;
  const next = incomingList.map((item, index) => {
    const existing = currentById.get(resolveKey(item));
    const resolved = existing && isSameData(existing, item) ? existing : item;
    if (currentList[index] !== resolved) {
      changed = true;
    }
    return resolved;
  });

  return changed ? next : currentList;
}

/** Giữ nguyên state nếu dữ liệu mới giống hệt dữ liệu cũ. */
export function keepIfSame(current, incoming) {
  return isSameData(current, incoming) ? current : incoming;
}

/** Thay item cũ tại đúng vị trí, hoặc chèn item mới nếu chưa có. */
export function upsertById(current = [], item, { position = 'start' } = {}) {
  const list = Array.isArray(current) ? current : [];
  const id = getItemId(item);
  if (!id) {
    return list;
  }

  const index = list.findIndex((row) => getItemId(row) === id);
  if (index >= 0) {
    if (isSameData(list[index], item)) {
      return list;
    }
    const next = list.slice();
    next[index] = item;
    return next;
  }

  return position === 'end' ? [...list, item] : [item, ...list];
}

export function removeById(current = [], id) {
  const list = Array.isArray(current) ? current : [];
  const key = String(id || '');
  if (!key) {
    return list;
  }
  const next = list.filter((row) => getItemId(row) !== key);
  return next.length === list.length ? list : next;
}

/** Cập nhật một vài field của đúng một item (không đụng các item khác). */
export function patchById(current = [], id, patch) {
  const list = Array.isArray(current) ? current : [];
  const key = String(id || '');
  if (!key || !patch) {
    return list;
  }

  let changed = false;
  const next = list.map((row) => {
    if (getItemId(row) !== key) {
      return row;
    }
    const merged = { ...row, ...patch };
    if (isSameData(row, merged)) {
      return row;
    }
    changed = true;
    return merged;
  });

  return changed ? next : list;
}

export function hasItemId(current = [], id) {
  const key = String(id || '');
  if (!key) {
    return false;
  }
  return (Array.isArray(current) ? current : []).some((row) => getItemId(row) === key);
}
