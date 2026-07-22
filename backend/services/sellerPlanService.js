const SellerPlan = require("../models/SellerPlan");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function resolveDurationDays(payload = {}) {
  if (payload.durationDays !== undefined && payload.durationDays !== null && payload.durationDays !== "") {
    return Number(payload.durationDays);
  }
  if (payload.durationMonths !== undefined && payload.durationMonths !== null && payload.durationMonths !== "") {
    return Number(payload.durationMonths) * 30;
  }
  if (payload.planMonths !== undefined && payload.planMonths !== null && payload.planMonths !== "") {
    return Number(payload.planMonths) * 30;
  }
  return NaN;
}

function toPlanDto(doc) {
  const durationDays = Math.max(1, Number(doc.durationDays) || 30);
  const planMonths = Math.max(1, Math.round(durationDays / 30));
  return {
    id: String(doc._id),
    name: doc.name || "",
    description: doc.description || "",
    durationDays,
    durationMonths: planMonths,
    price: Math.max(0, Number(doc.price) || 0),
    isActive: Boolean(doc.isActive),
    createdAt: doc.CreatedAt || null,
    updatedAt: doc.UpdatedAt || null,
    // Compat aliases
    label: doc.name || "",
    planMonths,
  };
}

async function listAdminPlans() {
  const rows = await SellerPlan.find({}).sort({ price: 1, CreatedAt: 1 }).limit(100);
  return rows.map(toPlanDto);
}

async function listActivePlans() {
  const rows = await SellerPlan.find({ isActive: true })
    .sort({ price: 1, CreatedAt: 1 })
    .limit(50);
  return rows.map(toPlanDto);
}

async function getActivePlanById(planId) {
  const plan = await SellerPlan.findOne({ _id: planId, isActive: true });
  return plan || null;
}

async function createPlan(payload = {}) {
  const name = String(payload.name || payload.label || "").trim();
  const description = String(payload.description || "").trim();
  const durationDays = resolveDurationDays(payload);
  const price = Number(payload.price);
  const isActive =
    payload.isActive === undefined
      ? payload.status === undefined || Number(payload.status) === 1
      : Boolean(payload.isActive);

  if (!name) {
    throw createServiceError("Thiếu tên gói.");
  }
  if (!Number.isFinite(durationDays) || durationDays < 1) {
    throw createServiceError("Thời hạn phải >= 1 ngày.");
  }
  if (!Number.isFinite(price) || price < 0) {
    throw createServiceError("Giá gói không hợp lệ.");
  }

  const plan = await SellerPlan.create({
    name,
    description,
    durationDays: Math.round(durationDays),
    price,
    isActive,
  });
  return toPlanDto(plan);
}

async function updatePlan(planId, payload = {}) {
  const plan = await SellerPlan.findById(planId);
  if (!plan) {
    throw createServiceError("Không tìm thấy gói.", 404);
  }

  if (payload.name !== undefined || payload.label !== undefined) {
    const name = String(payload.name || payload.label || "").trim();
    if (!name) {
      throw createServiceError("Thiếu tên gói.");
    }
    plan.name = name;
  }
  if (payload.description !== undefined) {
    plan.description = String(payload.description || "").trim();
  }

  const hasDurationField =
    payload.durationDays !== undefined ||
    payload.durationMonths !== undefined ||
    payload.planMonths !== undefined;
  if (hasDurationField) {
    const durationDays = resolveDurationDays(payload);
    if (!Number.isFinite(durationDays) || durationDays < 1) {
      throw createServiceError("Thời hạn phải >= 1 ngày.");
    }
    plan.durationDays = Math.round(durationDays);
  }

  if (payload.price !== undefined) {
    const price = Number(payload.price);
    if (!Number.isFinite(price) || price < 0) {
      throw createServiceError("Giá gói không hợp lệ.");
    }
    plan.price = price;
  }

  if (payload.isActive !== undefined) {
    plan.isActive = Boolean(payload.isActive);
  } else if (payload.status !== undefined) {
    plan.isActive = Number(payload.status) === 1;
  }

  await plan.save();
  return toPlanDto(plan);
}

async function deletePlan(planId) {
  const plan = await SellerPlan.findById(planId);
  if (!plan) {
    throw createServiceError("Không tìm thấy gói.", 404);
  }
  plan.isActive = false;
  await plan.save();
  return toPlanDto(plan);
}

module.exports = {
  listAdminPlans,
  listActivePlans,
  getActivePlanById,
  createPlan,
  updatePlan,
  deletePlan,
  toPlanDto,
};
