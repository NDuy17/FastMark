/**
 * Admin nhận event realtime của toàn hệ thống nên rất dễ bị dồn nhiều event
 * liên tiếp. Gộp chúng trong khoảng này để chỉ đồng bộ dữ liệu một lần.
 */
export const REALTIME_COALESCE_MS = 1000;
