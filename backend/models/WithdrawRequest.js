const mongoose = require("mongoose");
const { WITHDRAW_STATUS } = require("../constants");

/**
 * WithdrawRequest — yêu cầu rút tiền về ngân hàng.
 * Tiền đã trừ khỏi ví khi tạo (PENDING). Duyệt = SUCCESS, từ chối = hoàn ví + REJECTED.
 */
const WithdrawRequestSchema = new mongoose.Schema({
  // User yêu cầu rút tiền (ref User).
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  // Ngân hàng đích do admin cấu hình (ref Bank).
  bankId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Bank",
    required: true,
    index: true,
  },
  // Snapshot tên ngân hàng lúc yêu cầu.
  bankName: { type: String, required: true, trim: true },
  // Snapshot mã ngân hàng lúc yêu cầu (VD: VCB).
  bankCode: { type: String, default: "", trim: true },
  // Số tài khoản nhận tiền.
  accountNumber: { type: String, required: true, trim: true },
  // Tên chủ tài khoản (thường viết hoa).
  accountName: { type: String, required: true, trim: true },
  // Số tiền rút (VND).
  amount: { type: Number, required: true, min: 1 },
  // Trạng thái: PENDING (0) | APPROVED (1) | REJECTED (2).
  status: {
    type: Number,
    enum: Object.values(WITHDRAW_STATUS),
    default: WITHDRAW_STATUS.PENDING,
    index: true,
  },
  // Giao dịch ví loại WITHDRAWAL (PENDING → SUCCESS/CANCELLED).
  walletTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "WalletTransaction",
    default: null,
  },
  // Giao dịch hoàn khi admin từ chối.
  refundTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "WalletTransaction",
    default: null,
  },
  // Ghi chú admin khi duyệt/từ chối (hiện trên app).
  adminNote: { type: String, default: "", trim: true },
  // Admin xử lý yêu cầu (ref User).
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  // Thời điểm admin duyệt hoặc từ chối.
  processedAt: { type: Date, default: null },
  // Thời điểm tạo yêu cầu.
  CreatedAt: { type: Date, default: Date.now },
  // Thời điểm cập nhật gần nhất (auto trong pre-save).
  UpdatedAt: { type: Date, default: Date.now },
});

WithdrawRequestSchema.pre("save", function saveHook() {
  this.UpdatedAt = new Date();
});

module.exports = mongoose.model("WithdrawRequest", WithdrawRequestSchema);
