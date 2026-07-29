const shopSettingsService = require("../services/shopSettingsService");
const reservationService = require("../services/reservationService");
const sellerStatsService = require("../services/sellerStatsService");
const { success, fail } = require("../utils/apiResponse");

function pickBodyValue(body, keys) {
  for (const key of keys) {
    if (body[key] !== undefined && body[key] !== null && String(body[key]).trim() !== "") {
      return String(body[key]).trim();
    }
  }
  return "";
}

exports.getShopSettings = async (req, res) => {
  const settings = await shopSettingsService.getShopSettings(req.currentUser);
  return success(res, { data: { shop: settings } });
};

exports.updateShopSettings = async (req, res) => {
  const settings = await shopSettingsService.updateShopSettings(req.currentUser, req.body);
  return success(res, {
    message: "Đã cập nhật cài đặt cửa hàng.",
    data: { shop: settings },
  });
};

exports.checkShopUsernameAvailability = async (req, res) => {
  const shopUsername =
    pickBodyValue(req.body, ["shopUsername", "username"]) ||
    pickBodyValue(req.query, ["shopUsername", "username"]);

  if (!shopUsername) {
    return fail(res, {
      status: 400,
      message: "Thiếu username shop.",
    });
  }

  const result = await shopSettingsService.checkShopUsernameAvailability(
    req.currentUser,
    shopUsername
  );

  return success(res, {
    data: result,
  });
};

function readShopAvatarPayload(req) {
  if (req.file?.buffer?.length) {
    return {
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
    };
  }

  const imageBase64 = pickBodyValue(req.body, ["imageBase64", "base64"]);
  const mimeType = pickBodyValue(req.body, ["mimeType", "contentType"]) || "image/jpeg";

  if (!imageBase64) {
    return null;
  }

  const normalizedBase64 = String(imageBase64).replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
  const buffer = Buffer.from(normalizedBase64, "base64");

  if (!buffer.length) {
    const error = new Error("Dữ liệu ảnh base64 không hợp lệ.");
    error.statusCode = 400;
    throw error;
  }

  const maxBytes = 5 * 1024 * 1024;
  if (buffer.length > maxBytes) {
    const error = new Error("Ảnh không được lớn hơn 5MB.");
    error.statusCode = 400;
    throw error;
  }

  return {
    buffer,
    mimeType,
    originalName: "",
  };
}

exports.uploadShopAvatar = async (req, res) => {
  const avatarPayload = readShopAvatarPayload(req);

  if (!avatarPayload) {
    return fail(res, {
      status: 400,
      message: "Thiếu file ảnh đại diện gian hàng.",
    });
  }

  const shop = await shopSettingsService.uploadShopAvatar(req.currentUser, avatarPayload);

  return success(res, {
    message: "Upload ảnh gian hàng thành công.",
    data: {
      shop,
      shopAvatar: shop.shopAvatar || "",
      avatarUrl: shop.shopAvatar || "",
    },
  });
};

exports.listOrders = async (req, res) => {
  const tab = req.query.tab || "pending";
  const reservations = await reservationService.listSellerReservations(req.currentUser, { tab });
  return success(res, { data: { reservations, tab } });
};

exports.getReservationDetail = async (req, res) => {
  const reservation = await reservationService.getSellerReservationDetail(
    req.currentUser,
    req.params.id
  );
  return success(res, { data: { reservation } });
};

exports.confirmReservation = async (req, res) => {
  const reservation = await reservationService.confirmReservation(req.currentUser, req.params.id);
  return success(res, {
    message: "Đã xác nhận đơn giữ hàng.",
    data: { reservation },
  });
};

exports.rejectReservation = async (req, res) => {
  const reason = pickBodyValue(req.body, ["reason", "note"]);
  const reservation = await reservationService.rejectReservation(req.currentUser, req.params.id, {
    reason,
  });
  return success(res, {
    message: "Đã từ chối đơn giữ hàng.",
    data: { reservation },
  });
};

exports.cancelReservation = async (req, res) => {
  const reason = pickBodyValue(req.body, ["reason", "note"]);
  const images = Array.isArray(req.body?.images) ? req.body.images : [];
  const reservation = await reservationService.cancelReservationBySeller(
    req.currentUser,
    req.params.id,
    { reason, images }
  );
  const afterAccept = Boolean(reservation?.cancelledBySellerAfterAccept);
  return success(res, {
    message: afterAccept
      ? "Đã hủy đơn sau xác nhận. Tiền cọc đã hoàn cho người mua."
      : "Đã hủy đơn giữ hàng.",
    data: { reservation },
  });
};

exports.refundDisputeDeposit = async (req, res) => {
  const reservation = await reservationService.refundDisputeDepositBySeller(
    req.currentUser,
    req.params.id
  );
  return success(res, {
    message: "Đã hoàn cọc cho người mua. Đơn đã kết thúc tranh chấp.",
    data: { reservation },
  });
};

exports.getStats = async (req, res) => {
  const stats = await sellerStatsService.getSellerStats(req.currentUser, req.query);
  return success(res, { data: { stats } });
};
