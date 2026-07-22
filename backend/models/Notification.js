const mongoose = require("mongoose");
const { NOTIFICATION_AUDIENCE } = require("../constants");

/**
 * Notification — thông báo trong app (buyer / seller / hệ thống).
 */
const NotificationSchema = new mongoose.Schema({
  // Người nhận (ref User).
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },

  // Tiêu đề thông báo.
  title: String,
  // Nội dung thông báo.
  content: String,

  // Đối tượng hiển thị: "buyer" | "seller" | "system" (hiện cả 2 chế độ).
  audience: {
    type: String,
    enum: Object.values(NOTIFICATION_AUDIENCE),
    default: NOTIFICATION_AUDIENCE.SYSTEM,
    index: true,
  },

  // Đã đọc: 0 = chưa đọc, 1 = đã đọc.
  isRead: { type: Number, default: 0 },

  // Thời điểm tạo thông báo.
  CreatedAt: { type: Date, default: Date.now },
  // Thời điểm cập nhật gần nhất.
  UpdatedAt: { type: Date, default: Date.now },
});

NotificationSchema.index({ userId: 1, audience: 1, CreatedAt: -1 });

module.exports = mongoose.model("Notification", NotificationSchema);
