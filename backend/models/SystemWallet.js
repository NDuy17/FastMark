const mongoose = require("mongoose");

/**
 * SystemWallet — ví hệ thống (escrow) giữ tiền cọc giữ hàng.
 * Singleton: key = "system".
 */
const SystemWalletSchema = new mongoose.Schema({
  // Khóa singleton, luôn "system".
  key: { type: String, default: "system", unique: true },
  // Số dư đang giữ (VND) — tổng cọc escrow chưa release/refund.
  balance: { type: Number, default: 0, min: 0 },
  // Thời điểm tạo bản ghi.
  CreatedAt: { type: Date, default: Date.now },
  // Thời điểm cập nhật gần nhất (auto trong pre-save).
  UpdatedAt: { type: Date, default: Date.now },
});

SystemWalletSchema.pre("save", function saveHook() {
  this.UpdatedAt = new Date();
});

module.exports = mongoose.model("SystemWallet", SystemWalletSchema);
