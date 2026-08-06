import mongoose from 'mongoose';
import Transaction from './transaction.model.js';
import User from '../user/user.model.js';
import { ApiError } from '../../shared/utils/apiError.js';
import { notifyUser } from '../notification/notification.service.js';
import {
    maybeRewardReferralOnRechargeService,
} from '../referral/referral.service.js';

const sendNotificationSafely = async (payload) => {
    try {
        await notifyUser(payload);
    } catch (error) {
        console.error(
            '❌ Notification failed after transaction commit:',
            error?.message || error
        );
    }
};

export const getPendingPaymentsService = async ({
    page = 1,
    limit = 20,
}) => {
    const filter = {
        category: 'add_money',
        status: 'pending',
    };

    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.max(Number(limit) || 20, 1);

    const [
        transactions,
        count,
    ] = await Promise.all([
        Transaction.find(filter)
            .populate('userId', 'fullName phoneNumber')
            .sort({ createdAt: -1 })
            .limit(limitNum)
            .skip((pageNum - 1) * limitNum)
            .lean(),

        Transaction.countDocuments(filter),
    ]);

    return {
        transactions,
        totalPages: Math.ceil(count / limitNum),
        currentPage: pageNum,
        totalPending: count,
    };
};

export const getPendingWithdrawalsService = async ({
    page = 1,
    limit = 20,
}) => {
    const filter = {
        category: 'withdrawal',
        status: 'pending',
    };

    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.max(Number(limit) || 20, 1);

    const [
        withdrawals,
        count,
    ] = await Promise.all([
        Transaction.find(filter)
            .populate(
                'userId',
                'fullName phoneNumber walletBalance'
            )
            .sort({ createdAt: -1 })
            .limit(limitNum)
            .skip((pageNum - 1) * limitNum)
            .lean(),

        Transaction.countDocuments(filter),
    ]);

    return {
        withdrawals,
        totalPages: Math.ceil(count / limitNum),
        currentPage: pageNum,
        totalPending: count,
    };
};

export const approvePaymentService = async ({
    transactionId,
    verificationNote,
    adminId,
}) => {
    if (!transactionId) {
        throw new ApiError(
            400,
            'Transaction ID is required'
        );
    }

    if (!adminId) {
        throw new ApiError(
            400,
            'Admin ID is required'
        );
    }

    const session = await mongoose.startSession();

    let transaction;
    let balanceAfter;
    let referralResult = null;

    try {
        session.startTransaction({
            readPreference: 'primary',
            readConcern: {
                level: 'majority',
            },
            writeConcern: {
                w: 'majority',
            },
        });

        transaction = await Transaction.findOne({
            _id: transactionId,
            category: 'add_money',
            status: 'pending',
        })
            .session(session)
            .read('primary');

        if (!transaction) {
            throw new ApiError(
                404,
                'Pending transaction not found'
            );
        }

        const user = await User.findById(transaction.userId)
            .session(session)
            .read('primary');

        if (!user) {
            throw new ApiError(
                404,
                'User not found'
            );
        }

        const amount = Number(transaction.amount);

        if (!Number.isFinite(amount) || amount <= 0) {
            throw new ApiError(
                400,
                'Invalid transaction amount'
            );
        }

        const balanceBefore = Number(
            user.walletBalance || 0
        );

        balanceAfter = balanceBefore + amount;

        user.walletBalance = balanceAfter;
        await user.save({ session });

        transaction.status = 'completed';
        transaction.balanceAfter = balanceAfter;

        transaction.paymentDetails =
            transaction.paymentDetails || {};

        transaction.paymentDetails.verifiedAt =
            new Date();

        transaction.paymentDetails.verificationNote =
            verificationNote || 'Payment verified';

        transaction.paymentDetails.verifiedBy =
            adminId;

        transaction.adminAction = {
            actionType: 'approved',
            actionBy: adminId,
            actionAt: new Date(),
            reason:
                verificationNote || 'Payment verified',
        };

        transaction.description =
            `Wallet credited via ${transaction.paymentDetails.gateway ||
            'manual payment'
            }. Verified by admin.`;

        await transaction.save({ session });

        /*
         * Do not swallow referral errors.
         * If referral ledger creation fails, the deposit approval
         * and referral reward both roll back.
         */
        referralResult =
            await maybeRewardReferralOnRechargeService({
                userId: transaction.userId,
                rechargeAmount: amount,
                transactionId: transaction._id,
                session,
            });

        await session.commitTransaction();
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }

        throw error;
    } finally {
        await session.endSession();
    }

    /*
     * Deposit notification is sent only after commit.
     */
    await sendNotificationSafely({
        userId: transaction.userId,
        title: 'Deposit Successful',
        message: `Your deposit of ₹${Number(
            transaction.amount
        ).toLocaleString(
            'en-IN'
        )} was approved and added to your wallet.`,
        type: 'payment',
        adminId,
        data: {
            transactionId: transaction._id.toString(),
            amount: String(transaction.amount),
            status: 'approved',
        },
    });

    /*
     * Referral notifications are also sent only after commit.
     */
    if (referralResult) {
        await sendNotificationSafely({
            userId: referralResult.refereeId,
            title: 'Referral Bonus Received',
            message: `₹${referralResult.rewardAmount} bonus was credited for your first approved recharge.`,
            type: 'referral',
            adminId,
            data: {
                referralId:
                    referralResult.referralId.toString(),
                amount: String(
                    referralResult.rewardAmount
                ),
                role: 'referee',
            },
        });

        await sendNotificationSafely({
            userId: referralResult.referrerId,
            title: 'Referral Bonus Received',
            message: `You received ₹${referralResult.rewardAmount} because ${referralResult.refereeName} completed their first approved recharge.`,
            type: 'referral',
            adminId,
            data: {
                referralId:
                    referralResult.referralId.toString(),
                amount: String(
                    referralResult.rewardAmount
                ),
                role: 'referrer',
            },
        });
    }

    return {
        transaction,
        newBalance: balanceAfter,
        referralRewarded: Boolean(referralResult),
        message: `₹${transaction.amount} has been added to user's wallet`,
    };
};

export const rejectPaymentService = async ({
    transactionId,
    reason,
    adminId,
}) => {
    if (!transactionId || !reason) {
        throw new ApiError(
            400,
            'Transaction ID and reason are required'
        );
    }

    const transaction = await Transaction.findOne({
        _id: transactionId,
        category: 'add_money',
        status: 'pending',
    });

    if (!transaction) {
        throw new ApiError(
            404,
            'Pending transaction not found'
        );
    }

    transaction.status = 'rejected';

    transaction.adminAction = {
        actionType: 'rejected',
        actionBy: adminId,
        actionAt: new Date(),
        reason,
    };

    transaction.description =
        `Payment rejected: ${reason}`;

    await transaction.save();

    await sendNotificationSafely({
        userId: transaction.userId,
        title: 'Deposit Rejected',
        message: `Your deposit of ₹${Number(
            transaction.amount
        ).toLocaleString(
            'en-IN'
        )} was rejected. Reason: ${reason}`,
        type: 'payment',
        adminId,
        data: {
            transactionId: transaction._id.toString(),
            amount: String(transaction.amount),
            status: 'rejected',
            reason: String(reason),
        },
    });

    return {
        transaction,
        message: 'Payment request rejected',
    };
};

export const approveWithdrawalService = async ({
    transactionId,
    utrNumber,
    verificationNote,
    adminId,
}) => {
    if (!transactionId) {
        throw new ApiError(
            400,
            'Transaction ID is required'
        );
    }

    if (!utrNumber) {
        throw new ApiError(
            400,
            'UTR/Transaction ID is required'
        );
    }

    const transaction = await Transaction.findOne({
        _id: transactionId,
        category: 'withdrawal',
        status: 'pending',
    }).populate(
        'userId',
        'fullName phoneNumber'
    );

    if (!transaction) {
        throw new ApiError(
            404,
            'Pending withdrawal not found'
        );
    }

    transaction.status = 'completed';

    transaction.withdrawalDetails =
        transaction.withdrawalDetails || {};

    transaction.withdrawalDetails.utrNumber =
        String(utrNumber).trim();

    transaction.withdrawalDetails.processedAt =
        new Date();

    transaction.withdrawalDetails.processedBy =
        adminId;

    transaction.adminAction = {
        actionType: 'approved',
        actionBy: adminId,
        actionAt: new Date(),
        reason:
            verificationNote ||
            'Withdrawal approved and processed',
    };

    transaction.description =
        `Withdrawal completed - UTR: ${utrNumber}`;

    await transaction.save();

    await sendNotificationSafely({
        userId: transaction.userId._id,
        title: 'Withdrawal Successful',
        message: `Your withdrawal of ₹${Number(
            transaction.amount
        ).toLocaleString(
            'en-IN'
        )} has been processed. Transaction ID: ${utrNumber}`,
        type: 'withdrawal',
        adminId,
        data: {
            transactionId: transaction._id.toString(),
            amount: String(transaction.amount),
            status: 'approved',
            utrNumber: String(utrNumber),
        },
    });

    return {
        transaction,
        message: `₹${transaction.amount} withdrawal approved for ${transaction.userId.fullName}`,
    };
};

export const rejectWithdrawalService = async ({
    transactionId,
    reason,
    adminId,
}) => {
    if (!transactionId || !reason) {
        throw new ApiError(
            400,
            'Transaction ID and rejection reason are required'
        );
    }

    const session = await mongoose.startSession();

    let transaction;

    try {
        session.startTransaction({
            readPreference: 'primary',
            readConcern: {
                level: 'majority',
            },
            writeConcern: {
                w: 'majority',
            },
        });

        transaction = await Transaction.findOne({
            _id: transactionId,
            category: 'withdrawal',
            status: 'pending',
        })
            .session(session)
            .read('primary');

        if (!transaction) {
            throw new ApiError(
                404,
                'Pending withdrawal not found'
            );
        }

        const user = await User.findById(transaction.userId)
            .session(session)
            .read('primary');

        if (!user) {
            throw new ApiError(
                404,
                'User not found'
            );
        }

        const balanceBefore = Number(
            user.walletBalance || 0
        );

        user.walletBalance =
            balanceBefore + Number(transaction.amount);

        await user.save({ session });

        transaction.status = 'rejected';

        transaction.withdrawalDetails =
            transaction.withdrawalDetails || {};

        transaction.withdrawalDetails.rejectionReason =
            reason;

        transaction.withdrawalDetails.processedAt =
            new Date();

        transaction.withdrawalDetails.processedBy =
            adminId;

        transaction.adminAction = {
            actionType: 'rejected',
            actionBy: adminId,
            actionAt: new Date(),
            reason,
        };

        transaction.description =
            `Withdrawal rejected: ${reason}. Amount refunded.`;

        await transaction.save({ session });

        await session.commitTransaction();
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }

        throw error;
    } finally {
        await session.endSession();
    }

    await sendNotificationSafely({
        userId: transaction.userId,
        title: 'Withdrawal Rejected',
        message: `Your withdrawal of ₹${Number(
            transaction.amount
        ).toLocaleString(
            'en-IN'
        )} was rejected. Reason: ${reason}. The amount has been refunded to your wallet.`,
        type: 'withdrawal',
        adminId,
        data: {
            transactionId: transaction._id.toString(),
            amount: String(transaction.amount),
            status: 'rejected',
            reason: String(reason),
        },
    });

    return {
        transaction,
        message:
            'Withdrawal rejected and amount refunded to user wallet',
    };
};

export const getAllTransactionsAdminService = async ({
    page = 1,
    limit = 50,
    status,
    category,
}) => {
    const filter = {};

    if (status) {
        filter.status = status;
    }

    if (category) {
        filter.category = category;
    }

    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(
        Math.max(Number(limit) || 50, 1),
        200
    );

    const [
        transactions,
        count,
    ] = await Promise.all([
        Transaction.find(filter)
            .populate(
                'userId',
                'fullName phoneNumber'
            )
            .sort({ createdAt: -1 })
            .limit(limitNum)
            .skip((pageNum - 1) * limitNum)
            .lean(),

        Transaction.countDocuments(filter),
    ]);

    return {
        transactions,
        totalPages: Math.ceil(count / limitNum),
        currentPage: pageNum,
        totalTransactions: count,
    };
};

export const getWithdrawalStatsAdminService = async () => {
    const [
        completed,
        pending,
        rejected,
    ] = await Promise.all([
        Transaction.aggregate([
            {
                $match: {
                    category: 'withdrawal',
                    status: 'completed',
                },
            },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: '$amount' },
                    count: { $sum: 1 },
                },
            },
        ]),

        Transaction.aggregate([
            {
                $match: {
                    category: 'withdrawal',
                    status: 'pending',
                },
            },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: '$amount' },
                    count: { $sum: 1 },
                },
            },
        ]),

        Transaction.aggregate([
            {
                $match: {
                    category: 'withdrawal',
                    status: 'rejected',
                },
            },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: '$amount' },
                    count: { $sum: 1 },
                },
            },
        ]),
    ]);

    return {
        completed: {
            amount: completed[0]?.totalAmount || 0,
            count: completed[0]?.count || 0,
        },

        pending: {
            amount: pending[0]?.totalAmount || 0,
            count: pending[0]?.count || 0,
        },

        rejected: {
            amount: rejected[0]?.totalAmount || 0,
            count: rejected[0]?.count || 0,
        },

        grandTotal:
            (completed[0]?.totalAmount || 0) +
            (pending[0]?.totalAmount || 0),
    };
};