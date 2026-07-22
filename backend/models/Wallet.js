const mongoose = require("mongoose");

/**
 * Wallet — số dư ví gắn 1-1 với User (buyer/seller dùng chung).
 */
const WalletSchema = new mongoose.Schema({
  // Chủ ví (ref User), unique 1-1.
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
    index: true,
  },
  // Số dư hiện tại (VND).
  balance: { type: Number, default: 0, min: 0 },
  // Thời điểm tạo ví.
  CreatedAt: { type: Date, default: Date.now },
  // Thời điểm cập nhật gần nhất (auto trong pre-save).
  UpdatedAt: { type: Date, default: Date.now },
});

WalletSchema.pre("save", function saveHook() {
  this.UpdatedAt = new Date();
});

module.exports = mongoose.model("Wallet", WalletSchema);
