const mongoose = require("mongoose");

/**
 * Report — báo cáo / khiếu nại.
 *
 * Hai nhóm:
 * 1) Nội dung: review / user / shop / product / system / other (reportType 1–4, 8–9).
 * 2) Giữ hàng / tranh chấp cọc: BUYER_NO_SHOW / SELLER_NO_SHOW / … (5–7, 9)
 *    — gắn reservationId, GPS, mô tả; tối đa 5 ReportImage.
 */
const ReportSchema = new mongoose.Schema({
  // Người gửi báo cáo (ref User).
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  // User bị báo cáo (buyer hoặc seller tùy loại).
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  // Sản phẩm bị báo cáo (nếu reportType = product / product issue).
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  // Gian hàng bị báo cáo / liên quan.
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: "ShopProfile", index: true },
  // Đơn giữ hàng liên quan (bắt buộc với reportType 5–8).
  reservationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Reservation",
    default: null,
    index: true,
  },
  // ID đánh giá bị báo cáo (string, legacy; khi reportType = 1).
  reviewId: { type: String, default: "" },

  /**
   * Loại báo cáo:
   * 1 đánh giá | 2 user | 3 shop | 4 product
   * 5 BUYER_NO_SHOW | 6 SELLER_NO_SHOW | 7 PRODUCT_ISSUE
   * 8 SYSTEM | 9 OTHER
   */
  reportType: { type: Number, required: true, index: true },
  /**
   * Vai trò người gửi báo cáo tranh chấp giữ hàng:
   * 1 = người mua báo người bán | 2 = người bán báo người mua.
   * null với các báo cáo nội dung (reportType 1–4).
   */
  reporterRole: { type: Number, default: null, index: true },
  // Tiêu đề ngắn.
  title: String,
  // Nội dung chi tiết / mô tả chứng cứ.
  content: String,

  // GPS lúc gửi báo cáo (tranh chấp giữ hàng) — dùng chung / buyer.
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null },
  // Địa chỉ reverse-geocode tại thời điểm báo cáo (buyer / chung).
  address: { type: String, default: "" },

  // Trường riêng khi người bán báo cáo (BUYER_NO_SHOW).
  sellerTitle: { type: String, default: "" },
  sellerContent: { type: String, default: "" },
  sellerLatitude: { type: Number, default: null },
  sellerLongitude: { type: Number, default: null },
  // Địa chỉ reverse-geocode khi seller báo cáo.
  sellerAddress: { type: String, default: "" },

  // Trạng thái: 0 = chờ xử lý, 1 = đã duyệt/xử lý, 2 = bác bỏ.
  status: { type: Number, default: 0, index: true },

  // Admin xử lý (ref User).
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  // Thời điểm admin xử lý.
  processedAt: Date,
  // Ghi chú / quyết định admin (approve-buyer | approve-seller | reject).
  adminDecision: { type: String, default: "" },
  // Ghi chú xử lý của admin.
  adminNote: { type: String, default: "" },

  // Thời điểm tạo báo cáo.
  CreatedAt: { type: Date, default: Date.now },
  // Thời điểm cập nhật gần nhất.
  UpdatedAt: { type: Date, default: Date.now },
});

ReportSchema.pre("save", function saveHook() {
  this.UpdatedAt = new Date();
});

ReportSchema.index(
  { reservationId: 1, reportType: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      reservationId: { $type: "objectId" },
      status: { $in: [0, 1] },
    },
  }
);

module.exports = mongoose.model("Report", ReportSchema);
