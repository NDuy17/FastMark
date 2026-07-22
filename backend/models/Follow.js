const mongoose = require("mongoose");

/**
 * Follow — quan hệ theo dõi giữa 2 User (theo dõi bất kỳ ai).
 * followerId → followedUserId
 */
const FollowSchema = new mongoose.Schema({
  // Người đi theo dõi (ref User).
  followerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  // Người được theo dõi — bất kỳ User nào (ref User).
  followedUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  // Thời điểm bắt đầu follow.
  CreatedAt: { type: Date, default: Date.now },
});

FollowSchema.index({ followerId: 1, followedUserId: 1 }, { unique: true });
FollowSchema.index({ followedUserId: 1, CreatedAt: -1 });
FollowSchema.index({ followerId: 1, CreatedAt: -1 });

module.exports = mongoose.model("Follow", FollowSchema);
