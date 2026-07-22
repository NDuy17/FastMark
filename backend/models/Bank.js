const mongoose = require("mongoose");

/**
 * Bank — ngân hàng do admin cấu hình cho tính năng rút tiền.
 * Chỉ bank isActive=true mới hiện cho user khi rút.
 */
const BankSchema = new mongoose.Schema({
  // Tên ngân hàng (VD: Vietcombank).
  name: { type: String, required: true, trim: true },
  // Mã ngắn (VD: VCB) — unique không phân biệt hoa thường.
  code: { type: String, required: true, trim: true, uppercase: true },
  // Bật = user được chọn khi rút tiền.
  isActive: { type: Boolean, default: true, index: true },
  // Thời điểm thêm ngân hàng.
  CreatedAt: { type: Date, default: Date.now },
  // Thời điểm cập nhật gần nhất (auto trong pre-save).
  UpdatedAt: { type: Date, default: Date.now },
});

BankSchema.index({ code: 1 }, { unique: true });
BankSchema.pre("save", function saveHook() {
  this.UpdatedAt = new Date();
  if (this.code) {
    this.code = String(this.code).trim().toUpperCase();
  }
});

module.exports = mongoose.model("Bank", BankSchema);
