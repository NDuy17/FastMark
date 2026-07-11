const adminAccountService = require("../services/adminAccountService");
const { success } = require("../utils/apiResponse");

function pickQueryValue(query, keys) {
  for (const key of keys) {
    const value = query[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

exports.listAccounts = async (req, res) => {
  const data = await adminAccountService.listAccounts({
    search: pickQueryValue(req.query, ["search", "q"]),
    role: pickQueryValue(req.query, ["role"]),
    status: pickQueryValue(req.query, ["status"]),
    verificationStatus: pickQueryValue(req.query, [
      "verificationStatus",
      "verification_status",
    ]),
    sort: pickQueryValue(req.query, ["sort"]) || "newest",
    page: req.query.page,
    limit: req.query.limit,
  });

  return success(res, { data });
};

exports.getAccountDetail = async (req, res) => {
  const account = await adminAccountService.getAccountDetail(req.params.id);
  return success(res, { data: { account } });
};

exports.blockAccount = async (req, res) => {
  const account = await adminAccountService.blockAccount(req.currentUser, req.params.id);
  return success(res, {
    message: "Tài khoản đã được khóa.",
    data: { account },
  });
};

exports.unblockAccount = async (req, res) => {
  const account = await adminAccountService.unblockAccount(req.currentUser, req.params.id);
  return success(res, {
    message: "Tài khoản đã được mở khóa.",
    data: { account },
  });
};
