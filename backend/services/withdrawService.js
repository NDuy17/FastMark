const mongoose = require("mongoose");
const Bank = require("../models/Bank");
const WithdrawRequest = require("../models/WithdrawRequest");
const WalletTransaction = require("../models/WalletTransaction");
const User = require("../models/User");
const {
  WALLET_TX_TYPE,
  WALLET_TX_STATUS,
  WITHDRAW_STATUS,
  WITHDRAW_STATUS_LABEL,
  WALLET_REFERENCE_TYPE,
  MIN_WITHDRAW_AMOUNT,
  MAX_WITHDRAW_AMOUNT,
  NOTIFICATION_AUDIENCE,
} = require("../constants");
const { createNotification } = require("./notificationService");
const {
  getOrCreateWallet,
  createUniqueOrderCode,
  getWalletBalance,
  toPublicTransaction,
} = require("./walletService");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toPublicWithdraw(doc, extras = {}) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    userId: doc.userId ? String(doc.userId) : "",
    bankId: doc.bankId ? String(doc.bankId) : "",
    bankName: doc.bankName || "",
    bankCode: doc.bankCode || "",
    accountNumber: doc.accountNumber || "",
    accountName: doc.accountName || "",
    amount: Number(doc.amount) || 0,
    status: Number(doc.status),
    statusLabel: WITHDRAW_STATUS_LABEL[doc.status] || "",
    adminNote: doc.adminNote || "",
    walletTransactionId: doc.walletTransactionId
      ? String(doc.walletTransactionId)
      : "",
    processedAt: doc.processedAt || null,
    createdAt: doc.CreatedAt || null,
    updatedAt: doc.UpdatedAt || null,
    ...extras,
  };
}

async function createWithdrawRequest(user, payload = {}) {
  const amount = Math.round(Number(payload.amount));
  const bankId = String(payload.bankId || "").trim();
  const accountNumber = String(payload.accountNumber || "").replace(/\s/g, "");
  const accountName = String(payload.accountName || "").trim().toUpperCase();

  if (!Number.isFinite(amount) || amount < MIN_WITHDRAW_AMOUNT) {
    throw createServiceError(
      `Số tiền rút tối thiểu là ${MIN_WITHDRAW_AMOUNT.toLocaleString("vi-VN")}đ.`
    );
  }
  if (amount > MAX_WITHDRAW_AMOUNT) {
    throw createServiceError(
      `Số tiền rút tối đa là ${MAX_WITHDRAW_AMOUNT.toLocaleString("vi-VN")}đ.`
    );
  }
  if (!bankId) {
    throw createServiceError("Vui lòng chọn ngân hàng.");
  }
  if (!/^\d{6,20}$/.test(accountNumber)) {
    throw createServiceError("Số tài khoản phải gồm 6–20 chữ số.");
  }
  if (!accountName || accountName.length < 2) {
    throw createServiceError("Vui lòng nhập tên chủ tài khoản.");
  }

  const bank = await Bank.findById(bankId);
  if (!bank || bank.isActive === false) {
    throw createServiceError("Ngân hàng không khả dụng. Vui lòng chọn ngân hàng khác.", 400);
  }

  const session = await mongoose.startSession();
  try {
    let withdraw;
    let walletDto;
    await session.withTransaction(async () => {
      const wallet = await getOrCreateWallet(user._id, session);
      const balance = Math.max(0, Number(wallet.balance) || 0);
      if (balance < amount) {
        throw createServiceError(
          `Số dư ví không đủ. Cần ${amount.toLocaleString("vi-VN")}đ, hiện có ${balance.toLocaleString("vi-VN")}đ.`,
          400
        );
      }

      wallet.balance = balance - amount;
      await wallet.save({ session });

      const orderCode = await createUniqueOrderCode();
      const txCreated = await WalletTransaction.create(
        [
          {
            userId: user._id,
            type: WALLET_TX_TYPE.WITHDRAWAL,
            amount,
            status: WALLET_TX_STATUS.PENDING,
            orderCode,
            description: `Rút về ${bank.name} · ${accountNumber} · ${accountName}`,
            balanceAfter: wallet.balance,
          },
        ],
        { session }
      );

      const created = await WithdrawRequest.create(
        [
          {
            userId: user._id,
            bankId: bank._id,
            bankName: bank.name,
            bankCode: bank.code || "",
            accountNumber,
            accountName,
            amount,
            status: WITHDRAW_STATUS.PENDING,
            walletTransactionId: txCreated[0]._id,
          },
        ],
        { session }
      );

      withdraw = created[0];
      txCreated[0].referenceId = withdraw._id;
      txCreated[0].referenceType = WALLET_REFERENCE_TYPE.WITHDRAW;
      await txCreated[0].save({ session });
      walletDto = { balance: wallet.balance };
    });

    return {
      withdraw: toPublicWithdraw(withdraw),
      wallet: walletDto,
    };
  } finally {
    session.endSession();
  }
}

async function listMyWithdraws(userId, { limit = 30 } = {}) {
  const rows = await WithdrawRequest.find({ userId })
    .sort({ CreatedAt: -1 })
    .limit(Math.min(100, Number(limit) || 30));
  return rows.map((row) => toPublicWithdraw(row));
}

async function listAdminWithdraws({
  status,
  limit = 50,
  page = 1,
  q = "",
  from = "",
  to = "",
} = {}) {
  const filter = {};
  if (status !== undefined && status !== "" && status !== null) {
    const statusNum = Number(status);
    if (Number.isFinite(statusNum)) {
      filter.status = statusNum;
    }
  }

  const fromDate = from ? new Date(`${String(from).slice(0, 10)}T00:00:00`) : null;
  const toDate = to ? new Date(`${String(to).slice(0, 10)}T23:59:59.999`) : null;
  if (
    (fromDate && !Number.isNaN(fromDate.getTime())) ||
    (toDate && !Number.isNaN(toDate.getTime()))
  ) {
    filter.CreatedAt = {};
    if (fromDate && !Number.isNaN(fromDate.getTime())) {
      filter.CreatedAt.$gte = fromDate;
    }
    if (toDate && !Number.isNaN(toDate.getTime())) {
      filter.CreatedAt.$lte = toDate;
    }
  }

  const queryText = String(q || "").trim();
  if (queryText) {
    const escaped = queryText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");
    const matchedUsers = await User.find({
      $or: [
        { FullName: regex },
        { UserName: regex },
        { Phone: regex },
        { Email: regex },
      ],
    })
      .select("_id")
      .limit(100)
      .lean();
    const matchedUserIds = matchedUsers.map((user) => user._id);
    filter.$or = [
      { accountNumber: regex },
      { accountName: regex },
      { bankName: regex },
      { bankCode: regex },
      ...(matchedUserIds.length ? [{ userId: { $in: matchedUserIds } }] : []),
    ];
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 50));
  const skip = (pageNum - 1) * limitNum;

  const [rows, total] = await Promise.all([
    WithdrawRequest.find(filter)
      .sort({ CreatedAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    WithdrawRequest.countDocuments(filter),
  ]);

  const userIds = [...new Set(rows.map((row) => String(row.userId)).filter(Boolean))];
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } })
        .select("FullName UserName Phone Email")
        .lean()
    : [];
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  return {
    items: rows.map((row) => {
      const user = userMap.get(String(row.userId));
      return toPublicWithdraw(row, {
        userName: user?.FullName || user?.UserName || "",
        userPhone: user?.Phone || "",
        userEmail: user?.Email || "",
      });
    }),
    total,
    page: pageNum,
    limit: limitNum,
  };
}

async function approveWithdraw(adminUser, withdrawId, { adminNote } = {}) {
  const session = await mongoose.startSession();
  try {
    let withdraw;
    await session.withTransaction(async () => {
      withdraw = await WithdrawRequest.findById(withdrawId).session(session);
      if (!withdraw) {
        throw createServiceError("Không tìm thấy yêu cầu rút tiền.", 404);
      }
      if (withdraw.status !== WITHDRAW_STATUS.PENDING) {
        throw createServiceError("Yêu cầu đã được xử lý.");
      }

      if (withdraw.walletTransactionId) {
        const tx = await WalletTransaction.findById(withdraw.walletTransactionId).session(
          session
        );
        if (tx && tx.status === WALLET_TX_STATUS.PENDING) {
          tx.status = WALLET_TX_STATUS.SUCCESS;
          tx.UpdatedAt = new Date();
          await tx.save({ session });
        }
      }

      withdraw.status = WITHDRAW_STATUS.APPROVED;
      withdraw.adminNote = String(adminNote || "").trim();
      withdraw.processedBy = adminUser._id;
      withdraw.processedAt = new Date();
      withdraw.UpdatedAt = new Date();
      await withdraw.save({ session });
    });

    await createNotification(withdraw.userId, {
      title: "Rút tiền đã được duyệt",
      content: `Yêu cầu rút ${Number(withdraw.amount).toLocaleString("vi-VN")}đ đã được admin chuyển khoản.`,
      audience: NOTIFICATION_AUDIENCE.SELLER,
    }).catch((error) => {
      console.warn("[withdraw] approve notification failed:", error?.message || error);
    });

    return toPublicWithdraw(withdraw);
  } finally {
    session.endSession();
  }
}

async function rejectWithdraw(adminUser, withdrawId, { adminNote } = {}) {
  const session = await mongoose.startSession();
  try {
    let withdraw;
    let walletDto;
    await session.withTransaction(async () => {
      withdraw = await WithdrawRequest.findById(withdrawId).session(session);
      if (!withdraw) {
        throw createServiceError("Không tìm thấy yêu cầu rút tiền.", 404);
      }
      if (withdraw.status !== WITHDRAW_STATUS.PENDING) {
        throw createServiceError("Yêu cầu đã được xử lý.");
      }

      const amount = Number(withdraw.amount) || 0;
      const wallet = await getOrCreateWallet(withdraw.userId, session);
      wallet.balance = Math.max(0, Number(wallet.balance) || 0) + amount;
      await wallet.save({ session });

      const orderCode = await createUniqueOrderCode();
      const refundTx = await WalletTransaction.create(
        [
          {
            userId: withdraw.userId,
            type: WALLET_TX_TYPE.REFUND,
            amount,
            status: WALLET_TX_STATUS.SUCCESS,
            orderCode,
            description: `Hoàn rút tiền bị từ chối · ${withdraw.bankName}`,
            balanceAfter: wallet.balance,
          },
        ],
        { session }
      );

      if (withdraw.walletTransactionId) {
        const tx = await WalletTransaction.findById(withdraw.walletTransactionId).session(
          session
        );
        if (tx && tx.status === WALLET_TX_STATUS.PENDING) {
          tx.status = WALLET_TX_STATUS.CANCELLED;
          tx.UpdatedAt = new Date();
          await tx.save({ session });
        }
      }

      withdraw.status = WITHDRAW_STATUS.REJECTED;
      withdraw.adminNote = String(adminNote || "").trim() || "Admin từ chối yêu cầu rút tiền.";
      withdraw.refundTransactionId = refundTx[0]._id;
      withdraw.processedBy = adminUser._id;
      withdraw.processedAt = new Date();
      withdraw.UpdatedAt = new Date();
      await withdraw.save({ session });

      walletDto = { balance: wallet.balance };
    });

    const rejectNote = String(adminNote || "").trim();
    await createNotification(withdraw.userId, {
      title: "Rút tiền bị từ chối",
      content:
        rejectNote ||
        `Yêu cầu rút ${Number(withdraw.amount).toLocaleString("vi-VN")}đ đã bị từ chối. Tiền đã hoàn về ví.`,
      audience: NOTIFICATION_AUDIENCE.SELLER,
    }).catch((error) => {
      console.warn("[withdraw] reject notification failed:", error?.message || error);
    });

    return { withdraw: toPublicWithdraw(withdraw), wallet: walletDto };
  } finally {
    session.endSession();
  }
}

module.exports = {
  createWithdrawRequest,
  listMyWithdraws,
  listAdminWithdraws,
  approveWithdraw,
  rejectWithdraw,
  toPublicWithdraw,
  getWalletBalance,
  toPublicTransaction,
};
