import mongoose from 'mongoose';
import User from '../user/user.model.js';
import Referral from './referral.model.js';
import Transaction from '../transaction/transaction.model.js';
import { ApiError } from '../../shared/utils/apiError.js';

export const REFERRAL_BONUS_AMOUNT = 250;
export const MIN_FIRST_RECHARGE_FOR_BONUS = 5000;

const getSessionQuery = (query, session) => {
    return session ? query.session(session) : query;
};

/**
 * Called after signup when a referral code is submitted.
 */
export const applyReferralOnSignupService = async ({
    newUserId,
    referralCode,
}) => {
    if (!referralCode) {
        return null;
    }

    const code = String(referralCode)
        .trim()
        .toUpperCase();

    if (!code) {
        return null;
    }

    const referrer = await User.findOne({
        referralCode: code,
        isActive: true,
    });

    if (!referrer) {
        return null;
    }

    if (referrer._id.toString() === newUserId.toString()) {
        return null;
    }

    const newUser = await User.findById(newUserId);

    if (!newUser) {
        throw new ApiError(404, 'New user not found');
    }

    if (newUser.referredBy) {
        return null;
    }

    const existingReferral = await Referral.findOne({
        referee: newUserId,
    });

    if (existingReferral) {
        return existingReferral;
    }

    newUser.referredBy = referrer._id;
    await newUser.save();

    return Referral.create({
        referrer: referrer._id,
        referee: newUser._id,
        referralCodeUsed: code,
        status: 'pending',
        rewardAmount: 0,
        triggerRechargeAmount: null,
        rewardedAt: null,
    });
};

/**
 * Called only after an add_money transaction has been approved.
 *
 * This function:
 * - checks that the current recharge is at least ₹5,000;
 * - confirms that this is the user's first approved recharge;
 * - credits both wallets;
 * - creates both ledger entries;
 * - marks the referral as rewarded.
 *
 * All database writes use the provided MongoDB session.
 * Notifications are deliberately not sent here.
 */
export const maybeRewardReferralOnRechargeService = async ({
    userId,
    rechargeAmount,
    transactionId,
    session,
}) => {
    const amount = Number(rechargeAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
        throw new ApiError(
            400,
            'Invalid recharge amount'
        );
    }

    if (amount < MIN_FIRST_RECHARGE_FOR_BONUS) {
        return null;
    }

    if (!transactionId) {
        throw new ApiError(
            400,
            'Source recharge transaction ID is required'
        );
    }

    const userQuery = User.findById(userId);
    const user = await getSessionQuery(
        userQuery,
        session
    );

    if (!user) {
        throw new ApiError(
            404,
            'Recharge user not found'
        );
    }

    /*
     * If the user was not referred, there is no referral reward.
     * If the reward was already given, do not reward again.
     */
    if (
        !user.referredBy ||
        user.referralRewardGiven
    ) {
        return null;
    }

    /*
     * The current recharge has already been changed
     * to completed by approvePaymentService().
     *
     * Check whether this user has any other completed
     * add_money transaction. If yes, this is not the
     * first approved recharge, so no referral reward.
     */
    const previousApprovedRechargeQuery =
        Transaction.exists({
            userId,
            category: 'add_money',
            status: 'completed',
            _id: {
                $ne: transactionId,
            },
        });

    const previousApprovedRecharge =
        await getSessionQuery(
            previousApprovedRechargeQuery,
            session
        );

    if (previousApprovedRecharge) {
        return null;
    }

    const referralQuery = Referral.findOne({
        referee: userId,
        status: 'pending',
    });

    const referral = await getSessionQuery(
        referralQuery,
        session
    );

    if (!referral) {
        return null;
    }

    const referrerQuery = User.findById(
        user.referredBy
    );

    const referrer = await getSessionQuery(
        referrerQuery,
        session
    );

    if (!referrer) {
        throw new ApiError(
            400,
            'Referral owner no longer exists'
        );
    }

    if (
        referrer._id.toString() ===
        user._id.toString()
    ) {
        throw new ApiError(
            400,
            'Invalid self-referral relationship'
        );
    }

    const refereeBalanceBefore = Number(
        user.walletBalance || 0
    );

    const referrerBalanceBefore = Number(
        referrer.walletBalance || 0
    );

    const refereeBalanceAfter =
        refereeBalanceBefore +
        REFERRAL_BONUS_AMOUNT;

    const referrerBalanceAfter =
        referrerBalanceBefore +
        REFERRAL_BONUS_AMOUNT;

    /*
     * Update referee wallet.
     */
    user.walletBalance = refereeBalanceAfter;
    user.referralRewardGiven = true;

    /*
     * Update referrer wallet.
     */
    referrer.walletBalance = referrerBalanceAfter;

    await user.save(
        session ? { session } : undefined
    );

    await referrer.save(
        session ? { session } : undefined
    );

    /*
     * Mark the referral as rewarded.
     */
    referral.status = 'rewarded';
    referral.rewardAmount =
        REFERRAL_BONUS_AMOUNT;
    referral.triggerRechargeAmount = amount;
    referral.rewardedAt = new Date();

    await referral.save(
        session ? { session } : undefined
    );

    /*
     * Two transactions are created in one operation.
     * ordered: true is required when using a session
     * with multiple documents.
     */
    const transactionOptions = session
        ? {
            session,
            ordered: true,
        }
        : {
            ordered: true,
        };

    await Transaction.create(
        [
            {
                userId: user._id,
                type: 'credit',
                category: 'referral_bonus',
                amount: REFERRAL_BONUS_AMOUNT,
                balanceBefore: refereeBalanceBefore,
                balanceAfter: refereeBalanceAfter,
                status: 'completed',
                description:
                    'Referral bonus for first approved recharge',
                metadata: {
                    referralId: referral._id,
                    sourceTransactionId: transactionId,
                    role: 'referee',
                },
            },

            {
                userId: referrer._id,
                type: 'credit',
                category: 'referral_bonus',
                amount: REFERRAL_BONUS_AMOUNT,
                balanceBefore: referrerBalanceBefore,
                balanceAfter: referrerBalanceAfter,
                status: 'completed',
                description:
                    `Referral bonus: ${user.fullName} completed first approved recharge`,
                metadata: {
                    referralId: referral._id,
                    sourceTransactionId: transactionId,
                    role: 'referrer',
                },
            },
        ],
        transactionOptions
    );

    return {
        referralId: referral._id,
        refereeId: user._id,
        referrerId: referrer._id,
        refereeName: user.fullName,
        referrerName: referrer.fullName,
        rewardAmount: REFERRAL_BONUS_AMOUNT,
        triggerRechargeAmount: amount,
    };
};

/**
 * User referral summary.
 */
export const getMyReferralInfoService = async ({ userId }) => {
    const user = await User.findById(userId)
        .select('referralCode')
        .lean();

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    const [
        totalInvited,
        totalRewarded,
        totalEarned,
    ] = await Promise.all([
        Referral.countDocuments({
            referrer: userId,
        }),

        Referral.countDocuments({
            referrer: userId,
            status: 'rewarded',
        }),

        Referral.aggregate([
            {
                $match: {
                    referrer: userObjectId,
                    status: 'rewarded',
                },
            },
            {
                $group: {
                    _id: null,
                    total: {
                        $sum: '$rewardAmount',
                    },
                },
            },
        ]),
    ]);

    const websiteUrl = (
        process.env.WEBSITE_URL ||
        'https://tradehub-website-two.vercel.app'
    ).replace(/\/$/, '');

    const referralCode = user.referralCode || '';

    return {
        referralCode,
        shareLink: `${websiteUrl}/?ref=${referralCode}`,
        totalInvited,
        totalRewarded,
        totalPending: Math.max(
            totalInvited - totalRewarded,
            0
        ),
        totalEarned: totalEarned?.[0]?.total || 0,
        rewardPerReferral: REFERRAL_BONUS_AMOUNT,
        minRechargeRequired: MIN_FIRST_RECHARGE_FOR_BONUS,
    };
};

/**
 * User referral history.
 */
export const getMyReferralHistoryService = async ({
    userId,
    page = 1,
    limit = 20,
}) => {
    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(
        Math.max(Number(limit) || 20, 1),
        100
    );

    const filter = {
        referrer: userId,
    };

    const [referrals, total] = await Promise.all([
        Referral.find(filter)
            .populate(
                'referee',
                'fullName phoneNumber createdAt'
            )
            .sort({ createdAt: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)
            .lean(),

        Referral.countDocuments(filter),
    ]);

    return {
        referrals,
        totalPages: Math.ceil(total / limitNum),
        currentPage: pageNum,
        total,
    };
};

/**
 * Admin referral list.
 */
export const getAllReferralsAdminService = async ({
    page = 1,
    limit = 20,
    status,
}) => {
    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(
        Math.max(Number(limit) || 20, 1),
        100
    );

    const filter = {};

    if (status) {
        filter.status = status;
    }

    const [
        referrals,
        total,
        summary,
    ] = await Promise.all([
        Referral.find(filter)
            .populate(
                'referrer',
                'fullName phoneNumber referralCode'
            )
            .populate(
                'referee',
                'fullName phoneNumber createdAt'
            )
            .sort({ createdAt: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)
            .lean(),

        Referral.countDocuments(filter),

        Referral.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalReward: { $sum: '$rewardAmount' },
                },
            },
        ]),
    ]);

    return {
        referrals,
        totalPages: Math.ceil(total / limitNum),
        currentPage: pageNum,
        total,
        summary,
    };
};

/**
 * Admin referral statistics.
 */
export const getReferralStatsAdminService = async () => {
    const [
        totalReferrals,
        totalRewarded,
        totalPending,
        totalPaidOut,
    ] = await Promise.all([
        Referral.countDocuments(),

        Referral.countDocuments({
            status: 'rewarded',
        }),

        Referral.countDocuments({
            status: 'pending',
        }),

        Referral.aggregate([
            {
                $match: {
                    status: 'rewarded',
                },
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$rewardAmount' },
                },
            },
        ]),
    ]);

    return {
        totalReferrals,
        totalRewarded,
        totalPending,
        totalPaidOut:
            (totalPaidOut?.[0]?.total || 0) * 2,
    };
};