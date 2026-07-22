const sellerBannerService = require("../services/sellerBannerService");

module.exports = {
  listActiveBanners: sellerBannerService.listActiveBanners,
  recordBannerClick: sellerBannerService.recordBannerClick,
};
