const mongoose = require("mongoose");

/**
 * FavoriteProduct — user yêu thích sản phẩm (buyer/seller cùng User).
 * Một cặp (userId, productId) chỉ một bản ghi.
 */
const FavoriteProductSchema = new mongoose.Schema({
  // Người yêu thích (ref User).
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  // Sản phẩm được yêu thích (ref Product).
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
  // Thời điểm thêm yêu thích.
  CreatedAt: { type: Date, default: Date.now },
});

FavoriteProductSchema.index({ userId: 1, productId: 1 }, { unique: true });

module.exports = mongoose.model("FavoriteProduct", FavoriteProductSchema);
