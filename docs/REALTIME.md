# FastMark Realtime

Tài liệu luồng realtime (Socket.IO) cho Mobile App và Admin Web.

## Kênh sự kiện

| Event | Phạm vi | Mô tả |
|---|---|---|
| `admin_updated` | room `admin:all` | Mọi thay đổi tài nguyên admin cần theo dõi |
| `{type}_updated` | admin + user | Ví dụ `order_updated`, `review_updated`, `withdraw_updated` |
| `resource_updated` | user room | Mobile nhận cập nhật tài nguyên cá nhân (`type` trong payload) |
| `public_updated` | broadcast | Dữ liệu công khai (banner, product, review…) |
| `notification:new` / `notification_created` | user room | Thông báo in-app mới (+ FCM push) |
| `notification:read` | user room | Cập nhật số chưa đọc (`unreadCounts.buyer/seller`) |
| `order_updated` | buyer + seller + admin | Trạng thái đơn giữ hàng |

Payload chung:

```json
{
  "type": "review|order|withdraw|wallet|banner|subscription|report|product|...",
  "updatedAt": "ISO-8601",
  "...": "field theo loại tài nguyên"
}
```

## 1. Đánh giá (Review)

**Khi khách tạo / sửa / xóa đánh giá** (`buyerReviewService`):

1. Cập nhật `ShopProfile.totalReviews` + `averageRating`.
2. Tạo notification `audience=seller` cho chủ shop (kèm FCM push nếu app nền/tắt).
3. Emit:
   - `admin_updated` / `review_updated` → Admin Review Management
   - `public_updated` → client công khai
   - `resource_updated` (`type=review`) → seller (điểm, tổng, danh sách)

**Khi admin ẩn / xóa đánh giá** (`adminReviewService`):

- Notification cho người đánh giá (`audience=buyer`).
- Emit admin + `resource_updated` cho seller và buyer.

**Client:**

- Seller: `SellerReviewsManageScreen` silent refresh; `ShopTabPanel` reload shop settings (điểm / tổng).
- Buyer: `MyReviewsScreen` remove/update khi bị ẩn/xóa.
- Admin: `ReviewManagement` silent coalesce refresh.

## 2. Báo cáo / khiếu nại

**Khi admin duyệt / bác bỏ** (`adminReportService`):

- `createNotification` cho người gửi báo cáo.
- `emitUserResourceUpdated(reporter, "report", { reportId, status })`.
- `emitAdminUpdated("report", …)`.

Admin web: `ReportManagement` silent refresh.

## 3. Rút tiền

**Tạo yêu cầu** (`withdrawService.createWithdraw`):

- `emitAdminUpdated("withdraw")` → Admin thấy ngay.
- `emitUserResourceUpdated` wallet + withdraw cho user.
- Notification seller.

**Admin duyệt / từ chối**:

- Cập nhật số dư + lịch sử ví.
- Emit `withdraw` + `wallet` cho user.
- Notification kết quả.

**Client:**

- Admin: `WithdrawalsPage`, `FinancePage`, `DashboardPage` silent.
- Mobile: `WalletScreen`, `WithdrawScreen` silent merge theo id.

## 4. Dashboard Admin & Tài chính

- `DashboardPage` lắng nghe `*` với `coalesceMs` + `silent` + `keepIfSame`.
- `FinancePage` lắng nghe `wallet` + `withdraw`.
- Không F5; không thay skeleton khi realtime.

Nguồn số liệu thay đổi khi có event: `order`, `wallet`, `withdraw`, `product`, `account`, `subscription`, `banner`, `review`, `report`, …

## 5. Banner

`sellerBannerService` emit:

- `admin_updated` / `banner_updated`
- `resource_updated` cho seller
- `public_updated` khi ảnh hưởng trang chủ

Luồng: mua → chờ duyệt → duyệt/từ chối → active / hủy / hết hạn theo `endDate`.

Client: Admin `SellerBannersPage` silent; Mobile `SellerBannerScreen` + Home `public_updated`.

## 6. Gói Seller

**Mua / gia hạn** (`sellerSubscriptionService`):

- Trừ ví, emit `subscription` + `wallet` (admin + user).

**Hết hạn** (`sellerPlanAccessService.expireDueSubscriptions`, job 10 phút):

- Đổi status → `EXPIRED`.
- Emit admin + seller `subscription`.
- Notification “Gói Seller đã hết hạn”.
- Nếu shop không còn gói active → `isActive=false`, ẩn sản phẩm, emit thêm `shop_deactivated`.

Client: Admin `SellerSubscriptionsPage` + `DashboardPage`; Mobile `SellerSubscriptionScreen` + `ShopTabPanel`.

## Nguyên tắc chống nháy (Mobile + Web)

1. Không `setLoading(true)` trên đường realtime (dùng `silent`).
2. Không thay cả mảng state nếu nội dung không đổi (`mergeListById` / `keepIfSame`).
3. Gộp event dồn (`coalesceMs ≈ 1000ms`) vì admin nhận event toàn hệ thống.
4. FlatList / table row: key ổn định theo `id`, ưu tiên `React.memo` cho hàng lớn.
5. Đơn hàng: cập nhật đúng item (`upsertById` / `removeById`), không refetch cả list khi có thể.

## API liên quan thông báo

| Method | Path | Ghi chú |
|---|---|---|
| `GET` | `/api/notifications` | Có `unreadCount` theo audience |
| `GET` | `/api/notifications/unread-count` | Badge chính xác, không suy từ trang list |
| `POST` | `/api/notifications/:id/read` | Trả `unreadCounts.buyer/seller` qua socket |

## Checklist kiểm thử nhanh

- [ ] Buyer đánh giá → seller nhận notification + badge tăng + danh sách đánh giá cập nhật không nháy
- [ ] Admin xử lý báo cáo → reporter nhận notification ngay
- [ ] Tạo rút tiền → admin Withdrawals thấy đơn mới không F5
- [ ] Admin duyệt rút → seller số dư + lịch sử ví cập nhật
- [ ] Dashboard / Finance đổi số khi có order/wallet/withdraw
- [ ] Mua / duyệt banner → admin + home + seller cập nhật
- [ ] Mua gói / hết hạn gói → seller nhận thông báo + trạng thái gói
