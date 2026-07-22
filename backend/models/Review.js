const mongoose = require("mongoose");

/**
 * Review — đánh giá sản phẩm đã mua (qua đơn giữ hàng hoàn thành).
 */
const ReviewSchema = new mongoose.Schema({
  // Người viết đánh giá (ref User).
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },

  // Gian hàng của sản phẩm (ref ShopProfile).
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ShopProfile",
    required: true,
    index: true,
  },

  // Sản phẩm đã mua được đánh giá (ref Product).
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
    index: true,
  },

  // Đơn giữ hàng đã hoàn thành gắn với đánh giá (ref Reservation).
  reservationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Reservation",
    required: true,
    index: true,
  },

  // Số sao 1–5.
  rating: { type: Number, required: true, min: 1, max: 5 },
  // Nội dung chữ.
  comment: { type: String, default: "" },

  // Admin ẩn khỏi trang công khai.
  isHidden: { type: Boolean, default: false, index: true },
  // Xóa mềm.
  isDeleted: { type: Boolean, default: false, index: true },
  // Thời điểm xóa mềm (null nếu chưa xóa).
  deletedAt: { type: Date, default: null },

  // Thời điểm tạo đánh giá.
  CreatedAt: { type: Date, default: Date.now },
  // Thời điểm cập nhật gần nhất (auto trong pre-save).
  UpdatedAt: { type: Date, default: Date.now },
});

ReviewSchema.index({ shopId: 1, CreatedAt: -1 });
ReviewSchema.index({ productId: 1, CreatedAt: -1 });
ReviewSchema.index({ userId: 1, CreatedAt: -1 });
ReviewSchema.index(
  { reservationId: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: { $ne: true } },
    name: "reservationId_1_active",
  }
);

ReviewSchema.pre("save", function saveHook() {
  this.UpdatedAt = new Date();
});

module.exports = mongoose.model("Review", ReviewSchema);
