const mongoose = require("mongoose");
const {
  SELLER_BANNER_STATUS,
  BANNER_TARGET_TYPE,
} = require("../constants");

/**
 * SellerBannerPlan — lần mua gói banner + creative.
 * Luồng: PURCHASED → PENDING_REVIEW → ACTIVE | REJECTED.
 * startDate/endDate chỉ gắn khi admin duyệt.
 */
const SellerBannerPlanSchema = new mongoose.Schema({
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ShopProfile",
    required: true,
    index: true,
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BannerPlan",
    required: true,
    index: true,
  },
  planName: { type: String, default: "" },
  // Snapshot số ngày hiệu lực (dùng khi admin duyệt).
  durationDays: { type: Number, default: 7, min: 1 },
  amount: { type: Number, required: true, min: 0 },
  // Ngày mua gói (trừ ví).
  ngayMua: { type: Date, default: Date.now, index: true },
  // Ngày bắt đầu / hết hạn — null cho đến khi admin duyệt.
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null, index: true },
  status: {
    type: Number,
    enum: Object.values(SELLER_BANNER_STATUS),
    default: SELLER_BANNER_STATUS.PURCHASED,
    index: true,
  },
  // Ngày admin duyệt treo (null = chưa duyệt / legacy chưa chuẩn hóa).
  approvedAt: { type: Date, default: null },
  violationReason: { type: String, default: "", trim: true },

  image: { type: String, default: "" },
  targetType: {
    type: Number,
    enum: Object.values(BANNER_TARGET_TYPE),
    default: BANNER_TARGET_TYPE.SHOP,
  },
  targetId: { type: String, default: "" },
  clickCount: { type: Number, default: 0, min: 0 },

  CreatedAt: { type: Date, default: Date.now },
  UpdatedAt: { type: Date, default: Date.now },
});

SellerBannerPlanSchema.index({ shopId: 1, status: 1, endDate: -1 });
SellerBannerPlanSchema.index({ status: 1, endDate: -1, CreatedAt: -1 });
SellerBannerPlanSchema.index({ shopId: 1, ngayMua: -1 });

SellerBannerPlanSchema.pre("save", function saveHook() {
  this.UpdatedAt = new Date();
});

module.exports = mongoose.model("SellerBannerPlan", SellerBannerPlanSchema);
