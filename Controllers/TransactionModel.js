import mongoose from 'mongoose';
import User from '../Models/UserModel.js';
import Transaction from '../Models/TransactionModel.js';
import { ApiError } from '../Utils/apiError.js';
import { ApiResponse } from '../Utils/apiResponse.js';
import { asyncHandler } from '../Utils/asyncHandler.js';



/**
 * Get All Pending Add Money Requests
 */
export const getPendingPayments = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;

    const filter = {
        category: 'add_money',
        status: 'pending'
    };

    const transactions = await Transaction.find(filter)
        .populate('userId', 'fullName phoneNumber')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

    const count = await Transaction.countDocuments(filter);

    res.status(200).json(
        new ApiResponse(200, {
            transactions,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page),
            totalPending: count
        })
    );
});

/**
 * ✅ Get All Pending Withdrawals
 */
export const getPendingWithdrawals = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;

    const filter = {
        category: 'withdrawal',
        status: 'pending'
    };

    const withdrawals = await Transaction.find(filter)
        .populate('userId', 'fullName phoneNumber walletBalance bonusBalance')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

    const count = await Transaction.countDocuments(filter);

    res.status(200).json(
        new ApiResponse(200, {
            withdrawals,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page),
            totalPending: count
        })
    );
});

/**
 * ✅ Approve Withdrawal Request
 */
export const approveWithdrawal = asyncHandler(async (req, res) => {
    const { transactionId, utrNumber, verificationNote } = req.body;

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

    // ✅ Mark as completed
    transaction.status = 'completed';
    transaction.withdrawalDetails.utrNumber = utrNumber;
    transaction.withdrawalDetails.processedAt = new Date();
    transaction.withdrawalDetails.processedBy = req.admin.adminId;
    transaction.adminAction = {
        actionType: 'approved',
        actionBy: req.admin.adminId,
        actionAt: new Date(),
        reason: verificationNote || 'Withdrawal approved and processed'
    };
    transaction.description = `Withdrawal completed - UTR: ${utrNumber}`;

    await transaction.save();

    res.status(200).json(
        new ApiResponse(200, {
            transaction,
            message: `₹${transaction.amount} withdrawal approved for ${transaction.userId.fullName}`
        })
    );
});

/**
 * ✅ Reject Withdrawal Request
 */
export const rejectWithdrawal = asyncHandler(async (req, res) => {
    const { transactionId, reason } = req.body;

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
        }).session(session).read('primary');

        if (!transaction) {
            throw new ApiError(404, 'Pending withdrawal not found');
        }

        // ✅ Refund money to user
        const user = await User.findById(transaction.userId)
            .session(session)
            .read('primary');

        if (!user) {
            throw new ApiError(404, 'User not found');
        }

        user.walletBalance += transaction.amount; // Refund
        await user.save({ session });

        // ✅ Mark transaction as rejected
        transaction.status = 'rejected';
        transaction.withdrawalDetails.rejectionReason = reason;
        transaction.withdrawalDetails.processedAt = new Date();
        transaction.withdrawalDetails.processedBy = req.admin.adminId;
        transaction.adminAction = {
            actionType: 'rejected',
            actionBy: req.admin.adminId,
            actionAt: new Date(),
            reason
        };
        transaction.description = `Withdrawal rejected: ${reason}. Amount refunded.`;

        await transaction.save({ session });

        await session.commitTransaction();

        res.status(200).json(
            new ApiResponse(200, {
                transaction,
                message: 'Withdrawal rejected and amount refunded to user wallet'
            })
        );

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
});




/**
 * ✅ Approve Add Money Request
 */
export const approvePayment = asyncHandler(async (req, res) => {
    const { transactionId, verificationNote } = req.body;

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
        }).session(session).read('primary');

        if (!transaction) {
            throw new ApiError(404, 'Pending transaction not found');
        }

        const user = await User.findById(transaction.userId)
            .session(session)
            .read('primary');

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
        transaction.paymentDetails.verifiedBy = req.admin.adminId;
        transaction.adminAction = {
            actionType: 'approved',
            actionBy: req.admin.adminId,
            actionAt: new Date(),
            reason: verificationNote
        };
        transaction.description = `Wallet credited via ${transaction.paymentDetails.gateway}. Verified by admin.`;

        await transaction.save({ session });

        await session.commitTransaction();

        res.status(200).json(
            new ApiResponse(200, {
                transaction,
                newBalance: balanceAfter + user.bonusBalance,
                message: `₹${transaction.amount} has been added to user's wallet`
            })
        );

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
});



/**
 * ✅ Reject Add Money Request
 */
export const rejectPayment = asyncHandler(async (req, res) => {
    const { transactionId, reason } = req.body;

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
        actionBy: req.admin.adminId,
        actionAt: new Date(),
        reason
    };
    transaction.description = `Payment rejected: ${reason}`;

    await transaction.save();

    res.status(200).json(
        new ApiResponse(200, {
            transaction,
            message: 'Payment request rejected'
        })
    );
});