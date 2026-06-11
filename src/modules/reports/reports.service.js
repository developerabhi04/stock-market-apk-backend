import User from '../user/user.model.js';
import Transaction from '../transaction/transaction.model.js';
import Stock from '../market/stock/stock.model.js';
import Category from '../market/category/category.model.js';

const getStartOfMonth = (date) =>
    new Date(date.getFullYear(), date.getMonth(), 1);

const getEndOfMonth = (date) =>
    new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

const monthLabel = (date) =>
    date.toLocaleString('en-US', { month: 'short' });

export const getReportsOverviewService = async () => {
    const now = new Date();

    const [
        totalUsers,
        activeUsers,
        totalTransactions,
        completedTransactions,
        pendingTransactions,
        failedTransactions,
        depositsAgg,
        withdrawalsAgg,
        topStocks,
        topCategories
    ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ isBlocked: { $ne: true } }),
        Transaction.countDocuments(),
        Transaction.countDocuments({ status: 'completed' }),
        Transaction.countDocuments({ status: 'pending' }),
        Transaction.countDocuments({ status: 'failed' }),
        Transaction.aggregate([
            { $match: { type: 'deposit', status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        Transaction.aggregate([
            { $match: { type: 'withdrawal', status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        Stock.find({ isActive: true })
            .sort({ price: -1 })
            .limit(5)
            .select('name ticker price change changePercent category')
            .lean(),
        Category.find({})
            .sort({ createdAt: -1 })
            .limit(5)
            .select('name slug type isActive createdAt')
            .lean()
    ]);

    const totalDeposits = depositsAgg?.[0]?.total || 0;
    const totalWithdrawals = withdrawalsAgg?.[0]?.total || 0;
    const netRevenue = totalDeposits - totalWithdrawals;

    const transactionStatus = [
        { name: 'Completed', value: completedTransactions },
        { name: 'Pending', value: pendingTransactions },
        { name: 'Failed', value: failedTransactions }
    ];

    const months = [];
    for (let i = 5; i >= 0; i -= 1) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(d);
    }

    const userGrowth = await Promise.all(
        months.map(async (monthDate) => {
            const start = getStartOfMonth(monthDate);
            const end = getEndOfMonth(monthDate);

            const users = await User.countDocuments({
                createdAt: { $gte: start, $lte: end }
            });

            return {
                label: monthLabel(monthDate),
                users
            };
        })
    );

    const revenueTrend = await Promise.all(
        months.map(async (monthDate) => {
            const start = getStartOfMonth(monthDate);
            const end = getEndOfMonth(monthDate);

            const [depositData, withdrawalData] = await Promise.all([
                Transaction.aggregate([
                    {
                        $match: {
                            type: 'deposit',
                            status: 'completed',
                            createdAt: { $gte: start, $lte: end }
                        }
                    },
                    { $group: { _id: null, total: { $sum: '$amount' } } }
                ]),
                Transaction.aggregate([
                    {
                        $match: {
                            type: 'withdrawal',
                            status: 'completed',
                            createdAt: { $gte: start, $lte: end }
                        }
                    },
                    { $group: { _id: null, total: { $sum: '$amount' } } }
                ])
            ]);

            const deposits = depositData?.[0]?.total || 0;
            const withdrawals = withdrawalData?.[0]?.total || 0;

            return {
                label: monthLabel(monthDate),
                deposits,
                withdrawals,
                net: deposits - withdrawals
            };
        })
    );

    return {
        summary: {
            totalUsers,
            activeUsers,
            totalTransactions,
            completedTransactions,
            pendingTransactions,
            failedTransactions,
            totalDeposits,
            totalWithdrawals,
            netRevenue
        },
        transactionStatus,
        userGrowth,
        revenueTrend,
        topStocks,
        topCategories
    };
};