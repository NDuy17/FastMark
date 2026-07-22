const bannerService = require("../services/bannerService");
const { success, fail } = require("../utils/apiResponse");

exports.listActive = async (req, res) => {
  const banners = await bannerService.listActiveBanners({ limit: req.query.limit });
  return success(res, { data: { banners } });
};

exports.recordClick = async (req, res) => {
  try {
    const data = await bannerService.recordBannerClick(req.params.id);
    return success(res, { message: "Đã ghi nhận click.", data });
  } catch (error) {
    return fail(res, { status: error.statusCode || 500, message: error.message });
  }
};
