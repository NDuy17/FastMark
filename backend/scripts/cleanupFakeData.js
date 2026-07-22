/**
 * Xóa dữ liệu demo/fake còn sót trong MongoDB.
 * Chạy: npm run cleanup:fake
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });

const mongoose = require("mongoose");

async function main() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("Missing MONGODB_URI in environment.");
  }

  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;

  const summary = {};

  const reviews = await db.collection("reviews").deleteMany({
    $or: [
      { legacyExternalId: { $regex: /^seed-admin-review/i } },
      { externalId: { $regex: /^seed-admin-review/i } },
      { comment: { $regex: /seed-admin-review/i } },
    ],
  });
  summary.seedAdminReviews = reviews.deletedCount;

  const reports = await db.collection("reports").deleteMany({
    content: { $regex: /seed-report-demo/i },
  });
  summary.seedDemoReports = reports.deletedCount;

  // Legacy collections: userfollows / shopfollows (đã thay bằng follows)
  try {
    const userFollows = await db.collection("userfollows").deleteMany({});
    summary.legacyUserFollows = userFollows.deletedCount;
  } catch {
    summary.legacyUserFollows = 0;
  }
  try {
    const shopFollows = await db.collection("shopfollows").deleteMany({});
    summary.legacyShopFollows = shopFollows.deletedCount;
  } catch {
    summary.legacyShopFollows = 0;
  }

  // Trường không còn dùng trên ShopProfile
  const shops = await db.collection("shopprofiles").updateMany(
    {},
    { $unset: { totalLikes: "" } }
  );
  summary.shopProfilesUnsetTotalLikes = shops.modifiedCount;

  console.log("Cleanup fake/legacy data completed:", summary);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
