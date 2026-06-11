import mongoose from 'mongoose';
import User from '../user/user.model.js';
import Transaction from '../transaction/transaction.model.js';
import { ApiError } from '../../shared/utils/apiError.js';

export const getWalletBalanceService = async ({ userId }) => {
    const user = await User.findById(userId).select('walletBalance bonusBalance').lean();

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    const totalBalance = user.walletBalance + user.bonusBalance;

    return {
        walletBalance: user.walletBalance,
        bonusBalance: user.bonusBalance,
        balance: totalBalance,
        formattedBalance: `₹${totalBalance.toFixed(2)}`
    };
};

export const addMoneyService = async ({
    userId,
    amount,
    paymentMethod,
    utrNumber,
    gateway,
    paymentScreenshot
}) => {
    if (!amount || Number(amount) < 500) {
        throw new ApiError(400, 'Minimum add money amount is ₹500');
    }

    if (!utrNumber || String(utrNumber).length < 10) {
        throw new ApiError(400, 'Valid UTR/Transaction ID is required (minimum 10 characters)');
    }

    if (!gateway) {
        throw new ApiError(400, 'Payment gateway is required (PhonePe/GooglePay/Paytm)');
    }

    const existingTransaction = await Transaction.findOne({
        'paymentDetails.utrNumber': utrNumber
    });

    if (existingTransaction) {
        throw new ApiError(409, 'This UTR number has already been used');
    }

    const user = await User.findById(userId).select('walletBalance bonusBalance');

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    const balanceBefore = user.walletBalance;

    const transaction = await Transaction.create({
        userId: user._id,
        type: 'credit',
        category: 'add_money',
        amount: Number(amount),
        balanceBefore,
        balanceAfter: balanceBefore, // unchanged until admin approves
        bonusBalanceBefore: user.bonusBalance,
        bonusBalanceAfter: user.bonusBalance,
        status: 'pending',
        paymentDetails: {
            method: paymentMethod || 'UPI',
            utrNumber,
            gateway,
            paymentScreenshot: paymentScreenshot || null
        },
        description: `Payment submitted via ${gateway}. Waiting for admin verification.`,
        adminAction: {
            actionType: 'pending'
        }
    });

    return {
        transaction: {
            id: transaction._id,
            amount: transaction.amount,
            utrNumber: transaction.paymentDetails.utrNumber,
            status: transaction.status,
            createdAt: transaction.createdAt
        },
        message:
            'Payment submitted successfully. Your wallet will be credited within 10-30 minutes after verification.'
    };
};

export const withdrawMoneyService = async ({
    userId,
    amount,
    accountNumber,
    ifscCode,
    accountHolderName,
    bankName
}) => {
    if (!amount || Number(amount) < 100) {
        throw new ApiError(400, 'Minimum withdrawal amount is ₹100');
    }

    if (!accountNumber || !ifscCode || !accountHolderName || !bankName) {
        throw new ApiError(400, 'All bank details are required');
    }

    const session = await mongoose.startSession();
    session.startTransaction({
        readPreference: 'primary',
        readConcern: { level: 'majority' },
        writeConcern: { w: 'majority' }
    });

    try {
        const user = await User.findById(userId).session(session).read('primary');

        if (!user) {
            throw new ApiError(404, 'User not found');
        }

        // Verify bank account belongs to this user (if they have registered accounts)
        if (user.bankAccounts && user.bankAccounts.length > 0) {
            const bankAccountExists = user.bankAccounts.some(
                (account) => account.accountNumber === accountNumber
            );

            if (!bankAccountExists) {
                throw new ApiError(400, 'Please select a registered bank account');
            }
        }

        if (user.walletBalance < Number(amount)) {
            throw new ApiError(
                400,
                `Insufficient withdrawable balance. Available: ₹${user.walletBalance.toFixed(2)} (Bonus: ₹${user.bonusBalance.toFixed(2)} cannot be withdrawn)`
            );
        }

        const balanceBefore = user.walletBalance;
        const balanceAfter = balanceBefore - Number(amount);

        user.walletBalance = balanceAfter;
        await user.save({ session });

        const [transaction] = await Transaction.create(
            [
                {
                    userId: user._id,
                    type: 'debit',
                    category: 'withdrawal',
                    amount: Number(amount),
                    balanceBefore,
                    balanceAfter,
                    bonusBalanceBefore: user.bonusBalance,
                    bonusBalanceAfter: user.bonusBalance,
                    status: 'pending',
                    withdrawalDetails: {
                        accountNumber,
                        ifscCode: ifscCode.toUpperCase(),
                        accountHolderName,
                        bankName
                    },
                    description: `Withdrawal to ${bankName} (${accountNumber.slice(-4)}) - Awaiting admin approval`,
                    adminAction: {
                        actionType: 'pending'
                    }
                }
            ],
            { session }
        );

        await session.commitTransaction();

        return {
            transaction,
            newWalletBalance: balanceAfter,
            newTotalBalance: balanceAfter + user.bonusBalance,
            message:
                'Withdrawal request submitted successfully. Amount will be transferred within 1-3 business days after approval.'
        };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

export const getTransactionsService = async ({ userId, page = 1, limit = 20, type, category }) => {
    const filter = { userId };

    if (type) filter.type = type;
    if (category) filter.category = category;

    const pageNum = Number(page);
    const limitNum = Number(limit);

    const transactions = await Transaction.find(filter)
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
