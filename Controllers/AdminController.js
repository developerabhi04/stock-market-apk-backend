import mongoose from 'mongoose';
import User from '../Models/UserModel.js';
import Transaction from '../Models/TransactionModel.js';
import Admin from '../Models/AdminModel.js';
import { generateToken } from '../Utils/JwtService.js';
import { ApiError } from '../Utils/apiError.js';
import { ApiResponse } from '../Utils/apiResponse.js';
import { asyncHandler } from '../Utils/asyncHandler.js';



/**
 * ✅ Admin Login
 */
export const adminLogin = asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
        throw new ApiError(400, 'Username and password are required');
    }

    // Find admin with password field
    const admin = await Admin.findOne({ username, isActive: true }).select('+password');

    if (!admin) {
        throw new ApiError(401, 'Invalid username or password');
    }

    // Verify password
    const isPasswordValid = await admin.comparePassword(password);

    if (!isPasswordValid) {
        throw new ApiError(401, 'Invalid username or password');
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Generate JWT token with admin flag
    const token = generateToken({
        adminId: admin._id,
        username: admin.username,
        role: admin.role,
        isAdmin: true  // ✅ Admin flag
    });

    res.status(200).json(
        new ApiResponse(200, {
            admin: {
                id: admin._id,
                username: admin.username,
                fullName: admin.fullName,
                email: admin.email,
                role: admin.role,
                permissions: admin.permissions
            },
            token
        }, 'Login successful')
    );
});



/**
 * ✅ Create First Admin (Run once to create super admin)
 */
export const createFirstAdmin = asyncHandler(async (req, res) => {
    // Check if any admin exists
    const adminCount = await Admin.countDocuments();

    if (adminCount > 0) {
        throw new ApiError(403, 'Admin already exists. Use login instead.');
    }

    const { username, email, password, fullName } = req.body;

    if (!username || !email || !password || !fullName) {
        throw new ApiError(400, 'All fields are required');
    }

    // Create super admin
    const admin = await Admin.create({
        username,
        email,
        password,
        fullName,
        role: 'super_admin',
        permissions: {
            canApprovePayments: true,
            canRejectPayments: true,
            canViewUsers: true,
            canManageAdmins: true
        }
    });

    const token = generateToken({
        adminId: admin._id,
        username: admin.username,
        role: admin.role,
        isAdmin: true
    });

    res.status(201).json(
        new ApiResponse(201, {
            admin: {
                id: admin._id,
                username: admin.username,
                fullName: admin.fullName,
                email: admin.email,
                role: admin.role
            },
            token
        }, 'Super admin created successfully')
    );
});



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



/**
 * Get Dashboard Stats
 */
export const getDashboardStats = asyncHandler(async (req, res) => {
    const totalUsers = await User.countDocuments({ isActive: true });
    const pendingPayments = await Transaction.countDocuments({
        category: 'add_money',
        status: 'pending'
    });
    const pendingWithdrawals = await Transaction.countDocuments({
        category: 'withdrawal',
        status: 'pending'
    });

    const todayTransactions = await Transaction.aggregate([
        {
            $match: {
                createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
            }
        },
        {
            $group: {
                _id: '$category',
                count: { $sum: 1 },
                totalAmount: { $sum: '$amount' }
            }
        }
    ]);

    res.status(200).json(
        new ApiResponse(200, {
            totalUsers,
            pendingPayments,
            pendingWithdrawals,
            todayTransactions
        })
    );
});



/**
 * Get All Transactions
 */
export const getAllTransactions = asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, status, category } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;

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
            totalTransactions: count
        })
    );
});




/**
 * ✅ Get All Users with Wallet Balances
 */
export const getAllUsers = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, search = '', sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    // Build search filter
    const filter = { isActive: true };
    if (search) {
        filter.$or = [
            { fullName: { $regex: search, $options: 'i' } },
            { phoneNumber: { $regex: search, $options: 'i' } }
        ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const users = await User.find(filter)
        .select('fullName phoneNumber walletBalance bonusBalance kycStatus isVerified createdAt lastLogin')
        .sort(sort)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

    const count = await User.countDocuments(filter);

    // Calculate totals
    const totalWalletBalance = users.reduce((sum, user) => sum + (user.walletBalance || 0), 0);
    const totalBonusBalance = users.reduce((sum, user) => sum + (user.bonusBalance || 0), 0);

    // Add combined balance to each user
    const usersWithTotalBalance = users.map(user => ({
        ...user,
        totalBalance: (user.walletBalance || 0) + (user.bonusBalance || 0)
    }));

    res.status(200).json(
        new ApiResponse(200, {
            users: usersWithTotalBalance,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page),
            totalUsers: count,
            totalWalletBalance,
            totalBonusBalance,
            grandTotal: totalWalletBalance + totalBonusBalance
        })
    );
});

/**
 * ✅ Get Single User Details
 */
export const getUserDetails = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const user = await User.findById(userId)
        .select('-__v')
        .lean();

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    // Get user's transaction summary
    const transactionStats = await Transaction.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        {
            $group: {
                _id: '$category',
                count: { $sum: 1 },
                totalAmount: { $sum: '$amount' }
            }
        }
    ]);

    // Get recent transactions
    const recentTransactions = await Transaction.find({ userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

    res.status(200).json(
        new ApiResponse(200, {
            user: {
                ...user,
                totalBalance: (user.walletBalance || 0) + (user.bonusBalance || 0)
            },
            transactionStats,
            recentTransactions
        })
    );
});

/**
 * ✅ Update User Wallet Balance (Manual Adjustment)
 */
export const updateUserBalance = asyncHandler(async (req, res) => {
    const { userId, amount, type, reason } = req.body;

    if (!userId || !amount || !type || !reason) {
        throw new ApiError(400, 'All fields are required');
    }

    if (amount <= 0) {
        throw new ApiError(400, 'Amount must be greater than 0');
    }

    if (!['add', 'deduct'].includes(type)) {
        throw new ApiError(400, 'Type must be add or deduct');
    }

    const session = await mongoose.startSession();
    session.startTransaction({
        readPreference: 'primary',
        readConcern: { level: 'majority' },
        writeConcern: { w: 'majority' }
    });

    try {
        const user = await User.findById(userId)
            .session(session)
            .read('primary');

        if (!user) {
            throw new ApiError(404, 'User not found');
        }

        const balanceBefore = user.walletBalance;
        let balanceAfter;

        if (type === 'add') {
            balanceAfter = balanceBefore + amount;
        } else {
            if (balanceBefore < amount) {
                throw new ApiError(400, 'Insufficient balance for deduction');
            }
            balanceAfter = balanceBefore - amount;
        }

        user.walletBalance = balanceAfter;
        await user.save({ session });

        // Create transaction record
        await Transaction.create([{
            userId: user._id,
            type: type === 'add' ? 'credit' : 'debit',
            category: 'refund', // or create new category 'admin_adjustment'
            amount,
            balanceBefore,
            balanceAfter,
            bonusBalanceBefore: user.bonusBalance,
            bonusBalanceAfter: user.bonusBalance,
            status: 'completed',
            description: `Manual balance ${type} by admin: ${reason}`,
            adminAction: {
                actionType: 'approved',
                actionBy: req.admin.adminId,
                actionAt: new Date(),
                reason
            }
        }], { session });

        await session.commitTransaction();

        res.status(200).json(
            new ApiResponse(200, {
                user: {
                    id: user._id,
                    fullName: user.fullName,
                    phoneNumber: user.phoneNumber,
                    newWalletBalance: balanceAfter,
                    newTotalBalance: balanceAfter + user.bonusBalance
                },
                message: `Balance ${type}ed successfully`
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
 * ✅ Get User Statistics
 */
export const getUserStats = asyncHandler(async (req, res) => {
    const totalUsers = await User.countDocuments({ isActive: true });
    const verifiedUsers = await User.countDocuments({ isActive: true, isVerified: true });
    const kycPendingUsers = await User.countDocuments({ kycStatus: 'pending' });

    const walletStats = await User.aggregate([
        { $match: { isActive: true } },
        {
            $group: {
                _id: null,
                totalWalletBalance: { $sum: '$walletBalance' },
                totalBonusBalance: { $sum: '$bonusBalance' },
                avgWalletBalance: { $avg: '$walletBalance' }
            }
        }
    ]);

    const stats = walletStats[0] || {
        totalWalletBalance: 0,
        totalBonusBalance: 0,
        avgWalletBalance: 0
    };

    res.status(200).json(
        new ApiResponse(200, {
            totalUsers,
            verifiedUsers,
            kycPendingUsers,
            totalWalletBalance: stats.totalWalletBalance,
            totalBonusBalance: stats.totalBonusBalance,
            grandTotal: stats.totalWalletBalance + stats.totalBonusBalance,
            avgWalletBalance: stats.avgWalletBalance
        })
    );
});



/**
 * ✅ Get Withdrawal Statistics
 */
export const getWithdrawalStats = asyncHandler(async (req, res) => {
    // Get completed withdrawals stats
    const completedWithdrawals = await Transaction.aggregate([
        {
            $match: {
                category: 'withdrawal',
                status: 'completed'
            }
        },
        {
            $group: {
                _id: null,
                totalWithdrawals: { $sum: '$amount' },
                totalCount: { $sum: 1 }
            }
        }
    ]);

    // Get pending withdrawals stats
    const pendingWithdrawals = await Transaction.aggregate([
        {
            $match: {
                category: 'withdrawal',
                status: 'pending'
            }
        },
        {
            $group: {
                _id: null,
                pendingAmount: { $sum: '$amount' },
                pendingCount: { $sum: 1 }
            }
        }
    ]);

    // Get rejected withdrawals stats
    const rejectedWithdrawals = await Transaction.aggregate([
        {
            $match: {
                category: 'withdrawal',
                status: 'rejected'
            }
        },
        {
            $group: {
                _id: null,
                rejectedAmount: { $sum: '$amount' },
                rejectedCount: { $sum: 1 }
            }
        }
    ]);

    const completedStats = completedWithdrawals[0] || {
        totalWithdrawals: 0,
        totalCount: 0
    };

    const pendingStats = pendingWithdrawals[0] || {
        pendingAmount: 0,
        pendingCount: 0
    };

    const rejectedStats = rejectedWithdrawals[0] || {
        rejectedAmount: 0,
        rejectedCount: 0
    };

    res.status(200).json(
        new ApiResponse(200, {
            totalWithdrawals: completedStats.totalWithdrawals,
            totalCount: completedStats.totalCount,
            pendingAmount: pendingStats.pendingAmount,
            pendingCount: pendingStats.pendingCount,
            rejectedAmount: rejectedStats.rejectedAmount,
            rejectedCount: rejectedStats.rejectedCount,
            grandTotal: completedStats.totalWithdrawals + pendingStats.pendingAmount
        }, 'Withdrawal statistics fetched successfully')
    );
});

