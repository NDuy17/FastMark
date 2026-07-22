const adminReportService = require("../services/adminReportService");
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

exports.listReports = async (req, res) => {
  const data = await adminReportService.listReports({
    search: pickQueryValue(req.query, ["search", "q"]),
    reportType: pickQueryValue(req.query, ["reportType", "type"]),
    status: pickQueryValue(req.query, ["status"]),
    page: req.query.page,
    limit: req.query.limit,
  });

  return success(res, { data });
};

exports.getReportDetail = async (req, res) => {
  const report = await adminReportService.getReportDetail(req.params.id);
  return success(res, { data: { report } });
};

exports.dismissReport = async (req, res) => {
  const replyMessage = pickQueryValue(req.body, ["replyMessage", "message", "adminNote", "note"]);
  const report = await adminReportService.dismissReport(req.currentUser, req.params.id, {
    replyMessage,
  });
  return success(res, {
    message: "Đã bác bỏ báo cáo và gửi thông báo cho người tố cáo.",
    data: { report },
  });
};

exports.approveReport = async (req, res) => {
  const action = pickQueryValue(req.body, ["action"]) || "hide";
  const replyMessage = pickQueryValue(req.body, ["replyMessage", "message", "adminNote", "note"]);
  const report = await adminReportService.approveReport(req.currentUser, req.params.id, {
    action,
    replyMessage,
  });

  return success(res, {
    message: adminReportService.getApproveMessage(report.reportType, action),
    data: { report },
  });
};

/** POST /admin/reports/:id/approve-buyer — hoàn cọc cho buyer, đóng dispute. */
exports.approveBuyer = async (req, res) => {
  const reservationDisputeService = require("../services/reservationDisputeService");
  const note = pickQueryValue(req.body, ["note", "adminNote", "reason"]);
  const data = await reservationDisputeService.adminApproveBuyer(
    req.currentUser,
    req.params.id,
    { note }
  );
  return success(res, {
    message: "Đã hoàn cọc cho buyer và đóng tranh chấp.",
    data,
  });
};

/** POST /admin/reports/:id/approve-seller — giải ngân cọc cho seller, đóng dispute. */
exports.approveSeller = async (req, res) => {
  const reservationDisputeService = require("../services/reservationDisputeService");
  const note = pickQueryValue(req.body, ["note", "adminNote", "reason"]);
  const data = await reservationDisputeService.adminApproveSeller(
    req.currentUser,
    req.params.id,
    { note }
  );
  return success(res, {
    message: "Đã giải phóng cọc cho seller và đóng tranh chấp.",
    data,
  });
};

/** POST /admin/reports/:id/reject — bác bỏ báo cáo tranh chấp, ghi log. */
exports.rejectReservationReport = async (req, res) => {
  const reservationDisputeService = require("../services/reservationDisputeService");
  const note = pickQueryValue(req.body, ["note", "adminNote", "reason"]);
  const data = await reservationDisputeService.adminRejectReport(
    req.currentUser,
    req.params.id,
    { note }
  );
  return success(res, {
    message: "Đã bác bỏ báo cáo. Cọc vẫn giữ ở ví hệ thống đến khi admin quyết định.",
    data,
  });
};
