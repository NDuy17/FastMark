const DealOffer = require("../models/DealOffer");
const ProductVariant = require("../models/ProductVariant");
const User = require("../models/User");
const { DEAL_OFFER_STATUS } = require("../constants/dealOfferStatus");
const { getShopForSeller } = require("./shopSettingsService");
const { createNotification } = require("./notificationService");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

async function getOwnedDeal(user, dealId) {
  const shop = await getShopForSeller(user);
  const deal = await DealOffer.findOne({ _id: dealId, shopId: shop._id });
  if (!deal) {
    throw createServiceError("Không tìm thấy deal giá.", 404);
  }
  return { shop, deal };
}

async function listSellerDeals(user, { status } = {}) {
  const shop = await getShopForSeller(user);
  const query = { shopId: shop._id };
  if (status !== undefined && status !== null && status !== "") {
    query.status = Number(status);
  }

  const deals = await DealOffer.find(query).sort({ CreatedAt: -1 }).limit(100);
  return deals.map((deal) => ({
    id: deal._id,
    status: deal.status,
    originalPrice: deal.originalPrice || 0,
    offeredPrice: deal.offeredPrice || 0,
    sellerCounterPrice: deal.sellerCounterPrice || null,
    discountPercent: deal.discountPercent || 0,
    note: deal.note || "",
    sellerNote: deal.sellerNote || "",
    respondedAt: deal.respondedAt || null,
    createdAt: deal.CreatedAt,
    productId: deal.productId,
    variantId: deal.variantId,
    userId: deal.userId,
    reservationId: deal.reservationId || null,
  }));
}

async function acceptDealOffer(user, dealId) {
  const { deal } = await getOwnedDeal(user, dealId);

  if (deal.status !== DEAL_OFFER_STATUS.PENDING) {
    throw createServiceError("Deal này đã được xử lý.");
  }

  const variant = await ProductVariant.findById(deal.variantId);
  if (!variant) {
    throw createServiceError("Biến thể sản phẩm không tồn tại.");
  }

  const finalPrice = deal.sellerCounterPrice || deal.offeredPrice;
  const now = new Date();

  deal.status = DEAL_OFFER_STATUS.ACCEPTED;
  deal.respondedAt = now;
  deal.reservationId = null;
  deal.UpdatedAt = now;
  await deal.save();

  const buyer = await User.findById(deal.userId);
  if (buyer) {
    await createNotification(buyer._id, {
      title: "Shop chấp nhận deal giá",
      content: `Shop đã chấp nhận mức giá ${Number(finalPrice).toLocaleString("vi-VN")}đ. Hãy chọn giờ lấy hàng trong mục Đơn hàng.`,
    });
  }

  return {
    deal: {
      id: deal._id,
      status: deal.status,
      reservationId: null,
      finalPrice,
    },
  };
}

async function rejectDealOffer(user, dealId, { reason } = {}) {
  const { deal } = await getOwnedDeal(user, dealId);

  if (deal.status !== DEAL_OFFER_STATUS.PENDING) {
    throw createServiceError("Deal này đã được xử lý.");
  }

  const now = new Date();
  deal.status = DEAL_OFFER_STATUS.REJECTED;
  deal.respondedAt = now;
  deal.sellerNote = reason || deal.sellerNote || "";
  deal.UpdatedAt = now;
  await deal.save();

  return {
    id: deal._id,
    status: deal.status,
  };
}

async function counterDealOffer(user, dealId, payload) {
  const { deal } = await getOwnedDeal(user, dealId);

  if (deal.status !== DEAL_OFFER_STATUS.PENDING) {
    throw createServiceError("Deal này đã được xử lý.");
  }

  const counterPrice = pickNumber(payload.counterPrice ?? payload.sellerCounterPrice);
  if (!Number.isFinite(counterPrice) || counterPrice <= 0) {
    throw createServiceError("Giá đề xuất không hợp lệ.");
  }

  const now = new Date();
  deal.sellerCounterPrice = counterPrice;
  deal.sellerNote = String(payload.note || payload.sellerNote || "").trim();
  deal.respondedAt = now;
  deal.UpdatedAt = now;
  await deal.save();

  return {
    id: deal._id,
    status: deal.status,
    sellerCounterPrice: deal.sellerCounterPrice,
    sellerNote: deal.sellerNote,
  };
}

module.exports = {
  listSellerDeals,
  acceptDealOffer,
  rejectDealOffer,
  counterDealOffer,
};
