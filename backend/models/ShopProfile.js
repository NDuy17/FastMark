const mongoose = require("mongoose");

/**
 * ShopProfile — hồ sơ gian hàng gắn với User đã được duyệt seller.
 * Tên / username lấy từ User (FullName / UserName), không lưu trùng.
 * Muốn dùng tính năng bán hàng công khai: cần SellerSubscription Active (isActive = true).
 */
const ShopProfileSchema = new mongoose.Schema({
  // Chủ gian hàng (ref User, Role seller).
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },

  // Mô tả gian hàng.
  description: { type: String, default: "" },

  // Địa chỉ chuẩn hóa từ hệ thống / geocode.
  addressHeThong: { type: String, default: "" },

  // Vĩ độ (GPS), null nếu chưa có.
  latitude: { type: Number, default: null },
  // Kinh độ (GPS), null nếu chưa có.
  longitude: { type: Number, default: null },

  // Danh mục loại gian hàng (ref ShopCategory).
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "ShopCategory" },

  // Giờ mở cửa (chuỗi "HH:mm"), tùy chọn.
  openTime: { type: String, default: "" },
  // Giờ đóng cửa (chuỗi "HH:mm"), tùy chọn.
  closeTime: { type: String, default: "" },
  // Ghim giờ mở/đóng trên trang shop công khai.
  pinHours: { type: Boolean, default: false },
  // Trạng thái mở cửa hiển thị: 1 = đang mở, 0 = đóng cửa.
  isOpen: { type: Number, default: 1 },

  // Trạng thái gian hàng: 1 = hoạt động, 0 = bị khóa (admin).
  status: { type: Number, default: 1 },

  // Đang online (presence realtime của gian hàng).
  DangHoatDong: { type: Boolean, default: false },
  // Lần hoạt động gần nhất của gian hàng.
  LanHoatDongCuoi: { type: Date, default: null },

  // Cache từ SellerSubscription Active — public cần status ACTIVE + isActive true.
  isActive: { type: Boolean, default: false, index: true },

  // Điểm đánh giá trung bình (0–5).
  averageRating: { type: Number, default: 0 },
  // Tổng số đánh giá.
  totalReviews: { type: Number, default: 0 },
  // Tổng số sản phẩm đang có.
  totalProducts: { type: Number, default: 0 },
  // Tổng số lượng đã bán.
  soldCount: { type: Number, default: 0 },

  // % đặt cọc khi giữ hàng (0–100; 0 = không cọc). Ví dụ 10, 30, 50.
  cocTien: { type: Number, default: 0, min: 0, max: 100 },

  /**
   * Giá trị QR cố định của shop (thường = shopId).
   * Buyer quét QR này để xác nhận nhận hàng — không tạo QR theo từng đơn.
   */
  qrCodeValue: { type: String, default: "", index: true },

  // Thời điểm tạo hồ sơ gian hàng.
  CreatedAt: { type: Date, default: Date.now },
  // Thời điểm cập nhật gần nhất (auto trong pre-save).
  UpdatedAt: { type: Date, default: Date.now },
});

ShopProfileSchema.pre("save", function saveHook() {
  this.UpdatedAt = new Date();
});

module.exports = mongoose.model("ShopProfile", ShopProfileSchema);
