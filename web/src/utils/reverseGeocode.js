/**
 * Reverse geocode lat/lng → địa chỉ đọc được (Nominatim).
 * Dùng cho báo cáo tranh chấp khi chưa có address lưu sẵn.
 */
export async function reverseGeocode(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return '';
  }

  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: 'jsonv2',
      'accept-language': 'vi',
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: {
        'Accept-Language': 'vi',
        'User-Agent': 'FastMark-Admin/1.0',
      },
    });
    if (!response.ok) {
      return '';
    }
    const payload = await response.json();
    return payload?.display_name ? String(payload.display_name) : '';
  } catch {
    return '';
  }
}
