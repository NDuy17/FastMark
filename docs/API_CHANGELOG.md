# FastMark API Changelog (gần đây)

Cập nhật kèm `docs/FastMark-API-Danh-Sach.xlsx` (xuất từ `backend/scripts/exportApiExcel.js`).

## API mới / bổ sung

| Method | Path | Thay đổi |
|---|---|---|
| `GET` | `/api/notifications/unread-count` | Đếm chưa đọc theo `audience` (buyer/seller), phục vụ badge realtime chính xác |
| `GET` | `/api/notifications` | Response thêm `unreadCount` + phân trang ổn định (`_id` tie-break) |

## API đã sửa (hành vi)

| Khu vực | Thay đổi |
|---|---|
| Review buyer (`POST /api/buyer/...` tạo đánh giá) | Sau khi tạo: cập nhật stats shop, **notification seller**, emit `review` (admin + public + seller resource) |
| Review admin ẩn/xóa | Emit `resource_updated` cho seller + buyer; giữ notification buyer |
| Report admin duyệt/bác | Thêm `resource_updated` type `report` cho người gửi |
| Withdraw create/approve/reject | Đã emit admin + user (`withdraw`, `wallet`) — giữ và kiểm tra lại |
| Banner / Subscription mua | Emit admin + seller; subscription hết hạn job emit + notification |
| Pagination nhiều list API | Sort thêm `_id: -1` để `page/limit` không trùng trang |
| Mongoose `findOneAndUpdate` | Đổi `new: true` → `returnDocument: "after"` |

## API đã bỏ

Không bỏ route public trong đợt này.

## Realtime types bổ sung / chuẩn hóa

- `review` — tạo/sửa/xóa/ẩn đánh giá
- `report` — xử lý báo cáo (user resource)
- `subscription` — mua + **hết hạn** (job)
- `withdraw`, `wallet`, `banner`, `order`, `product` — giữ nguyên

Chi tiết luồng: [REALTIME.md](./REALTIME.md).
