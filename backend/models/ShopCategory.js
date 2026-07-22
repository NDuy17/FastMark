const mongoose = require("mongoose");

/**
 * ShopCategory — danh mục loại gian hàng (admin quản lý).
 * Collection Mongo: "shopcategories".
 */
const ShopCategorySchema = new mongoose.Schema({
  // Tên danh mục gian hàng (unique).
  name: { type: String, required: true, unique: true, trim: true },
  // Mô tả danh mục.
  description: String,
  // Cờ dùng/xóa mềm: 1 = đang dùng, 0 = xóa mềm.
  IsDeleted: { type: Number, default: 1 },
  // Thời điểm tạo danh mục.
  CreatedAt: { type: Date, default: Date.now },
  // Thời điểm cập nhật gần nhất (auto trong pre-save).
  UpdatedAt: { type: Date, default: Date.now },
});

ShopCategorySchema.pre("save", function touchUpdatedAt() {
  this.UpdatedAt = new Date();
});

module.exports = mongoose.model("ShopCategory", ShopCategorySchema, "shopcategories");
