const sellerPlanService = require("../services/sellerPlanService");
const sellerSubscriptionService = require("../services/sellerSubscriptionService");
const { success, fail } = require("../utils/apiResponse");

exports.listAdminPlans = async (req, res) => {
  const plans = await sellerPlanService.listAdminPlans();
  return success(res, { data: { plans } });
};

exports.createPlan = async (req, res) => {
  try {
    const plan = await sellerPlanService.createPlan(req.body);
    return success(res, { message: "Đã tạo gói bán hàng.", data: { plan } });
  } catch (error) {
    return fail(res, { status: error.statusCode || 500, message: error.message });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    const plan = await sellerPlanService.updatePlan(req.params.id, req.body);
    return success(res, { message: "Đã cập nhật gói bán hàng.", data: { plan } });
  } catch (error) {
    return fail(res, { status: error.statusCode || 500, message: error.message });
  }
};

exports.removePlan = async (req, res) => {
  try {
    const plan = await sellerPlanService.deletePlan(req.params.id);
    return success(res, { message: "Đã ngừng bán gói.", data: { plan } });
  } catch (error) {
    return fail(res, { status: error.statusCode || 500, message: error.message });
  }
};

exports.listSubscriptions = async (req, res) => {
  const data = await sellerSubscriptionService.listAdminSubscriptions({
    page: req.query.page,
    limit: req.query.limit,
    status: req.query.status,
    search: req.query.search || req.query.q,
  });
  return success(res, { data });
};

// Legacy aliases used by old SubscriptionPlansPage
exports.listAdmin = exports.listAdminPlans;
exports.create = exports.createPlan;
exports.update = exports.updatePlan;
exports.remove = exports.removePlan;
