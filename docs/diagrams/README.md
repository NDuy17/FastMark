# FastMark – Sơ đồ Use Case & Activity (.drawio)

Mở bằng [app.diagrams.net](https://app.diagrams.net).

## Use Case (checklist đầy đủ)
| File | Nội dung |
|------|----------|
| **`00-UC-Checklist-Day-du.drawio`** | **File chính** – 4 trang: Tổng quan + Buyer + Seller + Admin (đúng checklist) |
| `03-UC-Buyer.drawio` | Buyer đầy đủ |
| `04-UC-Seller.drawio` | Seller đầy đủ |
| `06-UC-Admin.drawio` | Admin đầy đủ |
| `01` `02` `05` | Bản rút gọn / Auth / Ví (tham khảo thêm) |

### Mapping checklist → FastMark hiện tại
| Checklist | Trong code FastMark |
|-----------|---------------------|
| Voucher | **Khuyến mãi % giảm giá** (+ bulk), không có mã voucher riêng |
| Lọc theo giá | Khoảng giá biến thể / discover; bộ lọc giá riêng có thể mở rộng |
| Chia sẻ sản phẩm | Share OS / deep link (tùy bản build) |
| Ảnh bìa shop | Cover/avatar trên StoreDetail + cài đặt shop |
| Phản hồi đánh giá | Seller **xem + báo cáo** đánh giá |
| Biểu đồ D/M/Y | Admin **Dashboard / Finance** theo khoảng ngày |

## Activity 3 cột
| File | Vai trò |
|------|---------|
| `08-Activity-Buyer-3cot.drawio` | Buyer |
| `09-Activity-Seller-3cot.drawio` | Seller |
| `10-Activity-Admin-3cot.drawio` | Admin |

## Tái tạo
```bash
node docs/diagrams/generate-uc-checklist.js
node docs/diagrams/generate-activity-swimlanes.js
```

## Giữ hàng (chi tiết)
| File | Trang |
|------|-------|
| `11-Activity-Dat-va-Chap-nhan-giu-hang.drawio` | 1) Buyer đặt giữ hàng  2) Seller chấp nhận / từ chối |
| **`12-Activity-Giao-nhan-hang-Tranh-chap.drawio`** | **1 trang chung** — Buyer \| Seller \| Hệ thống (giao nhận + tranh chấp) |

```bash
node docs/diagrams/generate-activity-reservation.js
node docs/diagrams/generate-activity-delivery.js
```

### File 12 — luồng giao nhận (rẽ → gộp)
- **Chung:** Seller đã accept → `WAITING_PICKUP` · cọc hold · hạn = `pickupTime + 24h`
- **Seller hủy sau xác nhận:** lý do + 1–5 ảnh → `REFUNDED` · hoàn cọc Buyer · thông báo Buyer · Admin tab “Shop hủy sau xác nhận”
- **Nhánh A — Chưa tới giờ:** Buyer quét QR ↔ Seller đưa QR → `COMPLETED` · cọc Seller
- **Nhánh B — Đã tới/quá giờ (24h):**
  - **Buyer:** mất cọc | báo Seller vắng (+GPS/ảnh) | không làm gì
  - **Seller:** tố Buyer no-show (+GPS/ảnh) | không tố
- **Gộp báo cáo** → `DISPUTED` · Buyer vẫn có thể forfeit
- **Gộp job +24h:** 0 báo → `AUTO_COMPLETED` · chỉ Buyer → `REFUNDED` · chỉ Seller → `DISPUTE_RESOLVED` · cả hai → Admin

Seller sau accept: hủy (có chứng minh) / đưa QR / tố no-show — **không** tự complete đơn.
