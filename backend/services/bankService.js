const Bank = require("../models/Bank");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toPublicBank(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    name: doc.name || "",
    code: doc.code || "",
    isActive: doc.isActive !== false,
    createdAt: doc.CreatedAt || null,
    updatedAt: doc.UpdatedAt || null,
  };
}

async function listBanksAdmin() {
  const rows = await Bank.find({}).sort({ CreatedAt: 1 }).limit(200);
  return rows.map(toPublicBank);
}

async function listActiveBanksForUser() {
  const rows = await Bank.find({ isActive: true }).sort({ CreatedAt: 1 }).limit(100);
  return rows.map(toPublicBank);
}

async function createBank(payload = {}) {
  const name = String(payload.name || "").trim();
  const code = String(payload.code || "").trim().toUpperCase();
  if (!name) {
    throw createServiceError("Vui lòng nhập tên ngân hàng.");
  }
  if (!code || code.length < 2) {
    throw createServiceError("Mã ngân hàng phải từ 2 ký tự.");
  }

  try {
    const bank = await Bank.create({
      name,
      code,
      isActive: payload.isActive !== false && payload.isActive !== 0,
    });
    return toPublicBank(bank);
  } catch (error) {
    if (error?.code === 11000) {
      throw createServiceError("Mã ngân hàng đã tồn tại.");
    }
    throw error;
  }
}

async function updateBank(bankId, payload = {}) {
  const bank = await Bank.findById(bankId);
  if (!bank) {
    throw createServiceError("Không tìm thấy ngân hàng.", 404);
  }

  if (payload.name !== undefined) {
    const name = String(payload.name || "").trim();
    if (!name) throw createServiceError("Vui lòng nhập tên ngân hàng.");
    bank.name = name;
  }
  if (payload.code !== undefined) {
    const code = String(payload.code || "").trim().toUpperCase();
    if (!code || code.length < 2) {
      throw createServiceError("Mã ngân hàng phải từ 2 ký tự.");
    }
    bank.code = code;
  }
  if (payload.isActive !== undefined) {
    bank.isActive = Boolean(payload.isActive);
  }

  bank.UpdatedAt = new Date();
  try {
    await bank.save();
  } catch (error) {
    if (error?.code === 11000) {
      throw createServiceError("Mã ngân hàng đã tồn tại.");
    }
    throw error;
  }
  return toPublicBank(bank);
}

async function deleteBank(bankId) {
  const bank = await Bank.findById(bankId);
  if (!bank) {
    throw createServiceError("Không tìm thấy ngân hàng.", 404);
  }
  // Soft-disable thay vì xóa cứng để giữ lịch sử rút tiền.
  bank.isActive = false;
  bank.UpdatedAt = new Date();
  await bank.save();
  return toPublicBank(bank);
}

module.exports = {
  toPublicBank,
  listBanksAdmin,
  listActiveBanksForUser,
  createBank,
  updateBank,
  deleteBank,
};
