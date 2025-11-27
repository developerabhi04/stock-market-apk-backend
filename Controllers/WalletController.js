import mongoose from 'mongoose';
import User from '../Models/UserModel.js';
import Transaction from '../Models/TransactionModel.js';
import { ApiError } from '../Utils/apiError.js';
import { ApiResponse } from '../Utils/apiResponse.js';
import { asyncHandler } from '../Utils/asyncHandler.js';

/**
 * Get Wallet Balance
 */
export const getWalletBalance = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.userId);

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    const totalBalance = user.walletBalance + user.bonusBalance;

    res.status(200).json(
        new ApiResponse(200, {
            balance: totalBalance,
            formattedBalance: `₹${totalBalance.toFixed(2)}`
        })
    );
});

/**
 * ✅ UPDATED: Add Money (Manual Payment - User submits UTR)
 * Status: pending → Admin will verify
 */
export const addMoney = asyncHandler(async (req, res) => {
    const { amount, paymentMethod, utrNumber, gateway, paymentScreenshot } = req.body;

    // Validation
    if (!amount || amount < 500) {
        throw new ApiError(400, 'Minimum add money amount is ₹500');
    }

    if (!utrNumber || utrNumber.length < 10) {
        throw new ApiError(400, 'Valid UTR/Transaction ID is required (minimum 10 characters)');
    }

    if (!gateway) {
        throw new ApiError(400, 'Payment gateway is required (PhonePe/GooglePay/Paytm)');
    }

    // Check for duplicate UTR
    const existingTransaction = await Transaction.findOne({
        'paymentDetails.utrNumber': utrNumber
    });

    if (existingTransaction) {
        throw new ApiError(409, 'This UTR number has already been used');
    }

    const user = await User.findById(req.user.userId);

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    const balanceBefore = user.walletBalance;
    const balanceAfter = balanceBefore; // ✅ No change until admin approves

    // ✅ Create PENDING transaction (waiting for admin approval)
    const transaction = await Transaction.create({
        userId: user._id,
        type: 'credit',
        category: 'add_money',
        amount,
        balanceBefore,
        balanceAfter,  // Same as before (not added yet)
        bonusBalanceBefore: user.bonusBalance,
        bonusBalanceAfter: user.bonusBalance,
        status: 'pending',  // ✅ Pending admin approval
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

    res.status(200).json(
        new ApiResponse(200, {
            transaction: {
                id: transaction._id,
                amount: transaction.amount,
                utrNumber: transaction.paymentDetails.utrNumber,
                status: transaction.status,
                createdAt: transaction.createdAt
            },
            message: 'Payment submitted successfully. Your wallet will be credited within 10-30 minutes after verification.'
        })
    );
});


/**
 * ✅ FIXED: Withdraw Money
 */
/**
 * ✅ UPDATED: Withdraw Money (Creates Pending Request)
 */
// export const withdrawMoney = asyncHandler(async (req, res) => {
//     const { amount, accountNumber, ifscCode, accountHolderName, bankName } = req.body;

//     // Validation
//     if (!amount || amount < 100) {
//         throw new ApiError(400, 'Minimum withdrawal amount is ₹100');
//     }

//     if (!accountNumber || !ifscCode || !accountHolderName || !bankName) {
//         throw new ApiError(400, 'All bank details are required');
//     }

//     const session = await mongoose.startSession();
//     session.startTransaction({
//         readPreference: 'primary',
//         readConcern: { level: 'majority' },
//         writeConcern: { w: 'majority' }
//     });

//     try {
//         const user = await User.findById(req.user.userId)
//             .session(session)
//             .read('primary');

//         if (!user) {
//             throw new ApiError(404, 'User not found');
//         }

//         // ✅ Check if user has enough withdrawable balance
//         if (user.walletBalance < amount) {
//             throw new ApiError(400,
//                 `Insufficient withdrawable balance. Available: ₹${user.walletBalance.toFixed(2)}`
//             );
//         }

//         const balanceBefore = user.walletBalance;
//         const balanceAfter = balanceBefore - amount;

//         // ✅ Deduct money immediately but mark as pending
//         user.walletBalance = balanceAfter;
//         await user.save({ session });

//         // ✅ Create pending withdrawal transaction
//         const transaction = await Transaction.create([{
//             userId: user._id,
//             type: 'debit',
//             category: 'withdrawal',
//             amount,
//             balanceBefore,
//             balanceAfter,
//             bonusBalanceBefore: user.bonusBalance,
//             bonusBalanceAfter: user.bonusBalance,
//             status: 'pending', // ✅ Pending admin approval
//             withdrawalDetails: {
//                 accountNumber,
//                 ifscCode,
//                 accountHolderName,
//                 bankName
//             },
//             description: 'Withdrawal request submitted - Awaiting admin approval',
//             adminAction: {
//                 actionType: 'pending'
//             }
//         }], { session });

//         await session.commitTransaction();

//         res.status(200).json(
//             new ApiResponse(200, {
//                 transaction: transaction[0],
//                 newBalance: balanceAfter + user.bonusBalance,
//                 message: 'Withdrawal request submitted successfully. Amount will be transferred within 1-3 business days after approval.'
//             })
//         );

//     } catch (error) {
//         await session.abortTransaction();
//         throw error;
//     } finally {
//         session.endSession();
//     }
// });


/**
 * Get Transaction History
 */
export const getTransactions = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, type, category } = req.query;

    const filter = { userId: req.user.userId };

    if (type) filter.type = type;
    if (category) filter.category = category;

    const transactions = await Transaction.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

    const count = await Transaction.countDocuments(filter);

    res.status(200).json(
        new ApiResponse(200, {
            transactions,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            totalTransactions: count
        })
    );
});


/**
 * ✅ UPDATED: Withdraw Money with Bank Account Selection
 */
export const withdrawMoney = asyncHandler(async (req, res) => {
    const { amount, accountNumber, ifscCode, accountHolderName, bankName } = req.body;

    // Validation
    if (!amount || amount < 100) {
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
        const user = await User.findById(req.user.userId)
            .session(session)
            .read('primary');

        if (!user) {
            throw new ApiError(404, 'User not found');
        }

        // ✅ Verify that the bank account exists in user's accounts
        const bankAccountExists = user.bankAccounts.some(
            account => account.accountNumber === accountNumber
        );

        if (!bankAccountExists && user.bankAccounts.length > 0) {
            throw new ApiError(400, 'Please select a registered bank account');
        }

        // Check if user has enough withdrawable balance
        if (user.walletBalance < amount) {
            throw new ApiError(400,
                `Insufficient withdrawable balance. Available: ₹${user.walletBalance.toFixed(2)} (Bonus: ₹${user.bonusBalance.toFixed(2)} cannot be withdrawn)`
            );
        }

        const balanceBefore = user.walletBalance;
        const balanceAfter = balanceBefore - amount;

        // Deduct money immediately but mark as pending
        user.walletBalance = balanceAfter;
        await user.save({ session });

        // Create pending withdrawal transaction
        const transaction = await Transaction.create([{
            userId: user._id,
            type: 'debit',
            category: 'withdrawal',
            amount,
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
        }], { session });

        await session.commitTransaction();

        console.log('✅ Withdrawal request created:', transaction[0]._id);

        res.status(200).json(
            new ApiResponse(200, {
                transaction: transaction[0],
                newWalletBalance: balanceAfter,
                newTotalBalance: balanceAfter + user.bonusBalance,
                message: 'Withdrawal request submitted successfully. Amount will be transferred within 1-3 business days after approval.'
            })
        );

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
});

