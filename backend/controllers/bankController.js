const bankService = require("../services/bankService");
const { success, fail } = require("../utils/apiResponse");

exports.listBanks = async (req, res) => {
  const banks = await bankService.listBanksAdmin();
  return success(res, { data: { banks } });
};

exports.createBank = async (req, res) => {
  try {
    const { bank, restored } = await bankService.createBank(req.body);
    return success(res, {
      message: restored ? "Đã khôi phục ngân hàng." : "Đã thêm ngân hàng.",
      data: { bank, restored: Boolean(restored) },
    });
  } catch (error) {
    return fail(res, {
      status: error.statusCode || 500,
      message: error.message || "Không tạo được ngân hàng.",
    });
  }
};

exports.updateBank = async (req, res) => {
  try {
    const bank = await bankService.updateBank(req.params.id, req.body);
    return success(res, { message: "Đã cập nhật ngân hàng.", data: { bank } });
  } catch (error) {
    return fail(res, {
      status: error.statusCode || 500,
      message: error.message || "Không cập nhật được ngân hàng.",
    });
  }
};

exports.deleteBank = async (req, res) => {
  try {
    const bank = await bankService.deleteBank(req.params.id);
    return success(res, { message: "Đã tắt ngân hàng.", data: { bank } });
  } catch (error) {
    return fail(res, {
      status: error.statusCode || 500,
      message: error.message || "Không tắt được ngân hàng.",
    });
  }
};

exports.restoreBank = async (req, res) => {
  try {
    const bank = await bankService.restoreBank(req.params.id);
    return success(res, { message: "Đã khôi phục ngân hàng.", data: { bank } });
  } catch (error) {
    return fail(res, {
      status: error.statusCode || 500,
      message: error.message || "Không khôi phục được ngân hàng.",
    });
  }
};
