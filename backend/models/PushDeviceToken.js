const mongoose = require("mongoose");

/**
 * FCM / native device push token gắn với user (1 token = 1 thiết bị).
 */
const PushDeviceTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  token: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true,
  },
  platform: {
    type: String,
    enum: ["android", "ios", "web", "unknown"],
    default: "unknown",
  },
  CreatedAt: { type: Date, default: Date.now },
  UpdatedAt: { type: Date, default: Date.now },
});

PushDeviceTokenSchema.pre("save", function saveHook() {
  this.UpdatedAt = new Date();
});

module.exports = mongoose.model("PushDeviceToken", PushDeviceTokenSchema);
