const mongoose = require("mongoose");

/**
 * ReservationAuditLog — nhật ký admin xử lý tranh chấp giữ hàng.
 * action ví dụ: ADMIN_REFUND_BUYER | ADMIN_RELEASE_SELLER.
 */
const ReservationAuditLogSchema = new mongoose.Schema({
  // Admin thực hiện thao tác (ref User).
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  // Đơn giữ hàng liên quan (ref Reservation).
  reservationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Reservation",
    required: true,
    index: true,
  },
  // Hành động: ADMIN_REFUND_BUYER | ADMIN_RELEASE_SELLER.
  action: { type: String, required: true, index: true },
  // Kết quả: buyer_win | seller_win.
  decision: { type: String, default: "" },
  // Ghi chú của admin.
  note: { type: String, default: "" },
  // Thời điểm ghi nhật ký.
  CreatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ReservationAuditLog", ReservationAuditLogSchema);
