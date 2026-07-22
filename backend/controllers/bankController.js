const bankService = require("../services/bankService");
const { success, fail } = require("../utils/apiResponse");

exports.listBanks = async (req, res) => {
  const banks = await bankService.listBanksAdmin();
  return success(res, { data: { banks } });
};

exports.createBank = async (req, res) => {
  try {
    const bank = await bankService.createBank(req.body);
    return success(res, { message: "Đã thêm ngân hàng.", data: { bank } });
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
