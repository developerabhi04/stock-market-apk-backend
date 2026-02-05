import mongoose from 'mongoose';
import User from '../Models/UserModel.js';
import Transaction from '../Models/TransactionModel.js';
import Admin from '../Models/AdminModel.js';
import Stock from '../Models/StockModel.js';
import Index from '../Models/IndexModel.js';
import PriceHistory from '../Models/PriceHistoryModel.js';
import DailyHistory from '../Models/DailyHistoryModel.js';
import { generateToken } from '../Utils/JwtService.js';
import { ApiError } from '../Utils/apiError.js';
import { ApiResponse } from '../Utils/apiResponse.js';
import { asyncHandler } from '../Utils/asyncHandler.js';



/**
 * ✅ SIMPLIFIED: Create Admin (Super Admin Only)
 * All created admins have role 'admin' with custom navigation permissions
 */
export const createAdmin = asyncHandler(async (req, res) => {
    const { username, email, password, fullName, allowedRoutes } = req.body;

    console.log('🔵 Creating admin with data:', { username, email, fullName, allowedRoutes });

    // Validation
    if (!username || !email || !password || !fullName) {
        throw new ApiError(400, 'Username, email, password, and full name are required');
    }

    if (username.length < 3) {
        throw new ApiError(400, 'Username must be at least 3 characters');
    }

    if (password.length < 6) {
        throw new ApiError(400, 'Password must be at least 6 characters');
    }

    // Email validation
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
        throw new ApiError(400, 'Please enter a valid email');
    }

    // Check if username already exists
    const existingUsername = await Admin.findOne({ username: username.toLowerCase() });
    if (existingUsername) {
        throw new ApiError(400, 'Username already exists');
    }

    // Check if email already exists
    const existingEmail = await Admin.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
        throw new ApiError(400, 'Email already exists');
    }

    // ✅ Validate allowedRoutes
    if (!allowedRoutes || allowedRoutes.length === 0) {
        throw new ApiError(400, 'Please select at least one navigation item');
    }

    // ✅ All created admins have 'admin' role with custom permissions
    const adminPermissions = {
        canApprovePayments: true,
        canRejectPayments: true,
        canViewUsers: true,
        canManageAdmins: false
    };

    // Create admin
    const admin = await Admin.create({
        username: username.toLowerCase(),
        password,
        fullName,
        email: email.toLowerCase(),
        role: 'admin',  // ✅ Always 'admin' role
        permissions: adminPermissions,
        allowedRoutes: allowedRoutes,
        createdBy: req.admin.adminId
    });

    console.log('✅ Admin created successfully:', admin._id);

    res.status(201).json(
        new ApiResponse(201, {
            admin: {
                id: admin._id,
                username: admin.username,
                fullName: admin.fullName,
                email: admin.email,
                role: admin.role,
                permissions: admin.permissions,
                allowedRoutes: admin.allowedRoutes
            }
        }, 'Admin created successfully')
    );
});

/**
 * ✅ Delete Admin (Super Admin Only)
 * Cannot delete super_admin
 */
export const deleteAdmin = asyncHandler(async (req, res) => {
    const { adminId } = req.params;

    const admin = await Admin.findById(adminId);
    if (!admin) {
        throw new ApiError(404, 'Admin not found');
    }

    // ✅ Prevent deleting super admin
    if (admin.role === 'super_admin') {
        throw new ApiError(403, 'Cannot delete super admin');
    }

    // Prevent self-deletion
    if (adminId === req.admin.adminId.toString()) {
        throw new ApiError(403, 'Cannot delete your own account');
    }

    await Admin.findByIdAndDelete(adminId);

    res.status(200).json(
        new ApiResponse(200, null, 'Admin deleted successfully')
    );
});

/**
 * ✅ Admin Login - Include allowedRoutes
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

    // Generate JWT token
    const token = generateToken({
        adminId: admin._id,
        username: admin.username,
        role: admin.role,
        isAdmin: true
    });

    res.status(200).json(
        new ApiResponse(200, {
            admin: {
                id: admin._id,
                username: admin.username,
                fullName: admin.fullName,
                email: admin.email,
                role: admin.role,
                permissions: admin.permissions,
                allowedRoutes: admin.allowedRoutes || []
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
 * ✅ ENHANCED: Get All Admins (Super Admin Only)
 */
export const getAllAdmins = asyncHandler(async (req, res) => {
    const admins = await Admin.find()
        .select('-password') // Exclude password
        .populate('createdBy', 'username fullName')
        .sort({ createdAt: -1 })
        .lean();

    res.status(200).json(
        new ApiResponse(200, { admins }, 'Admins fetched successfully')
    );
});




/**
 * ✅ NEW: Get Admin Activity Log (Optional - if you create AdminActivity model)
 */
export const getAdminActivity = asyncHandler(async (req, res) => {
    const { adminId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // For now, return empty array (implement AdminActivity model if needed)
    // You can track login history, approval/rejection actions, etc.

    res.status(200).json(
        new ApiResponse(200, {
            activities: [],
            totalPages: 0,
            currentPage: 1,
            total: 0,
            message: 'Activity tracking coming soon'
        })
    );
});



/**
 * ✅ UPDATED: Update Admin Role (Super Admin Only)
 */
export const updateAdminRole = asyncHandler(async (req, res) => {
    const { adminId } = req.params;
    const { role } = req.body;

    // ✅ Updated valid roles
    if (!['super_admin', 'admin', 'moderator'].includes(role)) {
        throw new ApiError(400, 'Invalid role');
    }

    const admin = await Admin.findById(adminId);
    if (!admin) {
        throw new ApiError(404, 'Admin not found');
    }

    const oldRole = admin.role;
    admin.role = role;

    // ✅ Update permissions based on new role
    switch (role) {
        case 'super_admin':
            admin.permissions = {
                canApprovePayments: true,
                canRejectPayments: true,
                canViewUsers: true,
                canManageAdmins: true
            };
            admin.allowedRoutes = []; // Full access
            break;
        case 'admin':
            admin.permissions = {
                canApprovePayments: true,
                canRejectPayments: true,
                canViewUsers: true,
                canManageAdmins: false
            };
            break;
        case 'moderator':
            admin.permissions = {
                canApprovePayments: true,
                canRejectPayments: true,
                canViewUsers: false,
                canManageAdmins: false
            };
            break;
    }

    await admin.save();

    const adminData = admin.toObject();
    delete adminData.password;

    res.status(200).json(
        new ApiResponse(200, { admin: adminData }, `Admin role updated from ${oldRole} to ${role}`)
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




// ==================== MARKET DATA MANAGEMENT ====================

/**
 * ✅ Get Market Dashboard Stats
 */
export const getMarketDashboardStats = asyncHandler(async (req, res) => {
    // Count all market entities
    const totalIndices = await Index.countDocuments({ isActive: true });
    const totalStocks = await Stock.countDocuments({ isActive: true });
    const featuredIndices = await Index.countDocuments({ isFeatured: true, isActive: true });
    const featuredStocks = await Stock.countDocuments({ isFeatured: true, isActive: true });

    // Count price histories
    const totalPriceHistories = await PriceHistory.countDocuments();
    const totalDailyHistories = await DailyHistory.countDocuments();

    // Get category breakdown for stocks
    const stockCategories = await Stock.aggregate([
        { $match: { isActive: true } },
        {
            $group: {
                _id: '$category',
                count: { $sum: 1 }
            }
        }
    ]);

    // Get category breakdown for indices
    const indexCategories = await Index.aggregate([
        { $match: { isActive: true } },
        {
            $group: {
                _id: '$category',
                count: { $sum: 1 }
            }
        }
    ]);

    res.status(200).json(
        new ApiResponse(200, {
            market: {
                totalIndices,
                totalStocks,
                featuredIndices,
                featuredStocks,
                totalPriceHistories,
                totalDailyHistories
            },
            breakdown: {
                stocks: stockCategories,
                indices: indexCategories
            }
        })
    );
});

/**
 * ✅ Get All Indices (Admin)
 */
export const getAllIndicesAdmin = asyncHandler(async (req, res) => {
    const { category, featured, active, page = 1, limit = 50 } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (featured !== undefined) filter.isFeatured = featured === 'true';
    if (active !== undefined) filter.isActive = active === 'true';

    const indices = await Index.find(filter)
        .sort({ isFeatured: -1, currentValue: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

    const count = await Index.countDocuments(filter);

    res.status(200).json(
        new ApiResponse(200, {
            indices,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page),
            total: count
        })
    );
});

/**
 * ✅ Create Index (Admin)
 */
export const createIndex = asyncHandler(async (req, res) => {
    const {
        name,
        symbol,
        category,
        currentValue,
        openValue,
        highValue,
        lowValue,
        previousClose,
        icon,
        isFeatured,
        marketCap,
        volume,
        description
    } = req.body;

    // Validation
    if (!name || !symbol || !category || !currentValue || !openValue || !highValue || !lowValue || !previousClose) {
        throw new ApiError(400, 'All required fields must be provided');
    }

    // Check if index already exists
    const existingIndex = await Index.findOne({ symbol: symbol.toUpperCase() });
    if (existingIndex) {
        throw new ApiError(409, 'Index with this symbol already exists');
    }

    // Calculate change
    const change = currentValue - previousClose;
    const changePercent = ((change / previousClose) * 100).toFixed(2);

    const index = await Index.create({
        name: name.trim(),
        symbol: symbol.toUpperCase().trim(),
        category,
        currentValue,
        openValue,
        highValue,
        lowValue,
        previousClose,
        change,
        changePercent,
        icon: icon || 'chart-line',
        isFeatured: isFeatured || false,
        marketCap,
        volume,
        description,
        isActive: true
    });

    res.status(201).json(
        new ApiResponse(201, { index }, 'Index created successfully')
    );
});

/**
 * ✅ Update Index (Admin)
 */
export const updateIndex = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    const index = await Index.findById(id);

    if (!index) {
        throw new ApiError(404, 'Index not found');
    }

    // If currentValue is being updated, recalculate change
    if (updateData.currentValue) {
        updateData.change = updateData.currentValue - (updateData.previousClose || index.previousClose);
        updateData.changePercent = ((updateData.change / (updateData.previousClose || index.previousClose)) * 100).toFixed(2);
        updateData.lastUpdated = new Date();
    }

    Object.assign(index, updateData);
    await index.save();

    res.status(200).json(
        new ApiResponse(200, { index }, 'Index updated successfully')
    );
});

/**
 * ✅ Delete Index (Admin)
 */
export const deleteIndex = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const index = await Index.findByIdAndDelete(id);

    if (!index) {
        throw new ApiError(404, 'Index not found');
    }

    // Also delete related price histories
    await PriceHistory.deleteMany({ ticker: index.symbol, type: 'Index' });
    await DailyHistory.deleteMany({ ticker: index.symbol });

    res.status(200).json(
        new ApiResponse(200, null, 'Index and related data deleted successfully')
    );
});

/**
 * ✅ Get All Stocks (Admin)
 */
export const getAllStocksAdmin = asyncHandler(async (req, res) => {
    const { category, featured, active, sector, page = 1, limit = 50 } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (featured !== undefined) filter.isFeatured = featured === 'true';
    if (active !== undefined) filter.isActive = active === 'true';
    if (sector) filter.sector = sector;

    const stocks = await Stock.find(filter)
        .sort({ isFeatured: -1, price: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

    const count = await Stock.countDocuments(filter);

    res.status(200).json(
        new ApiResponse(200, {
            stocks,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page),
            total: count
        })
    );
});

/**
 * ✅ Create Stock (Admin)
 */
export const createStock = asyncHandler(async (req, res) => {
    const {
        name,
        ticker,
        symbol,
        price,
        openPrice,
        highPrice,
        lowPrice,
        previousClose,
        volume,
        marketCap,
        sector,
        category,
        isFeatured,
        icon,
        description
    } = req.body;

    // Validation
    if (!name || !ticker || !symbol || !price || !openPrice || !highPrice || !lowPrice || !previousClose) {
        throw new ApiError(400, 'All required fields must be provided');
    }

    // Check if stock already exists
    const existingStock = await Stock.findOne({ ticker: ticker.toUpperCase() });
    if (existingStock) {
        throw new ApiError(409, 'Stock with this ticker already exists');
    }

    // Calculate change
    const change = price - previousClose;
    const changePercent = ((change / previousClose) * 100).toFixed(2);

    const stock = await Stock.create({
        name: name.trim(),
        ticker: ticker.toUpperCase().trim(),
        symbol: symbol.toUpperCase().trim(),
        price,
        openPrice,
        highPrice,
        lowPrice,
        previousClose,
        change,
        changePercent,
        volume: volume || 0,
        marketCap,
        sector,
        category: category || 'Stock',
        isFeatured: isFeatured || false,
        icon: icon || 'chart-line',
        description,
        isActive: true
    });

    res.status(201).json(
        new ApiResponse(201, { stock }, 'Stock created successfully')
    );
});

/**
 * ✅ Update Stock (Admin)
 */
export const updateStock = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    const stock = await Stock.findById(id);

    if (!stock) {
        throw new ApiError(404, 'Stock not found');
    }

    // If price is being updated, recalculate change
    if (updateData.price) {
        updateData.change = updateData.price - (updateData.previousClose || stock.previousClose);
        updateData.changePercent = ((updateData.change / (updateData.previousClose || stock.previousClose)) * 100).toFixed(2);
        updateData.lastUpdated = new Date();
    }

    Object.assign(stock, updateData);
    await stock.save();

    res.status(200).json(
        new ApiResponse(200, { stock }, 'Stock updated successfully')
    );
});

/**
 * ✅ Delete Stock (Admin)
 */
export const deleteStock = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const stock = await Stock.findByIdAndDelete(id);

    if (!stock) {
        throw new ApiError(404, 'Stock not found');
    }

    // Also delete related price histories
    await PriceHistory.deleteMany({ ticker: stock.ticker, type: 'Stock' });
    await DailyHistory.deleteMany({ ticker: stock.ticker });

    res.status(200).json(
        new ApiResponse(200, null, 'Stock and related data deleted successfully')
    );
});

/**
 * ✅ Bulk Update Prices (Admin)
 */
export const bulkUpdatePrices = asyncHandler(async (req, res) => {
    const { updates, type = 'Stock' } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
        throw new ApiError(400, 'Updates array is required');
    }

    const results = [];
    const Model = type === 'Index' ? Index : Stock;
    const identifierField = type === 'Index' ? 'symbol' : 'ticker';

    for (const update of updates) {
        try {
            const identifier = update[identifierField];
            const entity = await Model.findOne({ [identifierField]: identifier.toUpperCase() });

            if (entity) {
                const newPrice = type === 'Index' ? update.currentValue : update.price;

                if (type === 'Index') {
                    await entity.updatePrice(newPrice);
                } else {
                    await entity.updatePrice(newPrice);
                }

                results.push({ [identifierField]: identifier, success: true });
            } else {
                results.push({ [identifierField]: identifier, success: false, message: 'Not found' });
            }
        } catch (error) {
            results.push({ [identifierField]: update[identifierField], success: false, message: error.message });
        }
    }

    res.status(200).json(
        new ApiResponse(200, { results }, 'Bulk update completed')
    );
});

/**
 * ✅ Generate Sample Chart Data (Admin)
 */
export const generateSampleChartData = asyncHandler(async (req, res) => {
    const { ticker, type, period, basePrice, days } = req.body;

    if (!ticker || !type || !period || !basePrice || !days) {
        throw new ApiError(400, 'All fields are required');
    }

    const data = [];
    let currentPrice = basePrice;
    const now = new Date();

    for (let i = days; i >= 0; i--) {
        const timestamp = new Date(now);
        timestamp.setDate(timestamp.getDate() - i);

        // Random price change (-2% to +2%)
        const change = (Math.random() - 0.5) * 0.04 * currentPrice;
        currentPrice = Math.max(currentPrice + change, basePrice * 0.8);

        data.push({
            timestamp,
            value: parseFloat(currentPrice.toFixed(2)),
            volume: Math.floor(Math.random() * 1000000) + 100000,
            label: timestamp.toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric'
            })
        });
    }

    const history = await PriceHistory.findOneAndUpdate(
        {
            ticker: ticker.toUpperCase(),
            period: period.toUpperCase()
        },
        {
            ticker: ticker.toUpperCase(),
            type,
            period: period.toUpperCase(),
            data,
            lastUpdated: new Date()
        },
        {
            upsert: true,
            new: true,
            runValidators: true
        }
    );

    res.status(200).json(
        new ApiResponse(200, { history }, 'Sample chart data generated successfully')
    );
});

/**
 * ✅ Generate Sample Daily History (Admin)
 */
export const generateSampleDailyHistory = asyncHandler(async (req, res) => {
    const { ticker, startDate, days, basePrice } = req.body;

    if (!ticker || !startDate || !days || !basePrice) {
        throw new ApiError(400, 'All fields are required');
    }

    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const histories = [];
    let currentPrice = basePrice;
    const start = new Date(startDate);

    for (let i = 0; i < days; i++) {
        const date = new Date(start);
        date.setDate(date.getDate() + i);

        // Skip weekends
        if (date.getDay() === 0 || date.getDay() === 6) {
            continue;
        }

        const dayName = daysOfWeek[date.getDay() - 1];

        const openChange = (Math.random() - 0.5) * 0.1 * currentPrice;
        const open = Math.max(currentPrice + openChange, basePrice * 0.5);

        const closeChange = (Math.random() - 0.5) * 0.08 * open;
        const close = Math.max(open + closeChange, basePrice * 0.5);

        const high = Math.max(open, close) * (1 + Math.random() * 0.03);
        const low = Math.min(open, close) * (1 - Math.random() * 0.03);

        const change = close - open;
        const changePercent = ((change / open) * 100).toFixed(2);

        histories.push({
            ticker: ticker.toUpperCase(),
            date,
            day: dayName,
            open: parseFloat(open.toFixed(2)),
            close: parseFloat(close.toFixed(2)),
            high: parseFloat(high.toFixed(2)),
            low: parseFloat(low.toFixed(2)),
            volume: Math.floor(Math.random() * 1000000) + 100000,
            change: parseFloat(change.toFixed(2)),
            changePercent: parseFloat(changePercent)
        });

        currentPrice = close;
    }

    const created = await DailyHistory.insertMany(histories);

    res.status(201).json(
        new ApiResponse(201, {
            count: created.length,
            histories: created
        }, 'Sample daily history generated successfully')
    );
});

/**
 * ✅ Get Complete Dashboard Stats (Including Market Data)
 */
export const getCompleteDashboardStats = asyncHandler(async (req, res) => {
    // User Stats
    const totalUsers = await User.countDocuments({ isActive: true });
    const verifiedUsers = await User.countDocuments({ isVerified: true, isActive: true });
    const newUsersToday = await User.countDocuments({
        isActive: true,
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
    });

    // Financial Stats
    const users = await User.find({ isActive: true }).select('walletBalance bonusBalance');
    const totalWalletBalance = users.reduce((sum, user) => sum + (user.walletBalance || 0), 0);
    const totalBonusBalance = users.reduce((sum, user) => sum + (user.bonusBalance || 0), 0);
    const grandTotal = totalWalletBalance + totalBonusBalance;

    // Transaction Stats
    const pendingPayments = await Transaction.countDocuments({
        category: 'add_money',
        status: 'pending'
    });

    const pendingWithdrawals = await Transaction.countDocuments({
        category: 'withdrawal',
        status: 'pending'
    });

    const completedWithdrawals = await Transaction.aggregate([
        { $match: { category: 'withdrawal', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalWithdrawals = completedWithdrawals[0]?.total || 0;

    // Market Data Stats
    const totalIndices = await Index.countDocuments({ isActive: true });
    const totalStocks = await Stock.countDocuments({ isActive: true });
    const featuredIndices = await Index.countDocuments({ isFeatured: true, isActive: true });
    const featuredStocks = await Stock.countDocuments({ isFeatured: true, isActive: true });
    const totalPriceHistories = await PriceHistory.countDocuments();
    const totalDailyHistories = await DailyHistory.countDocuments();

    // Today's transactions
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
                total: { $sum: '$amount' }
            }
        }
    ]);

    res.status(200).json(
        new ApiResponse(200, {
            users: {
                total: totalUsers,
                verified: verifiedUsers,
                newToday: newUsersToday,
                verificationRate: ((verifiedUsers / totalUsers) * 100).toFixed(2)
            },
            financial: {
                totalWalletBalance,
                totalBonusBalance,
                grandTotal,
                totalWithdrawals,
                netBalance: totalWalletBalance - totalWithdrawals
            },
            transactions: {
                pendingPayments,
                pendingWithdrawals,
                todayTransactions
            },
            market: {
                totalIndices,
                totalStocks,
                featuredIndices,
                featuredStocks,
                totalPriceHistories,
                totalDailyHistories
            }
        })
    );
});



/**
 * ✅ Create Payment Manager (Super Admin Only)
 */
export const createPaymentManager = asyncHandler(async (req, res) => {
    const { username, email, password, fullName } = req.body;

    // Validate
    if (!username || !email || !password || !fullName) {
        throw new ApiError(400, 'All fields are required');
    }

    // Check if already exists
    const existingAdmin = await Admin.findOne({
        $or: [{ username }, { email }]
    });

    if (existingAdmin) {
        throw new ApiError(409, 'Username or email already exists');
    }

    // Create payment manager
    const paymentManager = await Admin.create({
        username,
        email,
        password,
        fullName,
        role: 'payment_manager',
        permissions: {
            canApprovePayments: true,
            canRejectPayments: true,
            canViewUsers: false,
            canManageAdmins: false
        },
        createdBy: req.admin.adminId
    });

    res.status(201).json(
        new ApiResponse(201, {
            admin: {
                id: paymentManager._id,
                username: paymentManager.username,
                fullName: paymentManager.fullName,
                email: paymentManager.email,
                role: paymentManager.role
            }
        }, 'Payment Manager created successfully')
    );
});


