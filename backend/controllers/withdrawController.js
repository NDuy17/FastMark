const withdrawService = require("../services/withdrawService");
const bankService = require("../services/bankService");
const { success, fail } = require("../utils/apiResponse");

exports.listActiveBanks = async (req, res) => {
  const banks = await bankService.listActiveBanksForUser();
  return success(res, { data: { banks } });
};

exports.createWithdraw = async (req, res) => {
  try {
    const result = await withdrawService.createWithdrawRequest(req.currentUser, req.body);
    return success(res, {
      message: "Đã gửi yêu cầu rút tiền. Chờ admin duyệt.",
      data: result,
    });
  } catch (error) {
    return fail(res, {
      status: error.statusCode || 500,
      message: error.message || "Không tạo được yêu cầu rút tiền.",
    });
  }
};

exports.listMyWithdraws = async (req, res) => {
  const withdraws = await withdrawService.listMyWithdraws(req.currentUser._id, {
    limit: req.query.limit,
  });
  return success(res, { data: { withdraws } });
};

exports.listAdminWithdraws = async (req, res) => {
  const result = await withdrawService.listAdminWithdraws({
    status: req.query.status,
    limit: req.query.limit,
    page: req.query.page,
    q: req.query.q,
    from: req.query.from,
    to: req.query.to,
  });
  return success(res, { data: result });
};

exports.approveWithdraw = async (req, res) => {
  try {
    const withdraw = await withdrawService.approveWithdraw(req.currentUser, req.params.id, {
      adminNote: req.body?.adminNote,
    });
    return success(res, { message: "Đã duyệt rút tiền.", data: { withdraw } });
  } catch (error) {
    return fail(res, {
      status: error.statusCode || 500,
      message: error.message || "Không duyệt được yêu cầu.",
    });
  }
};

exports.rejectWithdraw = async (req, res) => {
  try {
    const result = await withdrawService.rejectWithdraw(req.currentUser, req.params.id, {
      adminNote: req.body?.adminNote,
    });
    return success(res, { message: "Đã từ chối và hoàn tiền về ví.", data: result });
  } catch (error) {
    return fail(res, {
      status: error.statusCode || 500,
      message: error.message || "Không từ chối được yêu cầu.",
    });
  }
};
