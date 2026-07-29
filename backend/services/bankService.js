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
  const rows = await Bank.find({ isActive: true }).sort({ CreatedAt: 1 }).limit(200);
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

  const existing = await Bank.findOne({ code });
  if (existing) {
    if (existing.isActive === false) {
      existing.name = name;
      existing.isActive = true;
      existing.UpdatedAt = new Date();
      await existing.save();
      return { bank: toPublicBank(existing), restored: true };
    }
    throw createServiceError("Mã ngân hàng đã tồn tại.");
  }

  try {
    const bank = await Bank.create({
      name,
      code,
      isActive: payload.isActive !== false && payload.isActive !== 0,
    });
    return { bank: toPublicBank(bank), restored: false };
  } catch (error) {
    if (error?.code === 11000) {
      const duplicate = await Bank.findOne({ code });
      if (duplicate?.isActive === false) {
        duplicate.name = name;
        duplicate.isActive = true;
        duplicate.UpdatedAt = new Date();
        await duplicate.save();
        return { bank: toPublicBank(duplicate), restored: true };
      }
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
  // Xóa mềm — user không chọn được khi rút tiền mới.
  bank.isActive = false;
  bank.UpdatedAt = new Date();
  await bank.save();
  return toPublicBank(bank);
}

async function restoreBank(bankId) {
  const bank = await Bank.findById(bankId);
  if (!bank) {
    throw createServiceError("Không tìm thấy ngân hàng.", 404);
  }
  if (bank.isActive !== false) {
    return toPublicBank(bank);
  }
  bank.isActive = true;
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
  restoreBank,
};
