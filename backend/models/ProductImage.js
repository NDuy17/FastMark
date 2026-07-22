const mongoose = require("mongoose");

/**
 * ProductImage — ảnh thumbnail / gallery của sản phẩm.
 * Có Stt; ảnh Stt nhỏ nhất (thường 0) = ảnh đại diện trên list item.
 * Không dùng cho ảnh biến thể (xem ProductVariant.ImageUrl).
 */
const ProductImageSchema = new mongoose.Schema({
  // Sản phẩm sở hữu ảnh (ref Product).
  ProductId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
    index: true,
  },

  // URL ảnh thumbnail/gallery (Supabase / CDN).
  ImageUrl: { type: String, required: true, trim: true },

  // Thứ tự: 0, 1, 2… — ảnh đầu (Stt = 0) = cover list.
  Stt: { type: Number, default: 0, min: 0, index: true },

  // Thời điểm upload.
  UploadedAt: { type: Date, default: Date.now },
});

ProductImageSchema.index({ ProductId: 1, Stt: 1 });

module.exports = mongoose.model("ProductImage", ProductImageSchema);
