/**
 * Reverse geocode tọa độ → địa chỉ (Nominatim).
 * Dùng khi lưu báo cáo tranh chấp nếu client chưa gửi address.
 */
async function reverseGeocode(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return "";
  }

  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: "jsonv2",
      "accept-language": "vi",
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: {
        "Accept-Language": "vi",
        "User-Agent": "FastMark-Backend/1.0",
      },
    });
    if (!response.ok) {
      return "";
    }
    const payload = await response.json();
    return payload?.display_name ? String(payload.display_name) : "";
  } catch {
    return "";
  }
}

module.exports = {
  reverseGeocode,
};
