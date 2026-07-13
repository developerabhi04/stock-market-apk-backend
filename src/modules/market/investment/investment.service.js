import mongoose from 'mongoose';
import Investment from './investment.model.js';
import Index from '../index/index.model.js';
import User from '../../user/user.model.js';
import Transaction from '../../transaction/transaction.model.js';
import InterestSlab from '../interest-slab/interestSlab.model.js';
import { ApiError } from '../../../shared/utils/apiError.js';

const MAX_INVESTMENT_AMOUNT = 500000;
const DEFAULT_LOCK_PERIOD_DAYS = 30;

const normalizeAmount = (value) => {
    const numericValue = Number(value);

    if (Number.isNaN(numericValue)) {
        throw new ApiError(400, 'Amount must be a valid number');
    }

    return Number(numericValue.toFixed(2));
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

    return minimumInvestment;
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
    const lockPeriodDays = Number(investment.lockPeriodDays || DEFAULT_LOCK_PERIOD_DAYS);
    const progressPercent =
        lockPeriodDays > 0
            ? Math.min(Number(((daysCompleted / lockPeriodDays) * 100).toFixed(2)), 100)
            : 0;

    return {
        ...investment,
        id: investment._id,
        amount,
        totalInterestEarned,
        effectiveDailyRate,
        dailyInterestAmount,
        daysCompleted,
        daysRemaining,
        lockPeriodDays,
        progressPercent,
        canCancel: investment.status === 'active' && investment.isLockCompleted === true,
        isActiveInvestment: investment.status === 'active',
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

    if (amount < minimumInvestment) {
        throw new ApiError(400, `Minimum investment amount for ${indexDoc.name} is ₹${minimumInvestment}`);
    }

    if (amount > MAX_INVESTMENT_AMOUNT) {
        throw new ApiError(400, `Maximum investment amount is ₹${MAX_INVESTMENT_AMOUNT}`);
    }

    const slab = await getMatchingInterestSlab(amount);

    const hasCustomRate =
        payload.customDailyRate !== null &&
        typeof payload.customDailyRate !== 'undefined' &&
        payload.customDailyRate !== '';

    const effectiveDailyRate = hasCustomRate
        ? Number(payload.customDailyRate)
        : slab?.dailyRate ?? indexDoc.defaultDailyRate ?? null;

    if (effectiveDailyRate === null || typeof effectiveDailyRate === 'undefined' || Number.isNaN(Number(effectiveDailyRate))) {
        throw new ApiError(400, 'No daily rate available for this investment amount');
    }

    if (Number(effectiveDailyRate) < 0) {
        throw new ApiError(400, 'Daily rate cannot be negative');
    }

    const normalizedEffectiveDailyRate = Number(Number(effectiveDailyRate).toFixed(2));
    const dailyInterestAmount = Number(((amount * normalizedEffectiveDailyRate) / 100).toFixed(2));

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
        lockEndsAt.setDate(lockEndsAt.getDate() + DEFAULT_LOCK_PERIOD_DAYS);

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
                    status: 'active',
                    lockPeriodDays: DEFAULT_LOCK_PERIOD_DAYS,
                    daysCompleted: 0,
                    daysRemaining: DEFAULT_LOCK_PERIOD_DAYS,
                    isLockCompleted: false,
                    orderPlacedAt: approvedAt,
                    approvedAt,
                    approvedBy: null,
                    lockEndsAt,
                    currentValueSnapshot: Number(indexDoc.currentValue || 0),
                    slabId: slab?._id || null,
                    slabDailyRate: slab?.dailyRate ?? null,
                    customDailyRate: hasCustomRate
                        ? Number(Number(payload.customDailyRate).toFixed(2))
                        : null,
                    effectiveDailyRate: normalizedEffectiveDailyRate,
                    dailyInterestAmount,
                    adminRemark: '',
                    rejectionReason: '',
                    ...buildInvestmentSnapshot(indexDoc),
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
            },
        });

        await session.commitTransaction();

        const createdInvestment = await Investment.findById(investment._id)
            .populate('indexId', 'name symbol logoUrl currentValue minimumInvestment')
            .populate('categoryId', 'name slug color icon')
            .lean({ virtuals: true });

        return mapInvestmentResponse(createdInvestment);
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
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
            .populate('indexId', 'name symbol logoUrl currentValue minimumInvestment')
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
        .populate('indexId', 'name symbol logoUrl currentValue minimumInvestment')
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
            .populate('indexId', 'name symbol logoUrl currentValue minimumInvestment')
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
        .populate('indexId', 'name symbol logoUrl currentValue minimumInvestment')
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

    const normalizedCustomDailyRate = Number(customDailyRate);

    if (Number.isNaN(normalizedCustomDailyRate) || normalizedCustomDailyRate < 0) {
        throw new ApiError(400, 'Custom daily rate must be a valid non-negative number');
    }

    const investment = await Investment.findById(investmentId);

    if (!investment) {
        throw new ApiError(404, 'Investment not found');
    }

    if (investment.status !== 'active') {
        throw new ApiError(400, 'Rate override is allowed only for active investments');
    }

    investment.customDailyRate = Number(normalizedCustomDailyRate.toFixed(2));
    investment.effectiveDailyRate = Number(normalizedCustomDailyRate.toFixed(2));
    investment.dailyInterestAmount = Number(
        ((Number(investment.amount) * Number(investment.effectiveDailyRate)) / 100).toFixed(2)
    );
    investment.adminRemark = adminRemark?.trim() || investment.adminRemark || '';

    await investment.save();

    const updatedInvestment = await Investment.findById(investment._id)
        .populate('userId', 'fullName phoneNumber walletBalance')
        .populate('indexId', 'name symbol logoUrl currentValue minimumInvestment')
        .populate('categoryId', 'name slug color icon')
        .lean({ virtuals: true });

    return mapInvestmentResponse(updatedInvestment);
};

export const approveInvestmentOrderAdminService = async ({ investmentId }) => {
    if (!mongoose.Types.ObjectId.isValid(investmentId)) {
        throw new ApiError(400, 'Invalid investment id');
    }

    const investment = await Investment.findById(investmentId)
        .populate('userId', 'fullName phoneNumber walletBalance')
        .populate('indexId', 'name symbol logoUrl currentValue minimumInvestment')
        .populate('categoryId', 'name slug color icon')
        .lean({ virtuals: true });

    if (!investment) {
        throw new ApiError(404, 'Investment not found');
    }

    if (investment.status !== 'active') {
        throw new ApiError(400, 'This investment is not awaiting approval');
    }

    return mapInvestmentResponse(investment);
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

        if (!investment.isLockCompleted) {
            throw new ApiError(400, 'Investment is still locked. Cancel is allowed after 30 days');
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
            },
        });

        await session.commitTransaction();

        const cancelledInvestment = await Investment.findById(investment._id)
            .populate('userId', 'fullName phoneNumber walletBalance')
            .populate('indexId', 'name symbol logoUrl currentValue minimumInvestment')
            .populate('categoryId', 'name slug color icon')
            .lean({ virtuals: true });

        return mapInvestmentResponse(cancelledInvestment);
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
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

        if (investment.daysCompleted >= Number(investment.lockPeriodDays || DEFAULT_LOCK_PERIOD_DAYS)) {
            investment.daysCompleted = Number(investment.lockPeriodDays || DEFAULT_LOCK_PERIOD_DAYS);
            investment.isLockCompleted = true;
            investment.daysRemaining = 0;
            investment.completedAt = investment.completedAt || new Date();
        } else {
            investment.daysRemaining = Math.max(
                Number(investment.lockPeriodDays || DEFAULT_LOCK_PERIOD_DAYS) - Number(investment.daysCompleted),
                0
            );
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
            },
        });

        await session.commitTransaction();

        return {
            investmentId: investment._id,
            creditedAmount: Number(investment.dailyInterestAmount),
            daysCompleted: Number(investment.daysCompleted),
            daysRemaining: Number(investment.daysRemaining),
            isLockCompleted: investment.isLockCompleted,
        };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

export const getActiveInvestmentsForInterestCreditService = async () => {
    const investments = await Investment.find({
        status: 'active',
    })
        .select(
            '_id userId amount status dailyInterestAmount daysCompleted daysRemaining lockPeriodDays isLockCompleted lastInterestCreditedAt totalInterestEarned indexId indexSnapshot effectiveDailyRate'
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

    if (normalizedAmount < minimumInvestment) {
        throw new ApiError(400, `Minimum investment amount for ${indexDoc.name} is ₹${minimumInvestment}`);
    }

    if (normalizedAmount > MAX_INVESTMENT_AMOUNT) {
        throw new ApiError(400, `Maximum investment amount is ₹${MAX_INVESTMENT_AMOUNT}`);
    }

    const slab = await getMatchingInterestSlab(normalizedAmount);

    const effectiveDailyRate = slab?.dailyRate ?? indexDoc.defaultDailyRate ?? null;

    if (effectiveDailyRate === null || typeof effectiveDailyRate === 'undefined') {
        throw new ApiError(400, 'No daily rate available for this investment amount');
    }

    const dailyInterestAmount = Number(
        ((Number(normalizedAmount) * Number(effectiveDailyRate)) / 100).toFixed(2)
    );

    return {
        amount: normalizedAmount,
        walletBalance: Number(user.walletBalance || 0),
        hasSufficientBalance: Number(user.walletBalance || 0) >= normalizedAmount,
        indexId: indexDoc._id,
        indexName: indexDoc.name,
        indexSymbol: indexDoc.symbol,
        currentValue: Number(indexDoc.currentValue || 0),
        minimumInvestment,
        maximumInvestment: MAX_INVESTMENT_AMOUNT,
        slabId: slab?._id || null,
        slabTitle: slab?.title || null,
        slabDailyRate: slab?.dailyRate ?? null,
        defaultDailyRate: indexDoc.defaultDailyRate ?? null,
        effectiveDailyRate: Number(Number(effectiveDailyRate).toFixed(2)),
        dailyInterestAmount,
        lockPeriodDays: DEFAULT_LOCK_PERIOD_DAYS,
        totalEstimatedInterest: Number(
            (dailyInterestAmount * Number(DEFAULT_LOCK_PERIOD_DAYS)).toFixed(2)
        ),
    };
};