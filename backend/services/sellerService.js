const SellerVerification = require("../models/SellerVerification");
const ShopProfile = require("../models/ShopProfile");
const User = require("../models/User");
const { SELLER_VERIFICATION_STATUS, USER_ROLE } = require("../constants");
const { assertCategoryExists } = require("./categoryService");
const { normalizeCategoryId } = require("../utils/categoryId");
const { uploadImageToSupabase, resolveFileExtension } = require("./uploadService");
const { ensureDefaultUserAvatar } = require("./defaultUserAvatarService");
const {
  OTP_PURPOSE,
  getOtpSession,
  setOtpSession,
  clearOtpSession,
  bumpOtpFailCount,
} = require("./otpSessionStore");

const PHONE_VERIFY_TTL_MS = 5 * 60 * 1000;
const PHONE_RESEND_COOLDOWN_MS = 2 * 60 * 1000;
const PHONE_VERIFY_MAX_ATTEMPTS = 5;
const SHOP_USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

function normalizeShopUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeShopName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function pickPayloadValue(body, keys) {
  for (const key of keys) {
    const value = body?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return undefined;
}

function pickString(value) {
  return String(value || "").trim();
}

function normalizeSellerRegistrationPayload(body = {}) {
  const shopName = pickPayloadValue(body, ["shopName", "storeName", "tenGianHang", "TenGianHang"]);
  const shopUsername = pickPayloadValue(body, ["shopUsername", "storeUsername"]);
  const shopDescription = pickPayloadValue(body, [
    "shopDescription",
    "description",
    "bio",
    "shopBio",
    "gioiThieuShop",
  ]);
  const categoryId = pickPayloadValue(body, ["categoryId"]);
  const address = pickPayloadValue(body, ["address", "Address"]);
  const systemAddress = pickPayloadValue(body, [
    "systemAddress",
    "addressHeThong",
    "DiaChiHeThong",
    "DiachiHethong",
  ]);

  return {
    ...body,
    shopName: shopName ?? body.shopName,
    shopUsername: shopUsername ?? body.shopUsername,
    shopDescription: shopDescription ?? body.shopDescription,
    categoryId: normalizeCategoryId(categoryId ?? body.categoryId),
    // Client may still send `address` — treat as addressHeThong.
    systemAddress:
      systemAddress ?? body.systemAddress ?? body.addressHeThong ?? body.DiaChiHeThong ?? address ?? body.address,
    latitude: body.latitude ?? body.lat,
    longitude: body.longitude ?? body.lng,
  };
}

function resolveCategoryFields(verification) {
  const category = verification?.categoryId;
  if (category && typeof category === "object" && category.categoryName) {
    return {
      categoryId: normalizeCategoryId(category._id),
      categoryName: category.categoryName || "",
    };
  }

  return {
    categoryId: normalizeCategoryId(verification?.categoryId),
    categoryName: "",
  };
}

function assertShopNameValid(shopName) {
  const normalized = normalizeShopName(shopName);

  if (normalized.length < 2 || normalized.length > 80) {
    throw createServiceError("Tên gian hàng phải từ 2-80 ký tự.");
  }

  return normalized;
}

async function assertShopUsernameAvailable(shopUsername, userId) {
  const normalized = normalizeShopUsername(shopUsername);

  if (!SHOP_USERNAME_PATTERN.test(normalized)) {
    throw createServiceError(
      "Tên shop phải từ 3-30 ký tự, chỉ chữ thường, số và dấu gạch dưới."
    );
  }

  const existingUserName = await User.findOne({
    UserName: {
      $regex: `^${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
      $options: "i",
    },
  }).lean();
  if (existingUserName) {
    throw createServiceError("Username shop đã được sử dụng.");
  }

  const existingShop = await ShopProfile.findOne({ shopUsername: normalized }).lean();
  if (existingShop && String(existingShop.userId) !== String(userId)) {
    throw createServiceError("Username shop đã được sử dụng.");
  }

  const pendingVerification = await SellerVerification.findOne({
    shopUsername: normalized,
    status: SELLER_VERIFICATION_STATUS.PENDING,
    userId: { $ne: userId },
  }).lean();

  if (pendingVerification) {
    throw createServiceError("Username shop đã được sử dụng.");
  }

  return normalized;
}

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function ensureUserHasPhone(user) {
  const phone = String(user.Phone || "").trim();
  if (!phone || phone.length !== 10) {
    throw createServiceError("Bạn cần thêm số điện thoại trước khi xác minh.");
  }
  return phone;
}

function normalizePhone(phone) {
  return String(phone || "").trim();
}

function assertPhoneFormat(phone) {
  const normalized = normalizePhone(phone);
  if (!/^\d{10}$/.test(normalized)) {
    throw createServiceError("Số điện thoại phải gồm đúng 10 chữ số.");
  }
  return normalized;
}

async function assertPhoneAvailable(phone, userId) {
  const normalized = assertPhoneFormat(phone);
  const existing = await User.findOne({
    Phone: normalized,
    _id: { $ne: userId },
  }).lean();
  if (existing) {
    throw createServiceError("Số điện thoại đã được sử dụng bởi tài khoản khác.");
  }
  return normalized;
}

function generatePhoneVerifyCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getPhoneResendWaitSeconds(session) {
  if (!session?.resendAt) {
    return 0;
  }
  return Math.max(
    0,
    Math.ceil((new Date(session.resendAt).getTime() + PHONE_RESEND_COOLDOWN_MS - Date.now()) / 1000)
  );
}

function issuePhoneOtpSession(userId, targetPhone, { applyResendCooldown = true } = {}) {
  const now = Date.now();
  const code = generatePhoneVerifyCode();
  const session = setOtpSession(OTP_PURPOSE.PHONE_VERIFY, userId, {
    target: targetPhone,
    code,
    expiresAt: new Date(now + PHONE_VERIFY_TTL_MS),
    resendAt: applyResendCooldown ? new Date(now) : null,
    failCount: 0,
  });
  return { code, session };
}

function toPhoneOtpResponse(phone, session, code) {
  const resendWait = getPhoneResendWaitSeconds(session);
  return {
    phone,
    verificationCode: code,
    expiresAt: session.expiresAt,
    expiresInSeconds: PHONE_VERIFY_TTL_MS / 1000,
    resendAvailableAt:
      resendWait > 0
        ? new Date(Date.now() + resendWait * 1000)
        : session.resendAt
          ? new Date(new Date(session.resendAt).getTime() + PHONE_RESEND_COOLDOWN_MS)
          : null,
    resendCooldownSeconds: resendWait || PHONE_RESEND_COOLDOWN_MS / 1000,
  };
}

/** Gửi / gửi lại mã SĐT. Gửi lại: chặn 2 phút, hủy mã cũ, phát mã mới. */
async function requestSellerPhoneCode(user, phoneInput) {
  const targetPhone = await assertPhoneAvailable(phoneInput, user._id);
  const currentPhone = normalizePhone(user.Phone);

  if (User.isPhoneVerified(user) && currentPhone && currentPhone === targetPhone) {
    return {
      phone: targetPhone,
      alreadyVerified: true,
      expiresAt: null,
      expiresInSeconds: 0,
      resendAvailableAt: null,
      resendCooldownSeconds: 0,
    };
  }

  const existing = getOtpSession(OTP_PURPOSE.PHONE_VERIFY, user._id);
  const resendWaitSeconds = getPhoneResendWaitSeconds(existing);
  if (resendWaitSeconds > 0) {
    const error = createServiceError(
      `Vui lòng đợi ${resendWaitSeconds} giây trước khi gửi lại mã.`,
      429
    );
    error.data = {
      resendAvailableAt: new Date(Date.now() + resendWaitSeconds * 1000),
      resendCooldownSeconds: resendWaitSeconds,
    };
    throw error;
  }

  // Hủy mã cũ (nếu có) → phát mã mới + khóa gửi lại 2 phút.
  const { code, session } = issuePhoneOtpSession(user._id, targetPhone, {
    applyResendCooldown: true,
  });
  return toPhoneOtpResponse(targetPhone, session, code);
}

/**
 * Nhập đúng → lưu Phone (đã xác thực).
 * Sai < 5 lần → báo còn lại.
 * Sai đủ 5 lần → hệ thống tự gửi mã mới, bắt nhập mã mới.
 */
async function confirmSellerPhoneCode(user, code, phoneInput) {
  const phone = await assertPhoneAvailable(phoneInput, user._id);
  const normalizedCode = String(code || "").trim();

  if (!normalizedCode) {
    throw createServiceError("Thiếu mã xác minh.");
  }

  let session = getOtpSession(OTP_PURPOSE.PHONE_VERIFY, user._id);
  if (!session?.code) {
    throw createServiceError("Chưa có mã xác minh. Vui lòng gửi mã trước.");
  }

  if (!session.expiresAt || new Date() > new Date(session.expiresAt)) {
    clearOtpSession(OTP_PURPOSE.PHONE_VERIFY, user._id);
    throw createServiceError("Mã xác minh đã hết hạn. Vui lòng gửi lại mã mới.");
  }

  if (session.target !== phone) {
    throw createServiceError("Số điện thoại không khớp phiên xác minh. Vui lòng gửi lại mã.");
  }

  if (session.code !== normalizedCode) {
    session = bumpOtpFailCount(OTP_PURPOSE.PHONE_VERIFY, user._id) || session;
    const failCount = Number(session.failCount) || 0;

    if (failCount >= PHONE_VERIFY_MAX_ATTEMPTS) {
      // Sai 5 lần → hủy mã cũ, gửi mã mới + khóa gửi lại 2 phút (như vừa gửi mã).
      const issued = issuePhoneOtpSession(user._id, phone, { applyResendCooldown: true });
      const error = createServiceError(
        "Bạn đã nhập sai 5 lần. Hệ thống đã gửi mã mới — vui lòng nhập mã mới. Có thể gửi lại sau 2 phút.",
        400
      );
      error.data = {
        mustUseNewCode: true,
        ...toPhoneOtpResponse(phone, issued.session, issued.code),
      };
      throw error;
    }

    throw createServiceError(
      `Mã xác minh không đúng. Còn ${PHONE_VERIFY_MAX_ATTEMPTS - failCount} lần thử.`
    );
  }

  // Đúng → chỉ lúc này mới lưu Phone (= đã xác thực).
  user.Phone = phone;
  await user.save();
  clearOtpSession(OTP_PURPOSE.PHONE_VERIFY, user._id);

  return { verified: true, phone };
}

async function uploadSellerImage({ user, imageBase64, mimeType, folder, label }) {
  if (!imageBase64) {
    throw createServiceError(`Thiếu ảnh ${label}.`);
  }

  const normalizedBase64 = String(imageBase64).replace(
    /^data:image\/[a-zA-Z0-9.+-]+;base64,/,
    ""
  );
  const buffer = Buffer.from(normalizedBase64, "base64");

  if (!buffer.length) {
    throw createServiceError(`Ảnh ${label} không hợp lệ.`);
  }

  const extension = resolveFileExtension(mimeType);
  const fileName = `${user.FirebaseUID}-${label}-${Date.now()}.${extension}`;
  const uploadResult = await uploadImageToSupabase({
    buffer,
    mimeType: mimeType || "image/jpeg",
    folder,
    fileName,
  });

  return uploadResult.publicUrl;
}

async function resolveVerificationImage({
  user,
  imageBase64,
  mimeType,
  existingUrl,
  folder,
  label,
}) {
  if (imageBase64) {
    return uploadSellerImage({
      user,
      imageBase64,
      mimeType,
      folder,
      label,
    });
  }

  if (existingUrl) {
    return existingUrl;
  }

  throw createServiceError(`Thiếu ảnh ${label}.`);
}

async function getMySellerVerification(user) {
  return SellerVerification.findOne({ userId: user._id })
    .sort({ CreatedAt: -1 })
    .populate("categoryId", "categoryName");
}

async function reloadVerificationById(verificationId) {
  if (!verificationId) {
    return null;
  }

  return SellerVerification.findById(verificationId).populate("categoryId", "categoryName");
}

async function promoteUserToSeller(user, verification, approvedById = null) {
  verification.status = SELLER_VERIFICATION_STATUS.APPROVED;
  verification.approvedBy = approvedById;
  verification.LyDoTuChoi = "";
  verification.UpdatedAt = new Date();
  await verification.save();

  user.Role = USER_ROLE.SELLER;
  await user.save();

  const categoryId = verification.categoryId?._id || verification.categoryId || null;

  const existingShop = await ShopProfile.findOne({ userId: user._id });
  let shop = existingShop;
  if (!existingShop) {
    shop = await ShopProfile.create({
      userId: user._id,
      categoryId,
      description: verification.shopDescription || verification.description || "",
      addressHeThong:
        verification.addressHeThong ||
        verification.DiaChiHeThong ||
        verification.address ||
        "",
      latitude: verification.latitude,
      longitude: verification.longitude,
    });
    // QR cố định = shopId (gán sau create vì cần _id).
    shop.qrCodeValue = String(shop._id);
    await shop.save();
  } else {
    if (categoryId) {
      existingShop.categoryId = categoryId;
    }
    if (verification.shopDescription || verification.description) {
      existingShop.description = verification.shopDescription || verification.description;
    }
    existingShop.addressHeThong =
      verification.addressHeThong ||
      verification.DiaChiHeThong ||
      verification.address ||
      "";
    existingShop.latitude = verification.latitude;
    existingShop.longitude = verification.longitude;
    if (!existingShop.qrCodeValue) {
      existingShop.qrCodeValue = String(existingShop._id);
    }
    existingShop.UpdatedAt = new Date();
    await existingShop.save();
    shop = existingShop;
  }

  await ensureDefaultUserAvatar(user);

  return verification;
}

async function syncSellerRoleFromVerification(user) {
  const verification = await getMySellerVerification(user);

  if (!verification) {
    return verification;
  }

  if (verification.status === SELLER_VERIFICATION_STATUS.APPROVED) {
    if (user.Role !== USER_ROLE.SELLER) {
      await promoteUserToSeller(user, verification);
    } else {
      await ensureDefaultUserAvatar(user);
    }
    return verification;
  }

  if (user.Role === USER_ROLE.SELLER) {
    user.Role = USER_ROLE.BUYER;
    await user.save();
  }

  return verification;
}

async function submitSellerVerification(user, payload) {
  const normalizedPayload = normalizeSellerRegistrationPayload(payload);

  if (!User.isPhoneVerified(user)) {
    throw createServiceError("Bạn cần xác minh số điện thoại trước khi đăng ký người bán.");
  }

  if (user.Role === USER_ROLE.SELLER) {
    throw createServiceError("Tài khoản đã là người bán.");
  }

  const existing = await getMySellerVerification(user);

  if (existing?.status === SELLER_VERIFICATION_STATUS.APPROVED) {
    throw createServiceError("Tài khoản đã được duyệt người bán.");
  }

  const systemAddress = String(normalizedPayload.systemAddress || "").trim();
  const latitude = Number(normalizedPayload.latitude);
  const longitude = Number(normalizedPayload.longitude);

  if (!systemAddress) {
    throw createServiceError("Vui lòng nhập địa chỉ.");
  }

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw createServiceError("Vui lòng chọn vị trí trên bản đồ.");
  }

  const shopUsername = pickString(user.UserName).toLowerCase();
  const shopName = pickString(user.FullName) || shopUsername;
  if (!shopName || shopName.length < 2) {
    throw createServiceError("Tài khoản thiếu họ tên. Hãy cập nhật hồ sơ trước khi đăng ký bán.");
  }
  if (!shopUsername || shopUsername.length < 3) {
    throw createServiceError("Tài khoản thiếu username. Hãy cập nhật hồ sơ trước khi đăng ký bán.");
  }
  const category = await assertCategoryExists(normalizedPayload.categoryId);
  const shopDescription = String(normalizedPayload.shopDescription || "").trim();

  if (!shopDescription) {
    throw createServiceError("Vui lòng nhập giới thiệu shop.");
  }

  const [cccdFrontImage, cccdBackImage, selfieImage] = await Promise.all([
    resolveVerificationImage({
      user,
      imageBase64: normalizedPayload.cccdFrontImageBase64,
      mimeType: normalizedPayload.cccdFrontMimeType,
      existingUrl:
        existing?.cccdFrontImage || normalizedPayload.cccdFrontImageUrl || null,
      folder: "seller-verification",
      label: "cccd-front",
    }),
    resolveVerificationImage({
      user,
      imageBase64: normalizedPayload.cccdBackImageBase64,
      mimeType: normalizedPayload.cccdBackMimeType,
      existingUrl: existing?.cccdBackImage || normalizedPayload.cccdBackImageUrl || null,
      folder: "seller-verification",
      label: "cccd-back",
    }),
    resolveVerificationImage({
      user,
      imageBase64: normalizedPayload.selfieImageBase64,
      mimeType: normalizedPayload.selfieMimeType,
      existingUrl: existing?.selfieImage || normalizedPayload.selfieImageUrl || null,
      folder: "seller-verification",
      label: "selfie",
    }),
  ]);

  const sharedFields = {
    cccdFrontImage,
    cccdBackImage,
    selfieImage,
    categoryId: category._id,
    addressHeThong: systemAddress,
    latitude,
    longitude,
    status: SELLER_VERIFICATION_STATUS.PENDING,
    LyDoTuChoi: "",
    approvedBy: null,
    UpdatedAt: new Date(),
  };

  if (
    existing &&
    (existing.status === SELLER_VERIFICATION_STATUS.PENDING ||
      existing.status === SELLER_VERIFICATION_STATUS.REJECTED)
  ) {
    existing.set(sharedFields);
    await existing.save();
    return reloadVerificationById(existing._id);
  }

  const verification = await SellerVerification.create({
    userId: user._id,
    ...sharedFields,
  });

  return reloadVerificationById(verification._id);
}

async function listPendingSellerVerifications() {
  const verifications = await SellerVerification.find({
    status: SELLER_VERIFICATION_STATUS.PENDING,
  })
    .sort({ submittedAt: 1 })
    .populate("userId", "FullName Email Phone UserName")
    .populate("categoryId", "categoryName");

  return verifications;
}

async function approveSellerVerificationByAdmin(adminUser, verificationId) {
  const verification = await SellerVerification.findById(verificationId);
  if (!verification) {
    throw createServiceError("Không tìm thấy hồ sơ đăng ký.", 404);
  }

  if (verification.status !== SELLER_VERIFICATION_STATUS.PENDING) {
    throw createServiceError("Chỉ có thể duyệt hồ sơ đang chờ duyệt.");
  }

  const sellerUser = await User.findById(verification.userId);
  if (!sellerUser) {
    throw createServiceError("Không tìm thấy người dùng của hồ sơ.", 404);
  }

  await promoteUserToSeller(sellerUser, verification, adminUser._id);
  return verification;
}

async function rejectSellerVerificationByAdmin(adminUser, verificationId, reason) {
  const verification = await SellerVerification.findById(verificationId);
  if (!verification) {
    throw createServiceError("Không tìm thấy hồ sơ đăng ký.", 404);
  }

  if (verification.status !== SELLER_VERIFICATION_STATUS.PENDING) {
    throw createServiceError("Chỉ có thể từ chối hồ sơ đang chờ duyệt.");
  }

  const lyDoTuChoi = String(reason || "").trim();
  if (!lyDoTuChoi) {
    throw createServiceError("Vui lòng nhập lý do từ chối.");
  }

  verification.status = SELLER_VERIFICATION_STATUS.REJECTED;
  verification.LyDoTuChoi = lyDoTuChoi;
  verification.approvedBy = null;
  verification.UpdatedAt = new Date();
  await verification.save();

  return verification;
}

function toPublicVerification(verification) {
  if (!verification) {
    return null;
  }

  const category = resolveCategoryFields(verification);

  return {
    id: verification._id,
    userId: verification.userId,
    cccdFrontImage: verification.cccdFrontImage || "",
    cccdBackImage: verification.cccdBackImage || "",
    selfieImage: verification.selfieImage || "",
    address:
      verification.addressHeThong ||
      verification.DiaChiHeThong ||
      verification.address ||
      "",
    addressHeThong:
      verification.addressHeThong ||
      verification.DiaChiHeThong ||
      verification.address ||
      "",
    DiaChiHeThong:
      verification.addressHeThong ||
      verification.DiaChiHeThong ||
      verification.address ||
      "",
    latitude: verification.latitude,
    longitude: verification.longitude,
    // Tên/handle lấy từ User khi populate; giữ field trống để tương thích client cũ.
    shopUsername: verification.userId?.UserName || verification.shopUsername || "",
    shopName: verification.userId?.FullName || verification.shopName || "",
    categoryId: category.categoryId,
    categoryName: category.categoryName,
    shopDescription: verification.shopDescription || verification.description || "",
    status: verification.status,
    lyDoTuChoi: verification.LyDoTuChoi || "",
    // Thời điểm trạng thái cuối = UpdatedAt.
    submittedAt: verification.CreatedAt,
    approvedAt:
      verification.status === SELLER_VERIFICATION_STATUS.APPROVED
        ? verification.UpdatedAt
        : null,
    rejectedAt:
      verification.status === SELLER_VERIFICATION_STATUS.REJECTED
        ? verification.UpdatedAt
        : null,
    createdAt: verification.CreatedAt,
    updatedAt: verification.UpdatedAt,
  };
}

function toAdminVerification(verification) {
  const publicData = toPublicVerification(verification);
  if (!publicData) {
    return null;
  }

  const user = verification.userId;
  return {
    ...publicData,
    user: user && typeof user === "object"
      ? {
          id: user._id,
          fullName: user.FullName || "",
          email: user.Email || "",
          phone: user.Phone || "",
          userName: user.UserName || "",
        }
      : null,
  };
}

module.exports = {
  SELLER_VERIFICATION_STATUS,
  requestSellerPhoneCode,
  confirmSellerPhoneCode,
  getMySellerVerification,
  syncSellerRoleFromVerification,
  submitSellerVerification,
  normalizeSellerRegistrationPayload,
  listPendingSellerVerifications,
  approveSellerVerificationByAdmin,
  rejectSellerVerificationByAdmin,
  toPublicVerification,
  toAdminVerification,
};
