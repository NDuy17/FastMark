const adminInsightService = require("../services/adminInsightService");
const { success } = require("../utils/apiResponse");

exports.getAccountHistory = async (req, res) => {
  const data = await adminInsightService.getAccountHistory(req.params.id, req.query);
  return success(res, { data });
};

exports.getAccountFinance = async (req, res) => {
  const finance = await adminInsightService.getAccountFinanceSummary(req.params.id);
  return success(res, { data: { finance } });
};

exports.getFinanceOverview = async (req, res) => {
  const data = await adminInsightService.getFinanceOverview(req.query);
  return success(res, { data });
};

exports.listAuditLogs = async (req, res) => {
  const data = await adminInsightService.listAuditLogs(req.query);
  return success(res, { data });
};
