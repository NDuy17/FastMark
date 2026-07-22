/**
 * Gỡ field OTP cũ trên User — đã chuyển sang otpSessionStore (RAM),
 * không còn lưu trên document User.
 *
 * Chạy: node backend/scripts/cleanupUserOtpFields.js
 */
require("../config/env");
const mongoose = require("mongoose");

const STALE_USER_FIELDS = [
  "EmailVerifyCode",
  "EmailVerifyCodeExpiresAt",
  "EmailVerifyResendAt",
  "EmailVerifyFailCount",
  "SellerPhoneVerified",
  "SellerPhoneVerifyCode",
  "SellerPhoneVerifyCodeExpiresAt",
  "SellerPhoneVerifyFailCount",
  "SellerPhoneVerifyResendAt",
  "PhoneVerifyCode",
  "PhoneVerifyCodeExpiresAt",
  "PhoneVerifyFailCount",
  "PhoneVerifyResendAt",
];

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("Thiếu MONGO_URI");
  }

  await mongoose.connect(uri);
  const col = mongoose.connection.db.collection("users");

  const unset = {};
  for (const field of STALE_USER_FIELDS) {
    unset[field] = "";
  }

  const filter = {
    $or: STALE_USER_FIELDS.map((field) => ({ [field]: { $exists: true } })),
  };

  const before = await col.countDocuments(filter);
  console.log(`Users còn field OTP cũ: ${before}`);

  if (before === 0) {
    console.log("Không có gì cần dọn.");
    await mongoose.disconnect();
    return;
  }

  const result = await col.updateMany(filter, { $unset: unset });
  console.log(`Đã $unset: matched=${result.matchedCount}, modified=${result.modifiedCount}`);

  const after = await col.countDocuments(filter);
  console.log(`Còn lại sau cleanup: ${after}`);

  const sample = await col.findOne({}, { projection: { Email: 1, UserName: 1 } });
  if (sample) {
    const full = await col.findOne({ _id: sample._id });
    console.log("Keys mẫu sau cleanup:", Object.keys(full).sort().join(", "));
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
