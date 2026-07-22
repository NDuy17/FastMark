const mongoose = require("mongoose");

/**
 * ReviewImage — ảnh đính kèm đánh giá (nhiều ảnh / 1 review).
 */
const ReviewImageSchema = new mongoose.Schema({
  // Đánh giá sở hữu ảnh (ref Review).
  reviewId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Review",
    required: true,
    index: true,
  },

  // URL ảnh.
  ImageUrl: { type: String, required: true, trim: true },

  // Thứ tự hiển thị (0, 1, 2…).
  Stt: { type: Number, default: 0, min: 0, index: true },

  // Thời điểm upload.
  UploadedAt: { type: Date, default: Date.now },
});

ReviewImageSchema.index({ reviewId: 1, Stt: 1 });

module.exports = mongoose.model("ReviewImage", ReviewImageSchema);
