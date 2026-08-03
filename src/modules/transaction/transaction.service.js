import mongoose from 'mongoose';
import Transaction from './transaction.model.js';
import User from '../user/user.model.js';
import { ApiError } from '../../shared/utils/apiError.js';

export const getPendingPaymentsService = async ({ page = 1, limit = 20 }) => {
    const filter = { category: 'add_money', status: 'pending' };

    const pageNum = Number(page);
    const limitNum = Number(limit);

    const transactions = await Transaction.find(filter)
        .populate('userId', 'fullName phoneNumber')
        .sort({ createdAt: -1 })
        .limit(limitNum)
        .skip((pageNum - 1) * limitNum)
        .lean();

    const count = await Transaction.countDocuments(filter);

    return {
        transactions,
        totalPages: Math.ceil(count / limitNum),
        currentPage: pageNum,
        totalPending: count
    };
};

export const getPendingWithdrawalsService = async ({ page = 1, limit = 20 }) => {
    const filter = { category: 'withdrawal', status: 'pending' };

    const pageNum = Number(page);
    const limitNum = Number(limit);

    const withdrawals = await Transaction.find(filter)
        .populate('userId', 'fullName phoneNumber walletBalance')
        .sort({ createdAt: -1 })
        .limit(limitNum)
        .skip((pageNum - 1) * limitNum)
        .lean();

    const count = await Transaction.countDocuments(filter);

    return {
        withdrawals,
        totalPages: Math.ceil(count / limitNum),
        currentPage: pageNum,
        totalPending: count
    };
};

export const approvePaymentService = async ({ transactionId, verificationNote, adminId }) => {
    if (!transactionId) {
        throw new ApiError(400, 'Transaction ID is required');
    }

    const session = await mongoose.startSession();
    session.startTransaction({
        readPreference: 'primary',
        readConcern: { level: 'majority' },
        writeConcern: { w: 'majority' }
    });

    try {
        const transaction = await Transaction.findOne({
            _id: transactionId,
            category: 'add_money',
            status: 'pending'
        })
            .session(session)
            .read('primary');

        if (!transaction) {
            throw new ApiError(404, 'Pending transaction not found');
        }

        const user = await User.findById(transaction.userId).session(session).read('primary');

        if (!user) {
            throw new ApiError(404, 'User not found');
        }

        const balanceBefore = user.walletBalance;
        const balanceAfter = balanceBefore + transaction.amount;

        user.walletBalance = balanceAfter;
        await user.save({ session });

        transaction.status = 'completed';
        transaction.balanceAfter = balanceAfter;
        transaction.paymentDetails.verifiedAt = new Date();
        transaction.paymentDetails.verificationNote = verificationNote || 'Payment verified';
        transaction.paymentDetails.verifiedBy = adminId;
        transaction.adminAction = {
            actionType: 'approved',
            actionBy: adminId,
            actionAt: new Date(),
            reason: verificationNote
        };
        transaction.description = `Wallet credited via ${transaction.paymentDetails.gateway}. Verified by admin.`;

        await transaction.save({ session });
        await session.commitTransaction();

        // ✅ NEW: Notify user instantly — deposit success
        await notifyUser({
            userId: transaction.userId,
            title: 'Deposit Successful ✅',
            message: `Your deposit of ₹${transaction.amount.toLocaleString('en-IN')} was successful and added to your wallet.`,
            type: 'payment',
            data: { transactionId: transaction._id.toString(), amount: transaction.amount, status: 'approved' },
        });


        return {
            transaction,
            newBalance: balanceAfter,
            message: `₹${transaction.amount} has been added to user's wallet`
        };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

export const rejectPaymentService = async ({ transactionId, reason, adminId }) => {
    if (!transactionId || !reason) {
        throw new ApiError(400, 'Transaction ID and reason are required');
    }

    const transaction = await Transaction.findOne({
        _id: transactionId,
        category: 'add_money',
        status: 'pending'
    });

    if (!transaction) {
        throw new ApiError(404, 'Pending transaction not found');
    }

    transaction.status = 'rejected';
    transaction.adminAction = {
        actionType: 'rejected',
        actionBy: adminId,
        actionAt: new Date(),
        reason
    };
    transaction.description = `Payment rejected: ${reason}`;

    await transaction.save();

    // ✅ NEW: Notify user instantly — deposit rejected with reason
    await notifyUser({
        userId: transaction.userId,
        title: 'Deposit Rejected ❌',
        message: `Your deposit of ₹${transaction.amount.toLocaleString('en-IN')} was rejected. Reason: ${reason}`,
        type: 'payment',
        data: { transactionId: transaction._id.toString(), amount: transaction.amount, status: 'rejected', reason },
    });

    return {
        transaction,
        message: 'Payment request rejected'
    };
};

export const approveWithdrawalService = async ({
    transactionId,
    utrNumber,
    verificationNote,
    adminId
}) => {
    if (!transactionId) {
        throw new ApiError(400, 'Transaction ID is required');
    }

    if (!utrNumber) {
        throw new ApiError(400, 'UTR/Transaction ID is required');
    }

    const transaction = await Transaction.findOne({
        _id: transactionId,
        category: 'withdrawal',
        status: 'pending'
    }).populate('userId', 'fullName phoneNumber');

    if (!transaction) {
        throw new ApiError(404, 'Pending withdrawal not found');
    }

    transaction.status = 'completed';
    transaction.withdrawalDetails.utrNumber = utrNumber;
    transaction.withdrawalDetails.processedAt = new Date();
    transaction.withdrawalDetails.processedBy = adminId;
    transaction.adminAction = {
        actionType: 'approved',
        actionBy: adminId,
        actionAt: new Date(),
        reason: verificationNote || 'Withdrawal approved and processed'
    };
    transaction.description = `Withdrawal completed - UTR: ${utrNumber}`;

    await transaction.save();

    // ✅ NEW: Notify user instantly — withdrawal success
    await notifyUser({
        userId: transaction.userId._id,
        title: 'Withdrawal Successful ✅',
        message: `Your withdrawal of ₹${transaction.amount.toLocaleString('en-IN')} has been processed. UTR: ${utrNumber}`,
        type: 'withdrawal',
        data: { transactionId: transaction._id.toString(), amount: transaction.amount, status: 'approved', utrNumber },
    });


    return {
        transaction,
        message: `₹${transaction.amount} withdrawal approved for ${transaction.userId.fullName}`
    };
};

export const rejectWithdrawalService = async ({ transactionId, reason, adminId }) => {
    if (!transactionId || !reason) {
        throw new ApiError(400, 'Transaction ID and rejection reason are required');
    }

    const session = await mongoose.startSession();
    session.startTransaction({
        readPreference: 'primary',
        readConcern: { level: 'majority' },
        writeConcern: { w: 'majority' }
    });

    try {
        const transaction = await Transaction.findOne({
            _id: transactionId,
            category: 'withdrawal',
            status: 'pending'
        })
            .session(session)
            .read('primary');

        if (!transaction) {
            throw new ApiError(404, 'Pending withdrawal not found');
        }

        const user = await User.findById(transaction.userId).session(session).read('primary');

        if (!user) {
            throw new ApiError(404, 'User not found');
        }

        user.walletBalance += transaction.amount;
        await user.save({ session });

        transaction.status = 'rejected';
        transaction.withdrawalDetails.rejectionReason = reason;
        transaction.withdrawalDetails.processedAt = new Date();
        transaction.withdrawalDetails.processedBy = adminId;
        transaction.adminAction = {
            actionType: 'rejected',
            actionBy: adminId,
            actionAt: new Date(),
            reason
        };
        transaction.description = `Withdrawal rejected: ${reason}. Amount refunded.`;

        await transaction.save({ session });
        await session.commitTransaction();

        // ✅ NEW: Notify user instantly — withdrawal rejected + refund note
        await notifyUser({
            userId: transaction.userId,
            title: 'Withdrawal Rejected ❌',
            message: `Your withdrawal of ₹${transaction.amount.toLocaleString('en-IN')} was rejected. Reason: ${reason}. The amount has been refunded to your wallet.`,
            type: 'withdrawal',
            data: { transactionId: transaction._id.toString(), amount: transaction.amount, status: 'rejected', reason },
        });


        return {
            transaction,
            message: 'Withdrawal rejected and amount refunded to user wallet'
        };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

export const getAllTransactionsAdminService = async ({
    page = 1,
    limit = 50,
    status,
    category
}) => {
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;

    const pageNum = Number(page);
    const limitNum = Number(limit);

    const transactions = await Transaction.find(filter)
        .populate('userId', 'fullName phoneNumber')
        .sort({ createdAt: -1 })
        .limit(limitNum)
        .skip((pageNum - 1) * limitNum)
        .lean();

    const count = await Transaction.countDocuments(filter);

    return {
        transactions,
        totalPages: Math.ceil(count / limitNum),
        currentPage: pageNum,
        totalTransactions: count
    };
};

export const getWithdrawalStatsAdminService = async () => {
    const [completed, pending, rejected] = await Promise.all([
        Transaction.aggregate([
            { $match: { category: 'withdrawal', status: 'completed' } },
            { $group: { _id: null, totalAmount: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]),
        Transaction.aggregate([
            { $match: { category: 'withdrawal', status: 'pending' } },
            { $group: { _id: null, totalAmount: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]),
        Transaction.aggregate([
            { $match: { category: 'withdrawal', status: 'rejected' } },
            { $group: { _id: null, totalAmount: { $sum: '$amount' }, count: { $sum: 1 } } }
        ])
    ]);

    return {
        completed: {
            amount: completed[0]?.totalAmount || 0,
            count: completed[0]?.count || 0
        },
        pending: {
            amount: pending[0]?.totalAmount || 0,
            count: pending[0]?.count || 0
        },
        rejected: {
            amount: rejected[0]?.totalAmount || 0,
            count: rejected[0]?.count || 0
        },
        grandTotal: (completed[0]?.totalAmount || 0) + (pending[0]?.totalAmount || 0)
    };
};