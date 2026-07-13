import mongoose from 'mongoose';
import Admin from './admin.model.js';
import User from '../user/user.model.js';
import Transaction from '../transaction/transaction.model.js';
import Stock from '../market/stock/stock.model.js';
import Index from '../market/index/index.model.js';
import PriceHistory from '../market/price-history/priceHistory.model.js';
import DailyHistory from '../market/daily-history/dailyHistory.model.js';
import { generateToken } from '../../shared/utils/jwtService.js';
import { ApiError } from '../../shared/utils/apiError.js';

export const createAdminService = async (payload, currentAdmin) => {
    const { username, email, password, fullName, allowedRoutes } = payload;

    const existingUsername = await Admin.findOne({ username: username.toLowerCase() });
    if (existingUsername) {
        throw new ApiError(400, 'Username already exists');
    }

    const existingEmail = await Admin.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
        throw new ApiError(400, 'Email already exists');
    }

    const admin = await Admin.create({
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        password,
        fullName,
        role: 'admin',
        permissions: {
            canApprovePayments: true,
            canRejectPayments: true,
            canViewUsers: true,
            canManageAdmins: false
        },
        allowedRoutes,
        createdBy: currentAdmin.adminId
    });

    return {
        id: admin.id,
        username: admin.username,
        fullName: admin.fullName,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
        allowedRoutes: admin.allowedRoutes
    };
};

export const adminLoginService = async ({ username, password }) => {
    const admin = await Admin.findOne({
        username: username.toLowerCase(),
        isActive: true
    }).select('+password');

    if (!admin) {
        throw new ApiError(401, 'Invalid username or password');
    }

    const isPasswordValid = await admin.comparePassword(password);
    if (!isPasswordValid) {
        throw new ApiError(401, 'Invalid username or password');
    }

    admin.lastLogin = new Date();
    await admin.save();

    const token = generateToken({
        adminId: admin.id,
        username: admin.username,
        role: admin.role,
        isAdmin: true
    });

    return {
        admin: {
            id: admin.id,
            username: admin.username,
            fullName: admin.fullName,
            email: admin.email,
            role: admin.role,
            permissions: admin.permissions,
            allowedRoutes: admin.allowedRoutes
        },
        token
    };
};

export const createFirstAdminService = async ({ username, email, password, fullName }) => {
    const adminCount = await Admin.countDocuments();

    if (adminCount > 0) {
        throw new ApiError(403, 'Admin already exists. Use login instead.');
    }

    const admin = await Admin.create({
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        password,
        fullName,
        role: 'super_admin',
        permissions: {
            canApprovePayments: true,
            canRejectPayments: true,
            canViewUsers: true,
            canManageAdmins: true
        },
        allowedRoutes: ['*']
    });

    const token = generateToken({
        adminId: admin.id,
        username: admin.username,
        role: admin.role,
        isAdmin: true
    });

    return {
        admin: {
            id: admin.id,
            username: admin.username,
            fullName: admin.fullName,
            email: admin.email,
            role: admin.role
        },
        token
    };
};

export const getAllAdminsService = async () => {
    const admins = await Admin.find()
        .select('-password')
        .populate('createdBy', 'username fullName')
        .sort({ createdAt: -1 })
        .lean();

    return { admins };
};

export const deleteAdminService = async ({ adminId, currentAdminId }) => {
    const admin = await Admin.findById(adminId);

    if (!admin) {
        throw new ApiError(404, 'Admin not found');
    }

    if (admin.role === 'super_admin') {
        throw new ApiError(403, 'Cannot delete super admin');
    }

    if (adminId === String(currentAdminId)) {
        throw new ApiError(403, 'Cannot delete your own account');
    }

    await Admin.findByIdAndDelete(adminId);
    return null;
};

export const updateAdminRoleService = async ({ adminId, role }) => {
    if (!['super_admin', 'admin'].includes(role)) {
        throw new ApiError(400, 'Invalid role');
    }

    const admin = await Admin.findById(adminId);
    if (!admin) {
        throw new ApiError(404, 'Admin not found');
    }

    const oldRole = admin.role;
    admin.role = role;

    if (role === 'super_admin') {
        admin.permissions = {
            canApprovePayments: true,
            canRejectPayments: true,
            canViewUsers: true,
            canManageAdmins: true
        };
        admin.allowedRoutes = ['*'];
    }

    if (role === 'admin') {
        admin.permissions = {
            canApprovePayments: true,
            canRejectPayments: true,
            canViewUsers: true,
            canManageAdmins: false
        };
    }

    await admin.save();

    const adminData = admin.toObject();
    delete adminData.password;

    return {
        admin: adminData,
        message: `Admin role updated from ${oldRole} to ${role}`
    };
};

export const getDashboardStatsService = async () => {
    const totalUsers = await User.countDocuments({ isActive: true });
    const pendingPayments = await Transaction.countDocuments({ category: 'add_money', status: 'pending' });
    const pendingWithdrawals = await Transaction.countDocuments({ category: 'withdrawal', status: 'pending' });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayTransactions = await Transaction.aggregate([
        { $match: { createdAt: { $gte: todayStart } } },
        {
            $group: {
                _id: '$category',
                count: { $sum: 1 },
                totalAmount: { $sum: '$amount' }
            }
        }
    ]);

    return {
        totalUsers,
        pendingPayments,
        pendingWithdrawals,
        todayTransactions
    };
};

export const getCompleteDashboardStatsService = async () => {
    const totalUsers = await User.countDocuments({ isActive: true });
    const verifiedUsers = await User.countDocuments({ isVerified: true, isActive: true });

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const newUsersToday = await User.countDocuments({
        isActive: true,
        createdAt: { $gte: start }
    });

    const users = await User.find({ isActive: true }).select('walletBalance').lean();
    const totalWalletBalance = users.reduce((sum, user) => sum + (user.walletBalance || 0), 0);

    const pendingPayments = await Transaction.countDocuments({ category: 'add_money', status: 'pending' });
    const pendingWithdrawals = await Transaction.countDocuments({ category: 'withdrawal', status: 'pending' });

    const completedWithdrawals = await Transaction.aggregate([
        { $match: { category: 'withdrawal', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalWithdrawals = completedWithdrawals[0]?.total || 0;

    const totalIndices = await Index.countDocuments({ isActive: true });
    const totalStocks = await Stock.countDocuments({ isActive: true });
    const featuredIndices = await Index.countDocuments({ isFeatured: true, isActive: true });
    const featuredStocks = await Stock.countDocuments({ isFeatured: true, isActive: true });
    const totalPriceHistories = await PriceHistory.countDocuments();
    const totalDailyHistories = await DailyHistory.countDocuments();

    const todayTransactions = await Transaction.aggregate([
        { $match: { createdAt: { $gte: start } } },
        {
            $group: {
                _id: '$category',
                count: { $sum: 1 },
                total: { $sum: '$amount' }
            }
        }
    ]);

    return {
        users: {
            total: totalUsers,
            verified: verifiedUsers,
            newToday: newUsersToday,
            verificationRate: totalUsers ? Number(((verifiedUsers / totalUsers) * 100).toFixed(2)) : 0
        },
        financial: {
            totalWalletBalance,
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
    };
};

export const getAllTransactionsService = async ({ page = 1, limit = 50, status, category }) => {
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

export const getAllUsersService = async ({
    page = 1,
    limit = 20,
    search = '',
    sortBy = 'createdAt',
    sortOrder = 'desc'
}) => {
    const filter = { isActive: true };

    if (search) {
        filter.$or = [
            { fullName: { $regex: search, $options: 'i' } },
            { phoneNumber: { $regex: search, $options: 'i' } }
        ];
    }

    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    const pageNum = Number(page);
    const limitNum = Number(limit);

    const users = await User.find(filter)
        .select('fullName phoneNumber walletBalance kycStatus isVerified createdAt lastLogin')
        .sort(sort)
        .limit(limitNum)
        .skip((pageNum - 1) * limitNum)
        .lean();

    const count = await User.countDocuments(filter);
    const totalWalletBalance = users.reduce((sum, user) => sum + (user.walletBalance || 0), 0);

    return {
        users,
        totalPages: Math.ceil(count / limitNum),
        currentPage: pageNum,
        totalUsers: count,
        totalWalletBalance
    };
};

export const getUserDetailsService = async ({ userId }) => {
    const user = await User.findById(userId).select('-__v').lean();

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

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

    const recentTransactions = await Transaction.find({ userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

    return {
        user,
        transactionStats,
        recentTransactions
    };
};

export const updateUserBalanceService = async ({ userId, amount, type, reason, adminId }) => {
    const session = await mongoose.startSession();
    session.startTransaction({
        readPreference: 'primary',
        readConcern: { level: 'majority' },
        writeConcern: { w: 'majority' }
    });

    try {
        const user = await User.findById(userId).session(session);
        if (!user) {
            throw new ApiError(404, 'User not found');
        }

        const parsedAmount = Number(amount);
        const balanceBefore = user.walletBalance;
        let balanceAfter = balanceBefore;

        if (type === 'add') {
            balanceAfter = balanceBefore + parsedAmount;
        } else {
            if (balanceBefore < parsedAmount) {
                throw new ApiError(400, 'Insufficient balance for deduction');
            }
            balanceAfter = balanceBefore - parsedAmount;
        }

        user.walletBalance = balanceAfter;
        await user.save({ session });

        await Transaction.create(
            [
                {
                    userId: user._id,
                    type: type === 'add' ? 'credit' : 'debit',
                    category: 'refund',
                    amount: parsedAmount,
                    balanceBefore,
                    balanceAfter,
                    status: 'completed',
                    description: `Manual balance ${type} by admin: ${reason}`,
                    adminAction: {
                        actionType: 'approved',
                        actionBy: adminId,
                        actionAt: new Date(),
                        reason
                    }
                }
            ],
            { session }
        );

        await session.commitTransaction();

        return {
            user: {
                id: user.id,
                fullName: user.fullName,
                phoneNumber: user.phoneNumber,
                newWalletBalance: balanceAfter,
                newTotalBalance: balanceAfter
            },
            message: `Balance ${type}ed successfully`
        };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

export const getUserStatsService = async () => {
    const totalUsers = await User.countDocuments({ isActive: true });
    const verifiedUsers = await User.countDocuments({ isActive: true, isVerified: true });
    const kycPendingUsers = await User.countDocuments({ kycStatus: 'pending' });

    const walletStats = await User.aggregate([
        { $match: { isActive: true } },
        {
            $group: {
                _id: null,
                totalWalletBalance: { $sum: '$walletBalance' },
                avgWalletBalance: { $avg: '$walletBalance' }
            }
        }
    ]);

    const stats = walletStats[0] || {
        totalWalletBalance: 0,
        avgWalletBalance: 0
    };

    return {
        totalUsers,
        verifiedUsers,
        kycPendingUsers,
        totalWalletBalance: stats.totalWalletBalance,
        avgWalletBalance: stats.avgWalletBalance
    };
};

export const getWithdrawalStatsService = async () => {
    const completedWithdrawals = await Transaction.aggregate([
        { $match: { category: 'withdrawal', status: 'completed' } },
        {
            $group: {
                _id: null,
                totalWithdrawals: { $sum: '$amount' },
                totalCount: { $sum: 1 }
            }
        }
    ]);

    const pendingWithdrawals = await Transaction.aggregate([
        { $match: { category: 'withdrawal', status: 'pending' } },
        {
            $group: {
                _id: null,
                pendingAmount: { $sum: '$amount' },
                pendingCount: { $sum: 1 }
            }
        }
    ]);

    const rejectedWithdrawals = await Transaction.aggregate([
        { $match: { category: 'withdrawal', status: 'rejected' } },
        {
            $group: {
                _id: null,
                rejectedAmount: { $sum: '$amount' },
                rejectedCount: { $sum: 1 }
            }
        }
    ]);

    const completedStats = completedWithdrawals[0] || { totalWithdrawals: 0, totalCount: 0 };
    const pendingStats = pendingWithdrawals[0] || { pendingAmount: 0, pendingCount: 0 };
    const rejectedStats = rejectedWithdrawals[0] || { rejectedAmount: 0, rejectedCount: 0 };

    return {
        totalWithdrawals: completedStats.totalWithdrawals,
        totalCount: completedStats.totalCount,
        pendingAmount: pendingStats.pendingAmount,
        pendingCount: pendingStats.pendingCount,
        rejectedAmount: rejectedStats.rejectedAmount,
        rejectedCount: rejectedStats.rejectedCount,
        grandTotal: completedStats.totalWithdrawals + pendingStats.pendingAmount
    };
};

export const getMarketDashboardStatsService = async () => {
    const totalIndices = await Index.countDocuments({ isActive: true });
    const totalStocks = await Stock.countDocuments({ isActive: true });
    const featuredIndices = await Index.countDocuments({ isFeatured: true, isActive: true });
    const featuredStocks = await Stock.countDocuments({ isFeatured: true, isActive: true });
    const totalPriceHistories = await PriceHistory.countDocuments();
    const totalDailyHistories = await DailyHistory.countDocuments();

    const stockCategories = await Stock.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const indexCategories = await Index.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    return {
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
    };
};

export const getAllStocksAdminService = async ({
    category,
    featured,
    active,
    sector,
    page = 1,
    limit = 50
}) => {
    const filter = {};
    if (category) filter.category = category;
    if (featured !== undefined) filter.isFeatured = featured === 'true';
    if (active !== undefined) filter.isActive = active === 'true';
    if (sector) filter.sector = sector;

    const pageNum = Number(page);
    const limitNum = Number(limit);

    const stocks = await Stock.find(filter)
        .sort({ isFeatured: -1, price: -1 })
        .limit(limitNum)
        .skip((pageNum - 1) * limitNum)
        .lean();

    const count = await Stock.countDocuments(filter);

    return {
        stocks,
        totalPages: Math.ceil(count / limitNum),
        currentPage: pageNum,
        total: count
    };
};

export const createStockService = async (payload) => {
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
        description
    } = payload;

    if (!name || !ticker || !symbol || !price || !openPrice || !highPrice || !lowPrice || !previousClose) {
        throw new ApiError(400, 'All required fields must be provided');
    }

    const existingStock = await Stock.findOne({ ticker: ticker.toUpperCase() });
    if (existingStock) {
        throw new ApiError(409, 'Stock with this ticker already exists');
    }

    const change = Number(price) - Number(previousClose);
    const changePercent = Number(((change / Number(previousClose)) * 100).toFixed(2));

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
        description,
        isActive: true
    });

    return stock;
};

export const updateStockService = async ({ id, updateData }) => {
    const stock = await Stock.findById(id);
    if (!stock) {
        throw new ApiError(404, 'Stock not found');
    }

    if (updateData.price) {
        const previousClose = updateData.previousClose ?? stock.previousClose;
        updateData.change = Number(updateData.price) - Number(previousClose);
        updateData.changePercent = Number(((updateData.change / Number(previousClose)) * 100).toFixed(2));
        updateData.lastUpdated = new Date();
    }

    Object.assign(stock, updateData);
    await stock.save();

    return stock;
};

export const deleteStockService = async ({ id }) => {
    const stock = await Stock.findByIdAndDelete(id);
    if (!stock) {
        throw new ApiError(404, 'Stock not found');
    }

    await PriceHistory.deleteMany({ ticker: stock.ticker, type: 'Stock' });
    await DailyHistory.deleteMany({ ticker: stock.ticker });

    return null;
};

export const bulkUpdatePricesService = async ({ updates, type = 'Stock' }) => {
    if (!Array.isArray(updates) || updates.length === 0) {
        throw new ApiError(400, 'Updates array is required');
    }

    const results = [];
    const Model = type === 'Index' ? Index : Stock;
    const identifierField = type === 'Index' ? 'symbol' : 'ticker';

    for (const update of updates) {
        try {
            const identifier = update[identifierField];
            const entity = await Model.findOne({ [identifierField]: String(identifier).toUpperCase() });

            if (!entity) {
                results.push({
                    [identifierField]: identifier,
                    success: false,
                    message: 'Not found'
                });
                continue;
            }

            const newPrice = type === 'Index' ? update.currentValue : update.price;
            await entity.updatePrice(newPrice);

            results.push({
                [identifierField]: identifier,
                success: true
            });
        } catch (error) {
            results.push({
                [identifierField]: update[identifierField],
                success: false,
                message: error.message
            });
        }
    }

    return results;
};

export const generateSampleChartDataService = async ({ ticker, type, period, basePrice, days }) => {
    if (!ticker || !type || !period || !basePrice || !days) {
        throw new ApiError(400, 'All fields are required');
    }

    const data = [];
    let currentPrice = Number(basePrice);
    const now = new Date();

    for (let i = Number(days); i >= 0; i--) {
        const timestamp = new Date(now);
        timestamp.setDate(timestamp.getDate() - i);

        const change = (Math.random() - 0.5) * 0.04;
        currentPrice = Math.max(currentPrice + currentPrice * change, Number(basePrice) * 0.8);

        data.push({
            timestamp,
            value: parseFloat(currentPrice.toFixed(2)),
            volume: Math.floor(Math.random() * 1000000) + 100000,
            label: timestamp.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
        });
    }

    return PriceHistory.findOneAndUpdate(
        { ticker: ticker.toUpperCase(), period: period.toUpperCase() },
        {
            ticker: ticker.toUpperCase(),
            type,
            period: period.toUpperCase(),
            data,
            lastUpdated: new Date()
        },
        { upsert: true, new: true, runValidators: true }
    );
};

export const generateSampleDailyHistoryService = async ({ ticker, startDate, days, basePrice }) => {
    if (!ticker || !startDate || !days || !basePrice) {
        throw new ApiError(400, 'All fields are required');
    }

    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const histories = [];
    let currentPrice = Number(basePrice);
    const start = new Date(startDate);

    for (let i = 0; i < Number(days); i++) {
        const date = new Date(start);
        date.setDate(date.getDate() + i);

        if (date.getDay() === 0 || date.getDay() === 6) continue;

        const dayName = daysOfWeek[date.getDay() - 1];
        const openChange = (Math.random() - 0.5) * 0.1 * currentPrice;
        const open = Math.max(currentPrice + openChange, Number(basePrice) * 0.5);

        const closeChange = (Math.random() - 0.5) * 0.08 * open;
        const close = Math.max(open + closeChange, Number(basePrice) * 0.5);

        const high = Math.max(open, close) * (1 + Math.random() * 0.03);
        const low = Math.min(open, close) * (1 - Math.random() * 0.03);
        const change = close - open;
        const changePercent = Number(((change / open) * 100).toFixed(2));

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
            changePercent
        });

        currentPrice = close;
    }

    return DailyHistory.insertMany(histories);
};

export const getAdminActivityService = async ({ page = 1, limit = 50 }) => {
    return {
        activities: [],
        totalPages: 0,
        currentPage: Number(page),
        total: 0,
        message: 'Activity tracking coming soon'
    };
};