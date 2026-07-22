/**
 * Sync ShopProfile.isActive từ SellerSubscription.
 * Usage: node backend/scripts/migrateSellerPlans.js
 */
require("../config/env");
const mongoose = require("mongoose");
const connectDB = require("../config/database");
const SellerSubscription = require("../models/SellerSubscription");
const ShopProfile = require("../models/ShopProfile");
const { SELLER_SUBSCRIPTION_STATUS } = require("../constants");

async function run() {
  await connectDB();
  const now = new Date();
  const shops = await ShopProfile.find({}).lean();
  let activated = 0;
  let deactivated = 0;

  for (const shop of shops) {
    const existing = await SellerSubscription.findOne({
      shopId: shop._id,
      status: SELLER_SUBSCRIPTION_STATUS.ACTIVE,
      endDate: { $gte: now },
    }).sort({ endDate: -1 });

    if (existing) {
      await ShopProfile.updateOne(
        { _id: shop._id },
        {
          $set: { isActive: true, UpdatedAt: now },
          $unset: {
            goiDangki: 1,
            ngayMua: 1,
            ngayHetHan: 1,
            subscriptionPlan: 1,
            subscriptionExpiresAt: 1,
          },
        }
      );
      activated += 1;
    } else {
      await ShopProfile.updateOne(
        { _id: shop._id },
        {
          $set: { isActive: false, UpdatedAt: now },
          $unset: {
            goiDangki: 1,
            ngayMua: 1,
            ngayHetHan: 1,
            subscriptionPlan: 1,
            subscriptionExpiresAt: 1,
          },
        }
      );
      deactivated += 1;
    }
  }

  console.log(`Activated shops: ${activated}`);
  console.log(`Deactivated shops: ${deactivated}`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
