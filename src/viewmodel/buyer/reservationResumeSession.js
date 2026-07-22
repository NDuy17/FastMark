import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@fastmark/resume_reservation';

/**
 * Lưu ngữ cảnh giữ hàng trước khi sang nạp ví PayOS,
 * để sau khi nạp xong mở lại đúng sản phẩm + modal.
 */
export async function saveReservationResume(payload) {
  if (!payload?.productId) {
    return;
  }
  await AsyncStorage.setItem(
    KEY,
    JSON.stringify({
      productId: String(payload.productId),
      variantId: payload.variantId ? String(payload.variantId) : null,
      quantity: Math.max(1, Number(payload.quantity) || 1),
      source: payload.source || 'home',
      savedAt: Date.now(),
    })
  );
}

export async function loadReservationResume() {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.productId) {
      return null;
    }
    // Hết hạn sau 30 phút.
    if (Date.now() - Number(parsed.savedAt || 0) > 30 * 60 * 1000) {
      await clearReservationResume();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearReservationResume() {
  await AsyncStorage.removeItem(KEY);
}
