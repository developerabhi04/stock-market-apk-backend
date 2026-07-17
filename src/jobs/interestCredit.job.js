import Investment from '../modules/market/investment/investment.model.js';
import User from '../modules/user/user.model.js';
import Transaction from '../modules/transaction/transaction.model.js';
import mongoose from 'mongoose';

const IST_TIMEZONE = 'Asia/Kolkata';

const getIstDateParts = (date = new Date()) => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: IST_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });

    const parts = formatter.formatToParts(new Date(date));
    const map = {};

    for (const part of parts) {
        if (part.type !== 'literal') {
            map[part.type] = part.value;
        }
    }

    return {
        year: Number(map.year),
        month: Number(map.month),
        day: Number(map.day),
    };
};

const getIstDateKey = (date = new Date()) => {
    const { year, month, day } = getIstDateParts(date);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const getIstDisplayDate = (date = new Date()) =>
    new Date(date).toLocaleDateString('en-IN', {
        timeZone: IST_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });

const addDaysToDateKey = (dateKey, days) => {
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + days);

    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
        date.getUTCDate()
    ).padStart(2, '0')}`;
};

const isEligibleForInterestCreditToday = (investment, now = new Date()) => {
    const todayIstKey = getIstDateKey(now);
    const purchaseBaseDate = investment.approvedAt || investment.orderPlacedAt || investment.createdAt;

    if (!purchaseBaseDate) {
        return false;
    }

    const purchaseIstKey = getIstDateKey(purchaseBaseDate);
    const firstCreditIstKey = addDaysToDateKey(purchaseIstKey, 1);

    if (todayIstKey < firstCreditIstKey) {
        return false;
    }

    if (investment.lastInterestCreditedAt) {
        const lastCreditIstKey = getIstDateKey(investment.lastInterestCreditedAt);
        if (lastCreditIstKey === todayIstKey) {
            return false;
        }
    }

    const lockPeriodDays = Number(investment.lockPeriodDays || 0);
    const daysCompleted = Number(investment.daysCompleted || 0);

    if (!Number.isInteger(lockPeriodDays) || lockPeriodDays <= 0) {
        return false;
    }

    if (daysCompleted >= lockPeriodDays) {
        return false;
    }

    return true;
};

const runInterestCreditJob = async () => {
    const jobStartTime = new Date();
    const todayIstKey = getIstDateKey(jobStartTime);

    console.log(`\n💰 [InterestCreditJob] Starting at ${jobStartTime.toISOString()}`);
    console.log(`📅 [InterestCreditJob] Today IST: ${getIstDisplayDate(jobStartTime)} (${todayIstKey})`);

    let totalProcessed = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    try {
        const investments = await Investment.find({ status: 'active' })
            .select(
                '_id userId indexId amount dailyInterestAmount daysCompleted daysRemaining lockPeriodDays isLockCompleted lastInterestCreditedAt totalInterestEarned indexSnapshot effectiveDailyRate status completedAt approvedAt orderPlacedAt createdAt'
            )
            .lean();

        console.log(`🔍 [InterestCreditJob] Found ${investments.length} active investments to scan`);

        if (investments.length === 0) {
            console.log('✅ [InterestCreditJob] No active investments found');
            return {
                processed: 0,
                skipped: 0,
                failed: 0,
                totalInvestments: 0,
            };
        }

        for (const investmentData of investments) {
            if (!isEligibleForInterestCreditToday(investmentData, jobStartTime)) {
                totalSkipped++;
                console.log(`⏭️ [InterestCreditJob] Skipped ${investmentData._id}: not eligible for today's IST credit`);
                continue;
            }

            const session = await mongoose.startSession();

            try {
                session.startTransaction({
                    readPreference: 'primary',
                    readConcern: { level: 'majority' },
                    writeConcern: { w: 'majority' },
                });

                const investment = await Investment.findOne({
                    _id: investmentData._id,
                    status: 'active',
                }).session(session);

                if (!investment) {
                    await session.abortTransaction();
                    totalSkipped++;
                    console.log(`⏭️ [InterestCreditJob] Skipped ${investmentData._id}: no longer active`);
                    continue;
                }

                if (!isEligibleForInterestCreditToday(investment, jobStartTime)) {
                    await session.abortTransaction();
                    totalSkipped++;
                    console.log(`⏭️ [InterestCreditJob] Skipped ${investment._id}: already credited or not yet eligible`);
                    continue;
                }

                const lockPeriodDays = Number(investment.lockPeriodDays);
                if (!Number.isInteger(lockPeriodDays) || lockPeriodDays <= 0) {
                    await session.abortTransaction();
                    totalSkipped++;
                    console.log(`⏭️ [InterestCreditJob] Skipped ${investment._id}: invalid lock period days`);
                    continue;
                }

                const user = await User.findById(investment.userId).session(session);
                if (!user || !user.isActive) {
                    await session.abortTransaction();
                    totalSkipped++;
                    console.log(`⏭️ [InterestCreditJob] Skipped ${investment._id}: user not found or inactive`);
                    continue;
                }

                const dailyAmount = Number(investment.dailyInterestAmount || 0);
                if (dailyAmount <= 0) {
                    await session.abortTransaction();
                    totalSkipped++;
                    console.log(`⏭️ [InterestCreditJob] Skipped ${investment._id}: daily interest amount is 0`);
                    continue;
                }

                const balanceBefore = Number(user.walletBalance || 0);
                user.walletBalance = Number((balanceBefore + dailyAmount).toFixed(2));
                const balanceAfter = Number(user.walletBalance);
                await user.save({ session });

                const updatedDaysCompleted = Number(investment.daysCompleted || 0) + 1;

                investment.totalInterestEarned = Number(
                    (Number(investment.totalInterestEarned || 0) + dailyAmount).toFixed(2)
                );
                investment.daysCompleted = updatedDaysCompleted;
                investment.daysRemaining = Math.max(lockPeriodDays - updatedDaysCompleted, 0);
                investment.lastInterestCreditedAt = new Date();

                if (updatedDaysCompleted >= lockPeriodDays) {
                    investment.isLockCompleted = true;

                    if (!investment.completedAt) {
                        investment.completedAt = new Date();
                        console.log(
                            `🔓 [InterestCreditJob] Investment ${investment._id} completed after ${lockPeriodDays} credits`
                        );
                    }
                } else {
                    investment.isLockCompleted = false;
                }

                await investment.save({ session });

                await Transaction.create(
                    [
                        {
                            userId: user._id,
                            type: 'credit',
                            category: 'investment_interest',
                            amount: dailyAmount,
                            balanceBefore,
                            balanceAfter,
                            status: 'completed',
                            description: `Daily interest credited for ${investment.indexSnapshot?.name || 'investment'} — Day ${investment.daysCompleted}`,
                            metadata: {
                                investmentId: investment._id,
                                action: 'daily_interest_credit',
                                creditDate: new Date(),
                                creditDateIst: todayIstKey,
                                daysCompleted: investment.daysCompleted,
                                daysRemaining: investment.daysRemaining,
                                isLockCompleted: investment.isLockCompleted,
                                lockPeriodDays,
                            },
                            tradeDetails: {
                                investmentId: investment._id,
                                indexId: investment.indexId,
                                stockSymbol: investment.indexSnapshot?.symbol || '',
                                dailyRate: investment.effectiveDailyRate || 0,
                                dailyInterestAmount: dailyAmount,
                                creditDate: new Date(),
                                creditDateIst: todayIstKey,
                                lockPeriodDays,
                            },
                        },
                    ],
                    { session }
                );

                await session.commitTransaction();

                totalProcessed++;
                console.log(
                    `✅ [InterestCreditJob] Credited ₹${dailyAmount} → User ${user._id} | Investment ${investment._id} | Day ${investment.daysCompleted}/${lockPeriodDays}`
                );
            } catch (investmentError) {
                await session.abortTransaction();
                totalFailed++;
                console.error(
                    `❌ [InterestCreditJob] Failed for investment ${investmentData._id}:`,
                    investmentError.message
                );
            } finally {
                await session.endSession();
            }
        }
    } catch (outerError) {
        console.error('❌ [InterestCreditJob] Fatal error during job run:', outerError.message);
    }

    const jobEndTime = new Date();
    const duration = ((jobEndTime - jobStartTime) / 1000).toFixed(2);

    console.log(`\n📊 [InterestCreditJob] Completed in ${duration}s`);
    console.log(`   ✅ Processed : ${totalProcessed}`);
    console.log(`   ⏭️ Skipped   : ${totalSkipped}`);
    console.log(`   ❌ Failed    : ${totalFailed}`);
    console.log(`   📅 Credit Date (IST): ${getIstDisplayDate(jobStartTime)}\n`);

    return {
        processed: totalProcessed,
        skipped: totalSkipped,
        failed: totalFailed,
        totalInvestments: totalProcessed + totalSkipped + totalFailed,
    };
};

export default runInterestCreditJob;