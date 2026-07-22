const mongoose = require("mongoose");
const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");
const SystemWallet = require("../models/SystemWallet");
const WithdrawRequest = require("../models/WithdrawRequest");
const { getPayosClient } = require("./payosClient");
const {
  WALLET_TX_TYPE,
  WALLET_TX_STATUS,
  WALLET_TX_TYPE_LABEL,
  WALLET_TX_STATUS_LABEL,
  WALLET_REFERENCE_TYPE,
  MIN_TOPUP_AMOUNT,
  MAX_TOPUP_AMOUNT,
  NOTIFICATION_AUDIENCE,
} = require("../constants");
const { createNotification } = require("./notificationService");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toPublicTransaction(tx, extras = {}) {
  return {
    id: String(tx._id),
    type: Number(tx.type),
    typeLabel: WALLET_TX_TYPE_LABEL[tx.type] || "Giao dịch",
    amount: Number(tx.amount) || 0,
    status: Number(tx.status),
    statusLabel: WALLET_TX_STATUS_LABEL[tx.status] || "",
    orderCode: Number(tx.orderCode) || null,
    paymentLinkId: tx.paymentLinkId || "",
    description: tx.description || "",
    balanceBefore: tx.balanceBefore == null ? null : Number(tx.balanceBefore),
    balanceAfter: tx.balanceAfter == null ? null : Number(tx.balanceAfter),
    reservationId: tx.reservationId ? String(tx.reservationId) : null,
    referenceId: tx.referenceId ? String(tx.referenceId) : null,
    referenceType: tx.referenceType || "",
    createdAt: tx.CreatedAt,
    updatedAt: tx.UpdatedAt,
    ...extras,
  };
}

async function enrichWithdrawTransaction(tx, publicTx) {
  if (Number(tx.type) !== WALLET_TX_TYPE.WITHDRAWAL) {
    return publicTx;
  }

  let withdraw = null;
  if (
    tx.referenceId &&
    String(tx.referenceType || "") === WALLET_REFERENCE_TYPE.WITHDRAW
  ) {
    withdraw = await WithdrawRequest.findById(tx.referenceId).lean();
  }
  if (!withdraw) {
    withdraw = await WithdrawRequest.findOne({ walletTransactionId: tx._id }).lean();
  }
  if (!withdraw) {
    return publicTx;
  }

  return {
    ...publicTx,
    bankName: withdraw.bankName || "",
    bankCode: withdraw.bankCode || "",
    accountNumber: withdraw.accountNumber || "",
    accountName: withdraw.accountName || "",
    withdrawStatus: Number(withdraw.status),
    adminNote: withdraw.adminNote || "",
  };
}

async function getOrCreateWallet(userId, session = null) {
  const query = Wallet.findOne({ userId });
  if (session) {
    query.session(session);
  }
  let wallet = await query;
  if (wallet) {
    return wallet;
  }

  try {
    const created = await Wallet.create(
      [{ userId, balance: 0 }],
      session ? { session } : undefined
    );
    return created[0];
  } catch (error) {
    if (error?.code === 11000) {
      const retry = Wallet.findOne({ userId });
      if (session) {
        retry.session(session);
      }
      return await retry;
    }
    throw error;
  }
}

async function getWalletBalance(userId) {
  const wallet = await getOrCreateWallet(userId);
  return {
    balance: Math.max(0, Number(wallet.balance) || 0),
    updatedAt: wallet.UpdatedAt,
  };
}

function generateOrderCode() {
  const base = Date.now() % 1000000000;
  const rand = Math.floor(Math.random() * 900) + 100;
  return Number(`${base}${rand}`.slice(0, 15));
}

async function createUniqueOrderCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const orderCode = generateOrderCode();
    const exists = await WalletTransaction.exists({ orderCode });
    if (!exists) {
      return orderCode;
    }
  }
  throw createServiceError("Không tạo được mã giao dịch. Thử lại.", 500);
}

function resolveReturnUrls() {
  const returnUrl =
    String(process.env.PAYOS_RETURN_URL || "").trim() ||
    "fastmark://wallet/topup-result?status=success";
  const cancelUrl =
    String(process.env.PAYOS_CANCEL_URL || "").trim() ||
    "fastmark://wallet/topup-result?status=cancel";
  return { returnUrl, cancelUrl };
}

/** Nội dung CK trên PayOS/VietQR — dùng userId (24 hex) để đối soát, vừa trong giới hạn 25 ký tự. */
function buildPayosDescription(user) {
  const userId = String(user?._id || user?.id || "").trim();
  if (/^[a-fA-F0-9]{24}$/.test(userId)) {
    return userId;
  }
  return userId.slice(0, 25) || "FastMark";
}

async function applySuccessfulTopup(orderCode, { amount, paymentLinkId } = {}) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const tx = await WalletTransaction.findOne({ orderCode }).session(session);
    if (!tx) {
      await session.abortTransaction();
      return { handled: false, reason: "transaction_not_found" };
    }

    if (tx.status === WALLET_TX_STATUS.SUCCESS) {
      await session.commitTransaction();
      return { handled: true, idempotent: true, transactionId: String(tx._id) };
    }

    if (amount != null && Number(tx.amount) !== Math.round(Number(amount))) {
      tx.status = WALLET_TX_STATUS.FAILED;
      await tx.save({ session });
      await session.commitTransaction();
      throw createServiceError("Số tiền không khớp giao dịch.", 400);
    }

    const wallet = await getOrCreateWallet(tx.userId, session);
    wallet.balance = Math.max(0, Number(wallet.balance) || 0) + Number(tx.amount);
    await wallet.save({ session });

    tx.status = WALLET_TX_STATUS.SUCCESS;
    tx.balanceAfter = wallet.balance;
    if (paymentLinkId) {
      tx.paymentLinkId = String(paymentLinkId);
    }
    await tx.save({ session });

    await session.commitTransaction();

    await createNotification(tx.userId, {
      title: "Nạp tiền thành công",
      content: `Đã nạp ${Number(tx.amount).toLocaleString("vi-VN")}đ vào ví FastMark.`,
      audience: NOTIFICATION_AUDIENCE.SYSTEM,
    }).catch((error) => {
      console.warn("[wallet] topup notification failed:", error?.message || error);
    });

    return {
      handled: true,
      credited: true,
      transactionId: String(tx._id),
      balance: wallet.balance,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

async function createTopup(user, amountInput) {
  const amount = Math.round(Number(amountInput));
  if (!Number.isFinite(amount) || amount < MIN_TOPUP_AMOUNT) {
    throw createServiceError(
      `Số tiền nạp tối thiểu là ${MIN_TOPUP_AMOUNT.toLocaleString("vi-VN")}đ.`
    );
  }
  if (amount > MAX_TOPUP_AMOUNT) {
    throw createServiceError(
      `Số tiền nạp tối đa là ${MAX_TOPUP_AMOUNT.toLocaleString("vi-VN")}đ.`
    );
  }

  await getOrCreateWallet(user._id);
  const orderCode = await createUniqueOrderCode();
  const { returnUrl, cancelUrl } = resolveReturnUrls();
  const payosDescription = buildPayosDescription(user);
  const internalDescription = `Nạp ví · ${payosDescription}`;

  const payos = getPayosClient();
  const createPayload = {
    orderCode,
    amount,
    description: payosDescription,
    returnUrl,
    cancelUrl,
  };
  const buyerName = String(user.FullName || user.UserName || "").trim();
  if (buyerName) {
    createPayload.buyerName = buyerName;
  }
  const paymentLink = await payos.paymentRequests.create(createPayload);

  const tx = await WalletTransaction.create({
    userId: user._id,
    type: WALLET_TX_TYPE.TOPUP,
    amount,
    status: WALLET_TX_STATUS.PENDING,
    orderCode,
    paymentLinkId: String(paymentLink.paymentLinkId || ""),
    checkoutUrl: String(paymentLink.checkoutUrl || ""),
    description: internalDescription,
  });

  return {
    transaction: toPublicTransaction(tx),
    checkoutUrl: String(paymentLink.checkoutUrl || ""),
    orderCode,
    paymentLinkId: String(paymentLink.paymentLinkId || ""),
    qrCode: paymentLink.qrCode || "",
    description: payosDescription,
  };
}

async function listTransactions(userId, { limit = 30 } = {}) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 30));
  const rows = await WalletTransaction.find({ userId })
    .sort({ CreatedAt: -1 })
    .limit(safeLimit);
  return rows.map(toPublicTransaction);
}

async function getTransaction(userId, transactionId) {
  if (!mongoose.Types.ObjectId.isValid(transactionId)) {
    throw createServiceError("Giao dịch không hợp lệ.", 404);
  }
  const tx = await WalletTransaction.findOne({ _id: transactionId, userId });
  if (!tx) {
    throw createServiceError("Không tìm thấy giao dịch.", 404);
  }
  return enrichWithdrawTransaction(tx, toPublicTransaction(tx));
}

async function creditTopupFromWebhook(webhookPayload) {
  const payos = getPayosClient();
  const verified = await payos.webhooks.verify(webhookPayload);
  const data = verified?.data || verified;
  const orderCode = Number(data?.orderCode);
  const amount = Math.round(Number(data?.amount));
  const code = String(data?.code ?? verified?.code ?? "");
  const success =
    verified?.success === true || code === "00" || String(data?.code || "") === "00";

  if (!Number.isFinite(orderCode)) {
    throw createServiceError("Webhook thiếu orderCode.", 400);
  }

  if (!success) {
    const tx = await WalletTransaction.findOne({ orderCode });
    if (tx && tx.status === WALLET_TX_STATUS.PENDING) {
      tx.status = WALLET_TX_STATUS.FAILED;
      await tx.save();
    }
    return { handled: true, failed: true, orderCode };
  }

  return applySuccessfulTopup(orderCode, {
    amount,
    paymentLinkId: data?.paymentLinkId,
  });
}

async function syncTopupStatus(user, orderCodeInput) {
  const orderCode = Number(orderCodeInput);
  if (!Number.isFinite(orderCode)) {
    throw createServiceError("Mã giao dịch không hợp lệ.");
  }

  let tx = await WalletTransaction.findOne({ orderCode, userId: user._id });
  if (!tx) {
    throw createServiceError("Không tìm thấy giao dịch.", 404);
  }

  if (tx.status !== WALLET_TX_STATUS.SUCCESS) {
    const payos = getPayosClient();
    try {
      const paymentInfo = await payos.paymentRequests.get(orderCode);
      const status = String(paymentInfo?.status || "").toUpperCase();
      if (status === "PAID") {
        await applySuccessfulTopup(orderCode, {
          amount: tx.amount,
          paymentLinkId: paymentInfo?.paymentLinkId || tx.paymentLinkId,
        });
      } else if (status === "CANCELLED" || status === "EXPIRED") {
        if (tx.status === WALLET_TX_STATUS.PENDING) {
          tx.status = WALLET_TX_STATUS.CANCELLED;
          tx.UpdatedAt = new Date();
          await tx.save();
        }
      }
    } catch {
      // Keep pending if PayOS lookup fails; client can retry.
    }
    tx = await WalletTransaction.findOne({ orderCode, userId: user._id });
  }

  const wallet = await getWalletBalance(user._id);
  return { transaction: toPublicTransaction(tx), wallet };
}

/** User hủy nạp (nút Hủy trên PayOS / đóng WebView) → PENDING → CANCELLED. */
async function cancelTopup(user, orderCodeInput) {
  const orderCode = Number(orderCodeInput);
  if (!Number.isFinite(orderCode)) {
    throw createServiceError("Mã giao dịch không hợp lệ.");
  }

  let tx = await WalletTransaction.findOne({ orderCode, userId: user._id });
  if (!tx) {
    throw createServiceError("Không tìm thấy giao dịch.", 404);
  }

  if (tx.status === WALLET_TX_STATUS.SUCCESS) {
    throw createServiceError("Giao dịch đã thanh toán thành công, không thể hủy.");
  }

  if (tx.status === WALLET_TX_STATUS.PENDING) {
    // Hủy link trên PayOS nếu còn (best-effort).
    try {
      const payos = getPayosClient();
      if (typeof payos.paymentRequests?.cancel === "function") {
        await payos.paymentRequests.cancel(orderCode);
      }
    } catch {
      // Vẫn đánh dấu hủy phía FastMark.
    }

    tx.status = WALLET_TX_STATUS.CANCELLED;
    tx.UpdatedAt = new Date();
    await tx.save();
  }

  const wallet = await getWalletBalance(user._id);
  return { transaction: toPublicTransaction(tx), wallet };
}

async function debitWallet(userId, amount, { description, session, referenceId, referenceType } = {}) {
  const debitAmount = Math.round(Number(amount));
  if (!Number.isFinite(debitAmount) || debitAmount <= 0) {
    throw createServiceError("Số tiền trừ ví không hợp lệ.");
  }

  const wallet = await getOrCreateWallet(userId, session);
  const balance = Math.max(0, Number(wallet.balance) || 0);
  if (balance < debitAmount) {
    throw createServiceError(
      `Số dư ví không đủ. Cần ${debitAmount.toLocaleString("vi-VN")}đ, hiện có ${balance.toLocaleString("vi-VN")}đ.`,
      400
    );
  }

  wallet.balance = balance - debitAmount;
  await wallet.save(session ? { session } : undefined);

  const orderCode = Date.now() % 1000000000000;
  const created = await WalletTransaction.create(
    [
      {
        userId,
        type: WALLET_TX_TYPE.PAYMENT,
        amount: debitAmount,
        status: WALLET_TX_STATUS.SUCCESS,
        orderCode,
        description: description || "Thanh toán từ ví",
        balanceAfter: wallet.balance,
        ...(referenceId ? { referenceId } : {}),
        ...(referenceType ? { referenceType } : {}),
      },
    ],
    session ? { session } : undefined
  );

  return { wallet, transaction: created[0] };
}

async function creditWalletRefund(userId, amount, { description, session } = {}) {
  const creditAmount = Math.round(Number(amount));
  if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
    return null;
  }

  const wallet = await getOrCreateWallet(userId, session);
  wallet.balance = Math.max(0, Number(wallet.balance) || 0) + creditAmount;
  await wallet.save(session ? { session } : undefined);

  const orderCode = await createUniqueOrderCode();
  const created = await WalletTransaction.create(
    [
      {
        userId,
        type: WALLET_TX_TYPE.REFUND,
        amount: creditAmount,
        status: WALLET_TX_STATUS.SUCCESS,
        orderCode,
        description: description || "Hoàn tiền về ví",
        balanceAfter: wallet.balance,
      },
    ],
    session ? { session } : undefined
  );

  return { wallet, transaction: created[0] };
}

async function getOrCreateSystemWallet(session = null) {
  const query = SystemWallet.findOne({ key: "system" });
  if (session) {
    query.session(session);
  }
  let wallet = await query;
  if (wallet) {
    return wallet;
  }
  try {
    const created = await SystemWallet.create(
      [{ key: "system", balance: 0 }],
      session ? { session } : undefined
    );
    return created[0];
  } catch (error) {
    if (error?.code === 11000) {
      const retry = SystemWallet.findOne({ key: "system" });
      if (session) {
        retry.session(session);
      }
      return await retry;
    }
    throw error;
  }
}

/** Buyer Wallet → System Wallet (đặt cọc). */
async function holdDepositToSystem(userId, amount, { description, reservationId, session } = {}) {
  const holdAmount = Math.round(Number(amount));
  if (!Number.isFinite(holdAmount) || holdAmount <= 0) {
    throw createServiceError("Số tiền cọc không hợp lệ.");
  }

  const userWallet = await getOrCreateWallet(userId, session);
  const balanceBefore = Math.max(0, Number(userWallet.balance) || 0);
  if (balanceBefore < holdAmount) {
    throw createServiceError(
      `Số dư ví không đủ. Cần ${holdAmount.toLocaleString("vi-VN")}đ, hiện có ${balanceBefore.toLocaleString("vi-VN")}đ.`,
      400
    );
  }

  const systemWallet = await getOrCreateSystemWallet(session);
  userWallet.balance = balanceBefore - holdAmount;
  systemWallet.balance = Math.max(0, Number(systemWallet.balance) || 0) + holdAmount;
  await userWallet.save(session ? { session } : undefined);
  await systemWallet.save(session ? { session } : undefined);

  const orderCode = await createUniqueOrderCode();
  const created = await WalletTransaction.create(
    [
      {
        userId,
        type: WALLET_TX_TYPE.DEPOSIT_HOLD,
        amount: holdAmount,
        status: WALLET_TX_STATUS.SUCCESS,
        orderCode,
        description: description || "Đặt cọc giữ hàng (Reservation Deposit)",
        balanceBefore,
        balanceAfter: userWallet.balance,
        reservationId: reservationId || null,
        referenceId: reservationId || null,
        referenceType: reservationId ? WALLET_REFERENCE_TYPE.RESERVATION : "",
      },
    ],
    session ? { session } : undefined
  );

  return {
    userWallet,
    systemWallet,
    transaction: created[0],
  };
}

/** System Wallet → Buyer Wallet (hoàn cọc). */
async function refundDepositFromSystem(
  userId,
  amount,
  { description, reservationId, session } = {}
) {
  const creditAmount = Math.round(Number(amount));
  if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
    return null;
  }

  const systemWallet = await getOrCreateSystemWallet(session);
  const systemBalance = Math.max(0, Number(systemWallet.balance) || 0);
  if (systemBalance < creditAmount) {
    throw createServiceError("Số dư ví hệ thống không đủ để hoàn cọc.", 500);
  }

  const userWallet = await getOrCreateWallet(userId, session);
  const balanceBefore = Math.max(0, Number(userWallet.balance) || 0);
  systemWallet.balance = systemBalance - creditAmount;
  userWallet.balance = balanceBefore + creditAmount;
  await systemWallet.save(session ? { session } : undefined);
  await userWallet.save(session ? { session } : undefined);

  const orderCode = await createUniqueOrderCode();
  const created = await WalletTransaction.create(
    [
      {
        userId,
        type: WALLET_TX_TYPE.DEPOSIT_REFUND,
        amount: creditAmount,
        status: WALLET_TX_STATUS.SUCCESS,
        orderCode,
        description: description || "Hoàn cọc giữ hàng (Reservation Refund)",
        balanceBefore,
        balanceAfter: userWallet.balance,
        reservationId: reservationId || null,
        referenceId: reservationId || null,
        referenceType: reservationId ? WALLET_REFERENCE_TYPE.RESERVATION : "",
      },
    ],
    session ? { session } : undefined
  );

  return { userWallet, systemWallet, transaction: created[0] };
}

/** System Wallet → Seller Wallet (giải phóng cọc). */
async function releaseDepositFromSystem(
  sellerUserId,
  amount,
  { description, reservationId, session } = {}
) {
  const creditAmount = Math.round(Number(amount));
  if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
    return null;
  }

  const systemWallet = await getOrCreateSystemWallet(session);
  const systemBalance = Math.max(0, Number(systemWallet.balance) || 0);
  if (systemBalance < creditAmount) {
    throw createServiceError("Số dư ví hệ thống không đủ để giải phóng cọc.", 500);
  }

  const sellerWallet = await getOrCreateWallet(sellerUserId, session);
  const balanceBefore = Math.max(0, Number(sellerWallet.balance) || 0);
  systemWallet.balance = systemBalance - creditAmount;
  sellerWallet.balance = balanceBefore + creditAmount;
  await systemWallet.save(session ? { session } : undefined);
  await sellerWallet.save(session ? { session } : undefined);

  const orderCode = await createUniqueOrderCode();
  const created = await WalletTransaction.create(
    [
      {
        userId: sellerUserId,
        type: WALLET_TX_TYPE.DEPOSIT_RELEASE,
        amount: creditAmount,
        status: WALLET_TX_STATUS.SUCCESS,
        orderCode,
        description: description || "Giải phóng cọc giữ hàng (Reservation Release / Auto Release)",
        balanceBefore,
        balanceAfter: sellerWallet.balance,
        reservationId: reservationId || null,
        referenceId: reservationId || null,
        referenceType: reservationId ? WALLET_REFERENCE_TYPE.RESERVATION : "",
      },
    ],
    session ? { session } : undefined
  );

  return { sellerWallet, systemWallet, transaction: created[0] };
}

module.exports = {
  getOrCreateWallet,
  getWalletBalance,
  getOrCreateSystemWallet,
  createUniqueOrderCode,
  createTopup,
  listTransactions,
  getTransaction,
  creditTopupFromWebhook,
  syncTopupStatus,
  cancelTopup,
  toPublicTransaction,
  debitWallet,
  creditWalletRefund,
  holdDepositToSystem,
  refundDepositFromSystem,
  releaseDepositFromSystem,
};
