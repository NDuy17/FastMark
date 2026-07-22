/**
 * One-shot: migrate Conversation shopId+userId → participantA/B + contextShopId.
 * Also remap Message.senderId from shopId → shop.userId when senderType=SHOP.
 *
 * Usage: node backend/scripts/migrateConversationsToUsers.js
 */
require("../config/env");
const mongoose = require("mongoose");
const connectDB = require("../config/database");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const ShopProfile = require("../models/ShopProfile");
const { SENDER_TYPE } = require("../constants");

function orderPair(id1, id2) {
  const a = String(id1);
  const b = String(id2);
  if (a < b) {
    return { participantA: id1, participantB: id2 };
  }
  return { participantA: id2, participantB: id1 };
}

async function run() {
  await connectDB();
  const rows = await Conversation.find({}).lean();
  let migrated = 0;
  let skipped = 0;
  let messagesFixed = 0;

  for (const row of rows) {
    if (row.participantA && row.participantB) {
      skipped += 1;
      continue;
    }

    const buyerId = row.userId;
    let sellerUserId = null;
    const shopId = row.shopId || row.contextShopId;

    if (shopId) {
      const shop = await ShopProfile.findById(shopId).select("userId").lean();
      sellerUserId = shop?.userId || null;
    }

    if (!buyerId || !sellerUserId) {
      console.warn("Skip conversation missing peers:", String(row._id));
      skipped += 1;
      continue;
    }

    const { participantA, participantB } = orderPair(buyerId, sellerUserId);

    // Remap SHOP-sender messages: shopId → seller userId
    if (shopId) {
      const result = await Message.updateMany(
        {
          conversationId: row._id,
          senderType: SENDER_TYPE.SHOP,
          senderId: shopId,
        },
        { $set: { senderId: sellerUserId, UpdatedAt: new Date() } }
      );
      messagesFixed += result.modifiedCount || 0;
    }

    await Conversation.updateOne(
      { _id: row._id },
      {
        $set: {
          participantA,
          participantB,
          contextShopId: shopId || null,
          UpdatedAt: new Date(),
        },
        $unset: { shopId: 1, userId: 1 },
      }
    );
    migrated += 1;
  }

  console.log(`Migrated conversations: ${migrated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Messages remapped: ${messagesFixed}`);
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
