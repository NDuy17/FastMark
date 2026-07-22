const mongoose = require("mongoose");

/**
 * ReportImage — ảnh minh chứng đính kèm một báo cáo.
 */
const ReportImageSchema = new mongoose.Schema({
  // Báo cáo cha (ref Report).
  reportId: { type: mongoose.Schema.Types.ObjectId, ref: "Report" },
  // URL ảnh minh chứng.
  imageUrl: String,

  // Thời điểm thêm ảnh.
  CreatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ReportImage", ReportImageSchema);
