const User = require("../models/User");
const Notification = require("../models/Notification");
const { USER_ROLE } = require("../constants");
const { createNotification } = require("./notificationService");
const { NOTIFICATION_AUDIENCE } = require("../constants");

const AUDIENCE = {
  ALL: "all",
  BUYER: "buyer",
  SELLER: "seller",
};

function mapSystemAudienceToNotificationAudience(audience) {
  switch (audience) {
    case AUDIENCE.BUYER:
      return NOTIFICATION_AUDIENCE.BUYER;
    case AUDIENCE.SELLER:
      return NOTIFICATION_AUDIENCE.SELLER;
    case AUDIENCE.ALL:
    default:
      return NOTIFICATION_AUDIENCE.SYSTEM;
  }
}

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickString(value) {
  return String(value || "").trim();
}

function buildAudienceFilter(audience) {
  switch (audience) {
    case AUDIENCE.BUYER:
      return { Role: USER_ROLE.BUYER, Status: 1 };
    case AUDIENCE.SELLER:
      return { Role: USER_ROLE.SELLER, Status: 1 };
    case AUDIENCE.ALL:
    default:
      return { Role: { $in: [USER_ROLE.BUYER, USER_ROLE.SELLER] }, Status: 1 };
  }
}

function getAudienceLabel(audience) {
  switch (audience) {
    case AUDIENCE.BUYER:
      return "Người mua";
    case AUDIENCE.SELLER:
      return "Người bán";
    case AUDIENCE.ALL:
    default:
      return "Tất cả";
  }
}

async function sendSystemNotification(adminUser, { title, content, audience = AUDIENCE.ALL } = {}) {
  const normalizedTitle = pickString(title);
  const normalizedContent = pickString(content);
  const normalizedAudience = pickString(audience) || AUDIENCE.ALL;

  if (!normalizedTitle) {
    throw createServiceError("Tiêu đề thông báo không được để trống.");
  }

  if (!normalizedContent) {
    throw createServiceError("Nội dung thông báo không được để trống.");
  }

  if (!Object.values(AUDIENCE).includes(normalizedAudience)) {
    throw createServiceError("Đối tượng nhận thông báo không hợp lệ.");
  }

  const recipients = await User.find(buildAudienceFilter(normalizedAudience))
    .select("_id")
    .lean();

  if (!recipients.length) {
    throw createServiceError("Không tìm thấy người dùng phù hợp để gửi thông báo.", 404);
  }

  let inAppCount = 0;
  await Promise.all(
    recipients.map(async (user) => {
      const created = await createNotification(user._id, {
        title: normalizedTitle,
        content: normalizedContent,
        audience: mapSystemAudienceToNotificationAudience(normalizedAudience),
      });
      if (created) {
        inAppCount += 1;
      }
    })
  );

  return {
    audience: normalizedAudience,
    audienceLabel: getAudienceLabel(normalizedAudience),
    title: normalizedTitle,
    content: normalizedContent,
    recipientCount: recipients.length,
    inAppCount,
    sentBy: {
      id: String(adminUser._id),
      fullName: adminUser.FullName || "",
      email: adminUser.Email || "",
    },
    sentAt: new Date(),
  };
}

/**
 * Lịch sử gửi broadcast: gộp Notification theo (title, content, audience, phút gửi).
 */
async function listBroadcastHistory({ page = 1, limit = 20 } = {}) {
  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(limit) || 20));

  const rows = await Notification.aggregate([
    {
      $group: {
        _id: {
          title: "$title",
          content: "$content",
          audience: "$audience",
          minute: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$CreatedAt" } },
        },
        recipientCount: { $sum: 1 },
        readCount: { $sum: { $cond: [{ $eq: ["$isRead", 1] }, 1, 0] } },
        sentAt: { $max: "$CreatedAt" },
      },
    },
    { $sort: { sentAt: -1 } },
    {
      $facet: {
        items: [
          { $skip: (currentPage - 1) * pageSize },
          { $limit: pageSize },
        ],
        total: [{ $count: "count" }],
      },
    },
  ]);

  const items = (rows[0]?.items || []).map((row) => ({
    title: row._id.title || "",
    content: row._id.content || "",
    audience: row._id.audience || "",
    recipientCount: row.recipientCount,
    readCount: row.readCount,
    sentAt: row.sentAt || null,
  }));
  const total = rows[0]?.total?.[0]?.count || 0;

  return {
    items,
    pagination: {
      page: currentPage,
      limit: pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

module.exports = {
  AUDIENCE,
  sendSystemNotification,
  listBroadcastHistory,
};
