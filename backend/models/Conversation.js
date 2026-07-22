const mongoose = require("mongoose");

/**
 * Conversation — chat 1-1 giữa hai User.
 * participantA / participantB luôn sắp xếp A < B (string ObjectId) để unique.
 */
const ConversationSchema = new mongoose.Schema({
  // User tham gia (ObjectId nhỏ hơn theo so sánh string).
  participantA: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  // User tham gia (ObjectId lớn hơn).
  participantB: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  // Nội dung tin nhắn cuối (preview inbox).
  lastMessage: String,
  // Thời điểm tin cuối.
  lastMessageAt: Date,
  // Bộ đếm thứ tự tin tiếp theo trong conversation (gán vào Message.ThuTu).
  nextThuTu: { type: Number, default: 0 },
  // Thời điểm tạo cuộc trò chuyện.
  CreatedAt: { type: Date, default: Date.now },
  // Thời điểm cập nhật gần nhất.
  UpdatedAt: { type: Date, default: Date.now },
});

ConversationSchema.index({ participantA: 1, participantB: 1 }, { unique: true });

module.exports = mongoose.model("Conversation", ConversationSchema);
