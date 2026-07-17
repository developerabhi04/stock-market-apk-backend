import mongoose from 'mongoose';
import Investment from './investment.model.js';
import Index from '../index/index.model.js';
import User from '../../user/user.model.js';
import Transaction from '../../transaction/transaction.model.js';
import InterestSlab from '../interest-slab/interestSlab.model.js';
import { ApiError } from '../../../shared/utils/apiError.js';

const normalizeAmount = (value) => {
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) {
        throw new ApiError(400, 'Amount must be a valid number');
    }
    return Number(numericValue.toFixed(2));
};

const normalizeRate = (value, fieldName = 'Rate') => {
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) {
        throw new ApiError(400, `${fieldName} must be a valid number`);
    }
    if (numericValue < 0) {
        throw new ApiError(400, `${fieldName} cannot be negative`);
    }
    return Number(numericValue.toFixed(2));
};

const normalizePositiveInteger = (value, fieldName = 'Value') => {
    const numericValue = Number(value);
    if (Number.isNaN(numericValue) || !Number.isInteger(numericValue) || numericValue < 1) {
        throw new ApiError(400, `${fieldName} must be an integer greater than 0`);
    }
    return numericValue;
};

const generateOrderNumber = () => {
    const timestamp = Date.now();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `INV-${timestamp}-${random}`;
};

const getStartOfDayUtc = (date = new Date()) => {
    const utcDate = new Date(date);
    utcDate.setUTCHours(0, 0, 0, 0);
    return utcDate;
};

const getEndOfDayUtc = (date = new Date()) => {
    const utcDate = new Date(date);
    utcDate.setUTCHours(23, 59, 59, 999);
    return utcDate;
};

const getIndexMinimumInvestment = (indexDoc) => {
    const minimumInvestment = Number(indexDoc?.minimumInvestment);
    if (Number.isNaN(minimumInvestment) || minimumInvestment <= 0) {
        throw new ApiError(400, 'This index does not have a minimum investment configured. Contact admin.');
    }
    return Number(minimumInvestment.toFixed(2));
};

const getIndexLockPeriodDays = (indexDoc) => {
    const lockPeriodDays = Number(indexDoc?.lockPeriodDays);
    if (Number.isNaN(lockPeriodDays) || !Number.isInteger(lockPeriodDays) || lockPeriodDays < 1) {
        throw new ApiError(400, 'This index does not have a valid lock period configured. Contact admin.');
    }
    return lockPeriodDays;
};

const getIndexDefaultDailyRate = (indexDoc) => {
    if (
        indexDoc?.defaultDailyRate === null ||
        typeof indexDoc?.defaultDailyRate === 'undefined' ||
        indexDoc?.defaultDailyRate === ''
    ) {
        return null;
    }
    const defaultDailyRate = Number(indexDoc.defaultDailyRate);
    if (Number.isNaN(defaultDailyRate) || defaultDailyRate < 0) {
        throw new ApiError(400, 'This index has an invalid default daily rate configured.');
    }
    return Number(defaultDailyRate.toFixed(2));
};

const mapInvestmentResponse = (investment) => {
    const amount = Number(investment.amount || 0);
    const totalInterestEarned = Number(investment.totalInterestEarned || 0);
    const effectiveDailyRate =
        investment.effectiveDailyRate === null || typeof investment.effectiveDailyRate === 'undefined'
            ? null
            : Number(investment.effectiveDailyRate);
    const dailyInterestAmount = Number(investment.dailyInterestAmount || 0);
    const daysCompleted = Number(investment.daysCompleted || 0);
    const daysRemaining = Number(investment.daysRemaining || 0);
    const lockPeriodDays = Number(investment.lockPeriodDays || 0);
    const minimumInvestment =
        investment.minimumInvestment === null || typeof investment.minimumInvestment === 'undefined'
            ? investment.indexSnapshot?.minimumInvestment ?? investment.indexId?.minimumInvestment ?? null
            : Number(investment.minimumInvestment);
    const rateSource = investment.rateSource || '';
    const progressPercent =
        lockPeriodDays > 0
            ? Math.min(Number(((daysCompleted / lockPeriodDays) * 100).toFixed(2)), 100)
            : 0;

    const isLockCompleted = investment.isLockCompleted === true;
    const isUnlockedAlready = investment.status === 'unlocked';

    return {
        ...investment,
        id: investment._id,
        amount,
        minimumInvestment: minimumInvestment === null ? null : Number(minimumInvestment),
        totalInterestEarned,
        earned: totalInterestEarned,
        effectiveDailyRate,
        dailyInterestAmount,
        daily: dailyInterestAmount,
        daysCompleted,
        daysRemaining,
        lockPeriodDays,
        rateSource,
        progressPercent,
        canCancel: investment.status === 'active' && isLockCompleted === true,
        canUnlock: investment.status === 'active' && isLockCompleted === true,
        canRenew: isUnlockedAlready,
        canReinvest: isUnlockedAlready,
        isActiveInvestment: investment.status === 'active',
        isLocked: investment.status === 'active' && isLockCompleted !== true,
        isUnlocked: isUnlockedAlready,
        isMatured: investment.status === 'active' && isLockCompleted === true,
    };
};

const getMatchingInterestSlab = async (amount, session = null) => {
    const query = InterestSlab.findOne({
        isActive: true,
        minAmount: { $lte: amount },
        maxAmount: { $gte: amount },
    }).sort({ minAmount: 1, sortOrder: 1, createdAt: -1 });

    if (session) {
        query.session(session);
    }

    return query;
};

const buildInvestmentSnapshot = (indexDoc) => ({
    indexSnapshot: {
        name: indexDoc.name || '',
        symbol: indexDoc.symbol || '',
        logoUrl: indexDoc.logoUrl || '',
        currentValue: Number(indexDoc.currentValue || 0),
        minimumInvestment:
            indexDoc.minimumInvestment === null || typeof indexDoc.minimumInvestment === 'undefined'
                ? null
                : Number(indexDoc.minimumInvestment),
        lockPeriodDays:
            indexDoc.lockPeriodDays === null || typeof indexDoc.lockPeriodDays === 'undefined'
                ? null
                : Number(indexDoc.lockPeriodDays),
        defaultDailyRate:
            indexDoc.defaultDailyRate === null || typeof indexDoc.defaultDailyRate === 'undefined'
                ? null
                : Number(indexDoc.defaultDailyRate),
    },
    categorySnapshot: {
        name: indexDoc.category?.name || '',
        slug: indexDoc.category?.slug || '',
        color: indexDoc.category?.color || '',
        icon: indexDoc.category?.icon || '',
    },
});

const createInvestmentTransaction = async ({
    session,
    user,
    investment,
    type,
    category,
    amount,
    description,
    balanceBefore,
    balanceAfter,
    adminId = null,
    metadata = {},
}) => {
    return Transaction.create(
        [
            {
                userId: user._id,
                type,
                category,
                amount: Number(amount),
                balanceBefore: Number(balanceBefore),
                balanceAfter: Number(balanceAfter),
                status: 'completed',
                description,
                metadata,
                tradeDetails: {
                    investmentId: investment._id,
                    indexId: investment.indexId,
                    stockSymbol: investment.indexSnapshot?.symbol || '',
                    price: investment.indexSnapshot?.currentValue || 0,
                    dailyRate: investment.effectiveDailyRate || 0,
                    dailyInterestAmount: investment.dailyInterestAmount || 0,
                    lockPeriodDays: investment.lockPeriodDays || 0,
                    minimumInvestment:
                        investment.minimumInvestment ??
                        investment.indexSnapshot?.minimumInvestment ??
                        null,
                },
                adminAction: adminId
                    ? {
                        actionType: 'approved',
                        actionBy: adminId,
                        actionAt: new Date(),
                    }
                    : undefined,
            },
        ],
        { session }
    );
};

const resolveRateForInvestment = ({ indexDoc, slab, customDailyRate }) => {
    const hasCustomRate =
        customDailyRate !== null &&
        typeof customDailyRate !== 'undefined' &&
        customDailyRate !== '';

    if (hasCustomRate) {
        return {
            customDailyRate: normalizeRate(customDailyRate, 'Custom daily rate'),
            slabDailyRate: slab?.dailyRate ?? null,
            effectiveDailyRate: normalizeRate(customDailyRate, 'Custom daily rate'),
            rateSource: 'custom',
        };
    }

    if (slab?.dailyRate !== null && typeof slab?.dailyRate !== 'undefined') {
        return {
            customDailyRate: null,
            slabDailyRate: normalizeRate(slab.dailyRate, 'Slab daily rate'),
            effectiveDailyRate: normalizeRate(slab.dailyRate, 'Slab daily rate'),
            rateSource: 'slab',
        };
    }

    const defaultDailyRate = getIndexDefaultDailyRate(indexDoc);

    if (defaultDailyRate !== null) {
        return {
            customDailyRate: null,
            slabDailyRate: null,
            effectiveDailyRate: defaultDailyRate,
            rateSource: 'default',
        };
    }

    throw new ApiError(400, 'No daily rate available for this investment amount');
};

export const createInvestmentOrderService = async ({ userId, payload }) => {
    if (!userId) {
        throw new ApiError(401, 'User authentication required');
    }

    const indexId = payload.indexId || payload.stockId || payload.instrumentId;
    if (!indexId || !mongoose.Types.ObjectId.isValid(indexId)) {
        throw new ApiError(400, 'Valid index id is required');
    }

    const amount = normalizeAmount(payload.amount);

    const indexDoc = await Index.findOne({ _id: indexId, isActive: true })
        .populate('category', 'name slug color icon')
        .lean();

    if (!indexDoc) {
        throw new ApiError(404, 'Active index not found');
    }

    const minimumInvestment = getIndexMinimumInvestment(indexDoc);
    const lockPeriodDays = getIndexLockPeriodDays(indexDoc);
    const indexDefaultDailyRate = getIndexDefaultDailyRate(indexDoc);

    if (amount < minimumInvestment) {
        throw new ApiError(400, `Minimum investment amount for ${indexDoc.name} is ₹${minimumInvestment}`);
    }

    const slab = await getMatchingInterestSlab(amount);

    const rateConfig = resolveRateForInvestment({
        indexDoc,
        slab,
        customDailyRate: payload.customDailyRate,
    });

    const dailyInterestAmount = Number(((amount * rateConfig.effectiveDailyRate) / 100).toFixed(2));

    const session = await mongoose.startSession();
    session.startTransaction({
        readPreference: 'primary',
        readConcern: { level: 'majority' },
        writeConcern: { w: 'majority' },
    });

    try {
        const user = await User.findById(userId)
            .select('_id fullName walletBalance isVerified isActive')
            .session(session);

        if (!user || !user.isActive) {
            throw new ApiError(404, 'User not found');
        }

        if (Number(user.walletBalance) < amount) {
            throw new ApiError(400, 'Insufficient wallet balance');
        }

        const approvedAt = new Date();
        const lockEndsAt = new Date(approvedAt);
        lockEndsAt.setDate(lockEndsAt.getDate() + lockPeriodDays);

        const balanceBefore = Number(user.walletBalance);
        user.walletBalance = Number((Number(user.walletBalance) - amount).toFixed(2));
        const balanceAfter = Number(user.walletBalance);

        await user.save({ session });

        const investmentDocs = await Investment.create(
            [
                {
                    userId: user._id,
                    indexId: indexDoc._id,
                    categoryId: indexDoc.category?._id || null,
                    orderNumber: generateOrderNumber(),
                    amount,
                    minimumInvestment,
                    status: 'active',
                    lockPeriodDays,
                    daysCompleted: 0,
                    daysRemaining: lockPeriodDays,
                    isLockCompleted: false,
                    orderPlacedAt: approvedAt,
                    approvedAt,
                    approvedBy: null,
                    lockEndsAt,
                    currentValueSnapshot: Number(indexDoc.currentValue || 0),
                    slabId: slab?._id || null,
                    slabDailyRate: rateConfig.slabDailyRate,
                    customDailyRate: rateConfig.customDailyRate,
                    effectiveDailyRate: rateConfig.effectiveDailyRate,
                    dailyInterestAmount,
                    rateSource: rateConfig.rateSource,
                    adminRemark: '',
                    rejectionReason: '',
                    ...buildInvestmentSnapshot({
                        ...indexDoc,
                        minimumInvestment,
                        lockPeriodDays,
                        defaultDailyRate: indexDefaultDailyRate,
                    }),
                },
            ],
            { session }
        );

        const investment = investmentDocs[0];

        await createInvestmentTransaction({
            session,
            user,
            investment,
            type: 'debit',
            category: 'investment_principal_debit',
            amount: investment.amount,
            balanceBefore,
            balanceAfter,
            description: `Investment principal debited for ${investment.indexSnapshot?.name || 'investment'} purchase`,
            metadata: {
                investmentId: investment._id,
                action: 'investment_created',
                executionType: 'instant_buy',
                minimumInvestment,
                lockPeriodDays,
                rateSource: rateConfig.rateSource,
            },
        });

        await session.commitTransaction();

        const createdInvestment = await Investment.findById(investment._id)
            .populate('indexId', 'name symbol logoUrl currentValue minimumInvestment lockPeriodDays defaultDailyRate')
            .populate('categoryId', 'name slug color icon')
            .lean({ virtuals: true });

        return mapInvestmentResponse(createdInvestment);
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        await session.endSession();
    }
};

export const getMyInvestmentOrdersService = async ({ userId, query = {} }) => {
    if (!userId) {
        throw new ApiError(401, 'User authentication required');
    }

    const { page = 1, limit = 20, status } = query;
    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.max(Number(limit) || 20, 1);
    const skip = (pageNum - 1) * limitNum;

    const filter = { userId };

    if (status?.trim()) {
        filter.status = status.trim();
    }

    const [investments, total] = await Promise.all([
        Investment.find(filter)
            .populate('indexId', 'name symbol logoUrl currentValue minimumInvestment lockPeriodDays defaultDailyRate')
            .populate('categoryId', 'name slug color icon')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean({ virtuals: true }),
        Investment.countDocuments(filter),
    ]);

    return {
        investments: investments.map(mapInvestmentResponse),
        total,
        totalPages: Math.ceil(total / limitNum),
        currentPage: pageNum,
    };
};

export const getMyPortfolioService = async ({ userId, query = {} }) => {
    if (!userId) {
        throw new ApiError(401, 'User authentication required');
    }

    const { status } = query;
    const filter = { userId };

    if (status?.trim()) {
        filter.status = status.trim();
    }

    const investments = await Investment.find(filter)
        .populate('indexId', 'name symbol logoUrl currentValue minimumInvestment lockPeriodDays defaultDailyRate')
        .populate('categoryId', 'name slug color icon')
        .sort({ createdAt: -1 })
        .lean({ virtuals: true });

    const mapped = investments.map(mapInvestmentResponse);

    return {
        summary: {
            totalInvestments: mapped.length,
            activeInvestments: mapped.filter((item) => item.status === 'active').length,
            completedInvestments: mapped.filter((item) => item.isLockCompleted === true).length,
            cancelledInvestments: mapped.filter((item) => item.status === 'cancelled').length,
            unlockedInvestments: mapped.filter((item) => item.status === 'unlocked').length,
            totalPrincipalInvested: mapped
                .filter((item) => item.status === 'active')
                .reduce((sum, item) => sum + Number(item.amount || 0), 0),
            totalInterestEarned: mapped.reduce(
                (sum, item) => sum + Number(item.totalInterestEarned || 0),
                0
            ),
            totalDailyEarning: mapped
                .filter((item) => item.status === 'active')
                .reduce((sum, item) => sum + Number(item.dailyInterestAmount || 0), 0),
            totalCurrentValue: mapped
                .filter((item) => item.status === 'active')
                .reduce(
                    (sum, item) =>
                        sum + Number(item.amount || 0) + Number(item.totalInterestEarned || 0),
                    0
                ),
        },
        investments: mapped,
    };
};

export const getAllInvestmentOrdersAdminService = async ({ query = {} }) => {
    const { page = 1, limit = 20, status, search } = query;
    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.max(Number(limit) || 20, 1);
    const skip = (pageNum - 1) * limitNum;

    const filter = {};

    if (status?.trim()) {
        filter.status = status.trim();
    }

    if (search?.trim()) {
        filter.$or = [
            { orderNumber: { $regex: search.trim(), $options: 'i' } },
            { 'indexSnapshot.name': { $regex: search.trim(), $options: 'i' } },
            { 'indexSnapshot.symbol': { $regex: search.trim(), $options: 'i' } },
        ];
    }

    const [investments, total] = await Promise.all([
        Investment.find(filter)
            .populate('userId', 'fullName phoneNumber walletBalance')
            .populate('indexId', 'name symbol logoUrl currentValue minimumInvestment lockPeriodDays defaultDailyRate')
            .populate('categoryId', 'name slug color icon')
            .populate('approvedBy', 'username role')
            .populate('rejectedBy', 'username role')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean({ virtuals: true }),
        Investment.countDocuments(filter),
    ]);

    return {
        investments: investments.map(mapInvestmentResponse),
        total,
        totalPages: Math.ceil(total / limitNum),
        currentPage: pageNum,
    };
};

export const getInvestmentByIdService = async ({ investmentId, userId = null, adminView = false }) => {
    if (!mongoose.Types.ObjectId.isValid(investmentId)) {
        throw new ApiError(400, 'Invalid investment id');
    }

    const filter = { _id: investmentId };

    if (!adminView && userId) {
        filter.userId = userId;
    }

    const investment = await Investment.findOne(filter)
        .populate('userId', 'fullName phoneNumber walletBalance')
        .populate('indexId', 'name symbol logoUrl currentValue minimumInvestment lockPeriodDays defaultDailyRate')
        .populate('categoryId', 'name slug color icon')
        .populate('slabId', 'title minAmount maxAmount dailyRate')
        .populate('approvedBy', 'username role')
        .populate('rejectedBy', 'username role')
        .lean({ virtuals: true });

    if (!investment) {
        throw new ApiError(404, 'Investment not found');
    }

    return mapInvestmentResponse(investment);
};

export const overrideInvestmentRateAdminService = async ({
    investmentId,
    customDailyRate,
    adminRemark,
}) => {
    if (!mongoose.Types.ObjectId.isValid(investmentId)) {
        throw new ApiError(400, 'Invalid investment id');
    }

    const normalizedCustomDailyRate = normalizeRate(customDailyRate, 'Custom daily rate');

    const investment = await Investment.findById(investmentId);

    if (!investment) {
        throw new ApiError(404, 'Investment not found');
    }

    if (investment.status !== 'active') {
        throw new ApiError(400, 'Rate override is allowed only for active investments');
    }

    investment.customDailyRate = normalizedCustomDailyRate;
    investment.effectiveDailyRate = normalizedCustomDailyRate;
    investment.dailyInterestAmount = Number(
        ((Number(investment.amount) * Number(investment.effectiveDailyRate)) / 100).toFixed(2)
    );
    investment.rateSource = 'admin_override';
    investment.adminRemark = adminRemark?.trim() || investment.adminRemark || '';

    await investment.save();

    const updatedInvestment = await Investment.findById(investment._id)
        .populate('userId', 'fullName phoneNumber walletBalance')
        .populate('indexId', 'name symbol logoUrl currentValue minimumInvestment lockPeriodDays defaultDailyRate')
        .populate('categoryId', 'name slug color icon')
        .lean({ virtuals: true });

    return mapInvestmentResponse(updatedInvestment);
};

export const approveInvestmentOrderAdminService = async ({ investmentId, adminId, adminRemark = '' }) => {
    if (!mongoose.Types.ObjectId.isValid(investmentId)) {
        throw new ApiError(400, 'Invalid investment id');
    }

    const investment = await Investment.findById(investmentId)
        .populate('userId', 'fullName phoneNumber walletBalance')
        .populate('indexId', 'name symbol logoUrl currentValue minimumInvestment lockPeriodDays defaultDailyRate')
        .populate('categoryId', 'name slug color icon')
        .lean({ virtuals: true });

    if (!investment) {
        throw new ApiError(404, 'Investment not found');
    }

    if (investment.status !== 'active') {
        throw new ApiError(400, 'This investment is not awaiting approval');
    }

    return {
        ...mapInvestmentResponse(investment),
        adminRemark: adminRemark?.trim?.() || investment.adminRemark || '',
        approvedBy: adminId || investment.approvedBy || null,
    };
};

export const rejectInvestmentOrderAdminService = async ({ investmentId }) => {
    if (!mongoose.Types.ObjectId.isValid(investmentId)) {
        throw new ApiError(400, 'Invalid investment id');
    }

    const investment = await Investment.findById(investmentId);

    if (!investment) {
        throw new ApiError(404, 'Investment not found');
    }

    if (investment.status !== 'active') {
        throw new ApiError(400, 'Only active investments exist in instant-buy flow');
    }

    throw new ApiError(400, 'Reject operation is not available in instant-buy investment flow');
};

export const cancelInvestmentService = async ({ investmentId, userId }) => {
    if (!mongoose.Types.ObjectId.isValid(investmentId)) {
        throw new ApiError(400, 'Invalid investment id');
    }

    if (!userId) {
        throw new ApiError(401, 'User authentication required');
    }

    const session = await mongoose.startSession();
    session.startTransaction({
        readPreference: 'primary',
        readConcern: { level: 'majority' },
        writeConcern: { w: 'majority' },
    });

    try {
        const investment = await Investment.findOne({
            _id: investmentId,
            userId,
            status: 'active',
        }).session(session);

        if (!investment) {
            throw new ApiError(404, 'Active investment not found');
        }

        const lockPeriodDays = Number(investment.lockPeriodDays);

        if (!investment.isLockCompleted) {
            throw new ApiError(400, `Investment is still locked. Cancel is allowed after ${lockPeriodDays} days`);
        }

        const user = await User.findById(userId).session(session);

        if (!user || !user.isActive) {
            throw new ApiError(404, 'User not found');
        }

        const balanceBefore = Number(user.walletBalance);
        user.walletBalance = Number((Number(user.walletBalance) + Number(investment.amount)).toFixed(2));
        const balanceAfter = Number(user.walletBalance);

        await user.save({ session });

        investment.status = 'cancelled';
        investment.cancelledAt = new Date();
        investment.principalReturnedAt = new Date();
        investment.cancelledBy = 'user';

        await investment.save({ session });

        await createInvestmentTransaction({
            session,
            user,
            investment,
            type: 'credit',
            category: 'investment_principal_return',
            amount: investment.amount,
            balanceBefore,
            balanceAfter,
            description: `Investment principal returned for ${investment.indexSnapshot?.name || 'investment'} cancellation`,
            metadata: {
                investmentId: investment._id,
                action: 'investment_cancelled',
                lockPeriodDays,
            },
        });

        await session.commitTransaction();

        const cancelledInvestment = await Investment.findById(investment._id)
            .populate('userId', 'fullName phoneNumber walletBalance')
            .populate('indexId', 'name symbol logoUrl currentValue minimumInvestment lockPeriodDays defaultDailyRate')
            .populate('categoryId', 'name slug color icon')
            .lean({ virtuals: true });

        return mapInvestmentResponse(cancelledInvestment);
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        await session.endSession();
    }
};

export const creditDailyInterestService = async ({ investmentId, creditDate = new Date() }) => {
    if (!mongoose.Types.ObjectId.isValid(investmentId)) {
        throw new ApiError(400, 'Invalid investment id');
    }

    const session = await mongoose.startSession();
    session.startTransaction({
        readPreference: 'primary',
        readConcern: { level: 'majority' },
        writeConcern: { w: 'majority' },
    });

    try {
        const investment = await Investment.findOne({
            _id: investmentId,
            status: 'active',
        }).session(session);

        if (!investment) {
            throw new ApiError(404, 'Active investment not found');
        }

        const creditDayStart = getStartOfDayUtc(creditDate);
        const creditDayEnd = getEndOfDayUtc(creditDate);

        if (
            investment.lastInterestCreditedAt &&
            investment.lastInterestCreditedAt >= creditDayStart &&
            investment.lastInterestCreditedAt <= creditDayEnd
        ) {
            throw new ApiError(400, 'Interest already credited for this date');
        }

        const user = await User.findById(investment.userId).session(session);

        if (!user || !user.isActive) {
            throw new ApiError(404, 'User not found');
        }

        const lockPeriodDays = normalizePositiveInteger(investment.lockPeriodDays, 'Lock period days');

        const balanceBefore = Number(user.walletBalance);
        user.walletBalance = Number(
            (Number(user.walletBalance) + Number(investment.dailyInterestAmount)).toFixed(2)
        );
        const balanceAfter = Number(user.walletBalance);

        await user.save({ session });

        investment.totalInterestEarned = Number(
            (Number(investment.totalInterestEarned) + Number(investment.dailyInterestAmount)).toFixed(2)
        );
        investment.daysCompleted = Number(investment.daysCompleted || 0) + 1;
        investment.lastInterestCreditedAt = new Date(creditDate);

        if (investment.daysCompleted >= lockPeriodDays) {
            investment.daysCompleted = lockPeriodDays;
            investment.isLockCompleted = true;
            investment.daysRemaining = 0;
            investment.completedAt = investment.completedAt || new Date();
        } else {
            investment.daysRemaining = Math.max(lockPeriodDays - Number(investment.daysCompleted), 0);
        }

        await investment.save({ session });

        await createInvestmentTransaction({
            session,
            user,
            investment,
            type: 'credit',
            category: 'investment_interest',
            amount: investment.dailyInterestAmount,
            balanceBefore,
            balanceAfter,
            description: `Daily investment interest credited for ${investment.indexSnapshot?.name || 'investment'}`,
            metadata: {
                investmentId: investment._id,
                action: 'daily_interest_credit',
                creditDate: new Date(creditDate),
                daysCompleted: investment.daysCompleted,
                daysRemaining: investment.daysRemaining,
                lockPeriodDays,
            },
        });

        await session.commitTransaction();

        return {
            investmentId: investment._id,
            creditedAmount: Number(investment.dailyInterestAmount),
            daysCompleted: Number(investment.daysCompleted),
            daysRemaining: Number(investment.daysRemaining),
            isLockCompleted: investment.isLockCompleted,
            lockPeriodDays,
        };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        await session.endSession();
    }
};

export const getActiveInvestmentsForInterestCreditService = async () => {
    const investments = await Investment.find({
        status: 'active',
    })
        .select(
            '_id userId amount minimumInvestment status dailyInterestAmount daysCompleted daysRemaining lockPeriodDays isLockCompleted lastInterestCreditedAt totalInterestEarned indexId indexSnapshot effectiveDailyRate rateSource'
        )
        .lean();

    return investments.map(mapInvestmentResponse);
};

export const resolveInvestmentPreviewService = async ({ userId, indexId, amount }) => {
    if (!userId) {
        throw new ApiError(401, 'User authentication required');
    }

    if (!indexId || !mongoose.Types.ObjectId.isValid(indexId)) {
        throw new ApiError(400, 'Valid index id is required');
    }

    const normalizedAmount = normalizeAmount(amount);

    const [user, indexDoc] = await Promise.all([
        User.findById(userId).select('_id walletBalance isActive').lean(),
        Index.findOne({ _id: indexId, isActive: true })
            .populate('category', 'name slug color icon')
            .lean(),
    ]);

    if (!user || !user.isActive) {
        throw new ApiError(404, 'User not found');
    }

    if (!indexDoc) {
        throw new ApiError(404, 'Active index not found');
    }

    const minimumInvestment = getIndexMinimumInvestment(indexDoc);
    const lockPeriodDays = getIndexLockPeriodDays(indexDoc);
    const defaultDailyRate = getIndexDefaultDailyRate(indexDoc);

    if (normalizedAmount < minimumInvestment) {
        throw new ApiError(400, `Minimum investment amount for ${indexDoc.name} is ₹${minimumInvestment}`);
    }

    const slab = await getMatchingInterestSlab(normalizedAmount);

    const rateConfig = resolveRateForInvestment({
        indexDoc,
        slab,
        customDailyRate: null,
    });

    const dailyInterestAmount = Number(
        ((Number(normalizedAmount) * Number(rateConfig.effectiveDailyRate)) / 100).toFixed(2)
    );

    return {
        amount: normalizedAmount,
        walletBalance: Number(user.walletBalance || 0),
        hasSufficientBalance: Number(user.walletBalance || 0) >= normalizedAmount,
        totalPayable: normalizedAmount,
        indexId: indexDoc._id,
        indexName: indexDoc.name,
        indexSymbol: indexDoc.symbol,
        currentValue: Number(indexDoc.currentValue || 0),
        minimumInvestment,
        slabId: slab?._id || null,
        slabTitle: slab?.title || null,
        slabDailyRate: slab?.dailyRate ?? null,
        defaultDailyRate,
        effectiveDailyRate: Number(Number(rateConfig.effectiveDailyRate).toFixed(2)),
        rateSource: rateConfig.rateSource,
        dailyInterestAmount,
        lockPeriodDays,
        minAmount: minimumInvestment,
        totalEstimatedInterest: Number(
            (dailyInterestAmount * Number(lockPeriodDays)).toFixed(2)
        ),
        total30DaysEstimate: Number(
            (dailyInterestAmount * Number(lockPeriodDays)).toFixed(2)
        ),
        indexSnapshot: {
            name: indexDoc.name || '',
            symbol: indexDoc.symbol || '',
            logoUrl: indexDoc.logoUrl || '',
            currentValue: Number(indexDoc.currentValue || 0),
            minimumInvestment,
            lockPeriodDays,
            defaultDailyRate,
        },
        categorySnapshot: {
            name: indexDoc.category?.name || '',
            slug: indexDoc.category?.slug || '',
            color: indexDoc.category?.color || '',
            icon: indexDoc.category?.icon || '',
        },
    };
};

// ─── Unlock / Renew / Reinvest ───────────────────────────────────────────────

export const unlockInvestmentService = async ({ investmentId, userId }) => {
    if (!mongoose.Types.ObjectId.isValid(investmentId)) {
        throw new ApiError(400, 'Invalid investment id');
    }
    if (!userId) {
        throw new ApiError(401, 'User authentication required');
    }

    const session = await mongoose.startSession();
    session.startTransaction({
        readPreference: 'primary',
        readConcern: { level: 'majority' },
        writeConcern: { w: 'majority' },
    });

    try {
        const investment = await Investment.findOne({
            _id: investmentId,
            userId,
            status: 'active',
        }).session(session);

        if (!investment) {
            throw new ApiError(404, 'Active investment not found');
        }

        if (!investment.isLockCompleted) {
            throw new ApiError(
                400,
                `Investment is still locked. Unlock is available after ${investment.lockPeriodDays} days`
            );
        }

        const user = await User.findById(userId).session(session);
        if (!user || !user.isActive) {
            throw new ApiError(404, 'User not found');
        }

        const balanceBefore = Number(user.walletBalance);
        user.walletBalance = Number((balanceBefore + Number(investment.amount)).toFixed(2));
        const balanceAfter = Number(user.walletBalance);

        await user.save({ session });

        investment.status = 'unlocked';
        investment.principalReturnedAt = new Date();

        await investment.save({ session });

        await createInvestmentTransaction({
            session,
            user,
            investment,
            type: 'credit',
            category: 'investment_unlock',
            amount: investment.amount,
            balanceBefore,
            balanceAfter,
            description: `Investment principal unlocked for ${investment.indexSnapshot?.name || 'investment'}`,
            metadata: {
                investmentId: investment._id,
                action: 'investment_unlocked',
                totalInterestEarned: investment.totalInterestEarned,
            },
        });

        await session.commitTransaction();

        const unlockedInvestment = await Investment.findById(investment._id)
            .populate('indexId', 'name symbol logoUrl currentValue minimumInvestment lockPeriodDays defaultDailyRate')
            .populate('categoryId', 'name slug color icon')
            .lean({ virtuals: true });

        return mapInvestmentResponse(unlockedInvestment);
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        await session.endSession();
    }
};

export const renewInvestmentService = async ({ investmentId, userId }) => {
    if (!mongoose.Types.ObjectId.isValid(investmentId)) {
        throw new ApiError(400, 'Invalid investment id');
    }
    if (!userId) {
        throw new ApiError(401, 'User authentication required');
    }

    const session = await mongoose.startSession();
    session.startTransaction({
        readPreference: 'primary',
        readConcern: { level: 'majority' },
        writeConcern: { w: 'majority' },
    });

    try {
        const oldInvestment = await Investment.findOne({
            _id: investmentId,
            userId,
            status: 'unlocked',
        }).session(session);

        if (!oldInvestment) {
            throw new ApiError(400, 'Investment must be unlocked before it can be renewed');
        }

        const user = await User.findById(userId).session(session);
        if (!user || !user.isActive) {
            throw new ApiError(404, 'User not found');
        }

        const amount = Number(oldInvestment.amount);

        if (Number(user.walletBalance) < amount) {
            throw new ApiError(400, 'Insufficient wallet balance to renew this investment');
        }

        const indexDoc = await Index.findOne({ _id: oldInvestment.indexId, isActive: true })
            .populate('category', 'name slug color icon')
            .session(session);

        if (!indexDoc) {
            throw new ApiError(404, 'Index is no longer active. Please reinvest instead.');
        }

        const indexObj = indexDoc.toObject ? indexDoc.toObject() : indexDoc;

        const lockPeriodDays = getIndexLockPeriodDays(indexObj);
        const indexDefaultDailyRate = getIndexDefaultDailyRate(indexObj);
        const minimumInvestment = getIndexMinimumInvestment(indexObj);
        const slab = await getMatchingInterestSlab(amount, session);
        const rateConfig = resolveRateForInvestment({ indexDoc: indexObj, slab, customDailyRate: null });
        const dailyInterestAmount = Number(((amount * rateConfig.effectiveDailyRate) / 100).toFixed(2));

        const balanceBefore = Number(user.walletBalance);
        user.walletBalance = Number((balanceBefore - amount).toFixed(2));
        const balanceAfter = Number(user.walletBalance);
        await user.save({ session });

        const approvedAt = new Date();
        const lockEndsAt = new Date(approvedAt);
        lockEndsAt.setDate(lockEndsAt.getDate() + lockPeriodDays);

        const newInvestmentDocs = await Investment.create(
            [
                {
                    userId: user._id,
                    indexId: indexObj._id,
                    categoryId: indexObj.category?._id || null,
                    orderNumber: generateOrderNumber(),
                    amount,
                    minimumInvestment,
                    status: 'active',
                    lockPeriodDays,
                    daysCompleted: 0,
                    daysRemaining: lockPeriodDays,
                    isLockCompleted: false,
                    orderPlacedAt: approvedAt,
                    approvedAt,
                    lockEndsAt,
                    currentValueSnapshot: Number(indexObj.currentValue || 0),
                    slabId: slab?._id || null,
                    slabDailyRate: rateConfig.slabDailyRate,
                    customDailyRate: rateConfig.customDailyRate,
                    effectiveDailyRate: rateConfig.effectiveDailyRate,
                    dailyInterestAmount,
                    rateSource: rateConfig.rateSource,
                    ...buildInvestmentSnapshot({
                        ...indexObj,
                        minimumInvestment,
                        lockPeriodDays,
                        defaultDailyRate: indexDefaultDailyRate,
                    }),
                },
            ],
            { session }
        );

        const newInvestment = newInvestmentDocs[0];

        oldInvestment.status = 'completed';
        oldInvestment.completedAt = oldInvestment.completedAt || new Date();
        await oldInvestment.save({ session });

        await createInvestmentTransaction({
            session,
            user,
            investment: newInvestment,
            type: 'debit',
            category: 'investment_renew',
            amount,
            balanceBefore,
            balanceAfter,
            description: `Investment renewed for ${newInvestment.indexSnapshot?.name || 'investment'}`,
            metadata: {
                oldInvestmentId: oldInvestment._id,
                newInvestmentId: newInvestment._id,
                action: 'investment_renewed',
            },
        });

        await session.commitTransaction();

        const createdInvestment = await Investment.findById(newInvestment._id)
            .populate('indexId', 'name symbol logoUrl currentValue minimumInvestment lockPeriodDays defaultDailyRate')
            .populate('categoryId', 'name slug color icon')
            .lean({ virtuals: true });

        return mapInvestmentResponse(createdInvestment);
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        await session.endSession();
    }
};

export const reinvestInvestmentService = async ({ investmentId, userId, payload = {} }) => {
    if (!mongoose.Types.ObjectId.isValid(investmentId)) {
        throw new ApiError(400, 'Invalid investment id');
    }
    if (!userId) {
        throw new ApiError(401, 'User authentication required');
    }

    const oldInvestment = await Investment.findOne({
        _id: investmentId,
        userId,
        status: 'unlocked',
    }).lean();

    if (!oldInvestment) {
        throw new ApiError(400, 'Investment must be unlocked before reinvesting');
    }

    const indexId = payload.indexId || String(oldInvestment.indexId);
    const amount = payload.amount ? normalizeAmount(payload.amount) : Number(oldInvestment.amount);

    const newInvestment = await createInvestmentOrderService({
        userId,
        payload: { indexId, amount, customDailyRate: payload.customDailyRate },
    });

    await Investment.findByIdAndUpdate(oldInvestment._id, {
        status: 'closed_reinvested',
    });

    return newInvestment;
};