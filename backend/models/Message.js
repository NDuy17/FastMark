const mongoose = require("mongoose");

/**
 * Message — một tin nhắn trong Conversation.
 */
const MessageSchema = new mongoose.Schema({
  // Cuộc trò chuyện chứa tin này (ref Conversation).
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", index: true },
  // Người gửi (ref User).
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  // Thứ tự tin trong conversation (tăng dần từ Conversation.nextThuTu).
  ThuTu: { type: Number, default: 0, index: true },
  // Loại tin: 0 = text, 1 = ảnh, 2 = offer/đề nghị giá.
  messageType: { type: Number, default: 0 },
  // Nội dung chữ (tin text / offer). Tin ảnh để trống.
  content: { type: String, default: "" },
  // URL ảnh (messageType = 1).
  imageUrl: { type: String, default: "" },
  // Đã đọc phía đối phương: 0 = chưa đọc, 1 = đã đọc.
  isRead: { type: Number, default: 0 },
  // Trạng thái gửi: 0 = gửi, 1 = đã tới, 2 = đã xem.
  messageStatus: { type: Number, default: 0 },
  // Soft delete — thời điểm xóa (null = còn hiệu lực).
  DeletedAt: { type: Date, default: null },
  CreatedAt: { type: Date, default: Date.now },
  UpdatedAt: { type: Date, default: Date.now },
});

MessageSchema.index({ conversationId: 1, ThuTu: 1 });

module.exports = mongoose.model("Message", MessageSchema);
