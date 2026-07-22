const mongoose = require("mongoose");

/**
 * Reservation — đơn giữ hàng giữa buyer và shop.
 *
 * Luồng cọc (escrow System Wallet):
 * 1) Buyer đặt giữ → trừ ví buyer → System Wallet (DepositHold)
 *    depositPaidAt set; depositSettleTo = 0
 * 2a) Seller từ chối / hủy → hoàn buyer: depositSettleTo = 1, depositSettledAt
 * 2b) Seller đồng ý → WaitingPickup
 * 3) Hoàn tất (QR / forfeit / auto / admin release) → seller: depositSettleTo = 2
 * 4) Admin/dispute refund → buyer: depositSettleTo = 1
 * GD chi tiết xem WalletTransaction theo reservationId.
 */
const ReservationSchema = new mongoose.Schema({
  // Biến thể được giữ (ref ProductVariant).
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant" },
  // Gian hàng (ref ShopProfile).
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: "ShopProfile", index: true },
  // Sản phẩm (ref Product).
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  // Buyer đặt giữ (ref User).
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },

  // Số lượng giữ.
  quantity: Number,
  // Giá đơn vị lúc đặt giữ (VND).
  reservedPrice: Number,
  // Thời điểm hẹn nhận hàng.
  pickupTime: { type: Date, index: true },
  // Ghi chú của buyer.
  note: String,

  /**
   * Trạng thái đơn:
   * 0 = PendingSellerConfirmation (chờ shop đồng ý)
   * 1 = Rejected (shop từ chối, đã hoàn cọc)
   * 2 = WaitingPickup / ACCEPTED|READY (đã đồng ý, chờ nhận hàng)
   * 3 = Completed (buyer xác nhận nhận hàng)
   * 4 = Disputed (có Report sau giờ lấy)
   * 5 = AutoCompleted (hết hạn báo cáo, tự hoàn tất + release cọc)
   * 6 = Refunded (hoàn cọc)
   */
  status: { type: Number, default: 0, index: true },

  // Thời điểm seller đồng ý giữ hàng.
  sellerConfirmedAt: { type: Date, default: null },
  // Hạn báo cáo = pickupTime + 24h (legacy, đồng bộ với autoReleaseAt).
  reviewDeadlineAt: { type: Date, default: null, index: true },
  // Thời điểm hệ thống được phép auto-release cọc (= pickupTime + 24h).
  autoReleaseAt: { type: Date, default: null, index: true },

  // Thời điểm hoàn thành đơn (QR / admin / auto).
  completedAt: { type: Date, default: null },
  // Thời điểm hủy đơn.
  cancelledAt: Date,
  // Lý do hủy (nếu có).
  cancelReason: String,
  // true nếu đã giữ tồn kho (trừ Quantity biến thể).
  inventoryHeld: { type: Boolean, default: false },

  // % cọc áp dụng lúc đặt (snapshot từ shop.cocTien). 0 = không cọc.
  depositPercent: { type: Number, default: 0 },
  // Số tiền cọc (VND), giữ tại System Wallet đến khi settle. 0 = không cọc.
  depositAmount: { type: Number, default: 0 },
  // Thời điểm buyer đã trừ cọc thành công (vào System).
  depositPaidAt: { type: Date, default: null },
  // Thời điểm kết thúc cọc (hoàn buyer hoặc giải ngân seller).
  depositSettledAt: { type: Date, default: null },
  /**
   * Ai nhận cọc khi settle:
   * 0 = chưa settle (đang escrow)
   * 1 = hoàn người mua
   * 2 = giải ngân người bán
   */
  depositSettleTo: { type: Number, default: 0, enum: [0, 1, 2], index: true },

  // true nếu buyer đã mở tranh chấp sau pickupTime.
  disputeByBuyer: { type: Boolean, default: false },
  // true nếu seller đã mở tranh chấp (buyer no-show).
  disputeBySeller: { type: Boolean, default: false },
  // Mã lý do tranh chấp: shop_no_delivery | shop_closed | shop_out_of_stock | other | buyer_no_show.
  disputeReason: { type: String, default: "" },
  // Mô tả chi tiết tranh chấp.
  disputeDescription: { type: String, default: "" },
  // Thời điểm mở tranh chấp lần đầu.
  disputedAt: { type: Date, default: null },

  // Thời điểm tạo đơn.
  CreatedAt: { type: Date, default: Date.now },
  // Thời điểm cập nhật gần nhất (auto trong pre-save).
  UpdatedAt: { type: Date, default: Date.now },
});

ReservationSchema.pre("save", function saveHook() {
  this.UpdatedAt = new Date();
  // Đồng bộ autoReleaseAt ↔ reviewDeadlineAt khi chỉ set một trong hai.
  if (this.autoReleaseAt && !this.reviewDeadlineAt) {
    this.reviewDeadlineAt = this.autoReleaseAt;
  } else if (this.reviewDeadlineAt && !this.autoReleaseAt) {
    this.autoReleaseAt = this.reviewDeadlineAt;
  }
});

module.exports = mongoose.model("Reservation", ReservationSchema);
