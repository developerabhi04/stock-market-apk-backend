import Investment from '../modules/market/investment/investment.model.js';
import User from '../modules/user/user.model.js';
import Transaction from '../modules/transaction/transaction.model.js';
import mongoose from 'mongoose';

const DEFAULT_LOCK_PERIOD_DAYS = 30;

const getIstDateString = (date = new Date()) => {
    return new Date(date).toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
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

const runInterestCreditJob = async () => {
    const jobStartTime = new Date();
    const creditDate = new Date();
    const creditDayStart = getStartOfDayUtc(creditDate);
    const creditDayEnd = getEndOfDayUtc(creditDate);

    console.log(`\n💰 [InterestCreditJob] Starting at ${jobStartTime.toISOString()}`);
    console.log(`📅 [InterestCreditJob] Credit date IST: ${getIstDateString(creditDate)}`);

    let totalProcessed = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    try {
        const investments = await Investment.find({
            status: 'active',
            $or: [
                { lastInterestCreditedAt: { $lt: creditDayStart } },
                { lastInterestCreditedAt: null },
                { lastInterestCreditedAt: { $exists: false } },
            ],
        })
            .select(
                '_id userId indexId amount dailyInterestAmount daysCompleted daysRemaining lockPeriodDays isLockCompleted lastInterestCreditedAt totalInterestEarned indexSnapshot effectiveDailyRate status completedAt'
            )
            .lean();

        console.log(`🔍 [InterestCreditJob] Found ${investments.length} active investments to process`);

        if (investments.length === 0) {
            console.log('✅ [InterestCreditJob] No investments to process today');
            return {
                processed: 0,
                skipped: 0,
                failed: 0,
                totalInvestments: 0,
            };
        }

        for (const investmentData of investments) {
            const session = await mongoose.startSession();
            session.startTransaction({
                readPreference: 'primary',
                readConcern: { level: 'majority' },
                writeConcern: { w: 'majority' },
            });

            try {
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

                if (
                    investment.lastInterestCreditedAt &&
                    investment.lastInterestCreditedAt >= creditDayStart &&
                    investment.lastInterestCreditedAt <= creditDayEnd
                ) {
                    await session.abortTransaction();
                    totalSkipped++;
                    console.log(`⏭️ [InterestCreditJob] Skipped ${investment._id}: already credited today`);
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

                const lockPeriodDays = Number(investment.lockPeriodDays || DEFAULT_LOCK_PERIOD_DAYS);
                const updatedDaysCompleted = Number(investment.daysCompleted || 0) + 1;

                investment.totalInterestEarned = Number(
                    (Number(investment.totalInterestEarned || 0) + dailyAmount).toFixed(2)
                );

                investment.daysCompleted = updatedDaysCompleted;
                investment.daysRemaining = Math.max(lockPeriodDays - updatedDaysCompleted, 0);
                investment.lastInterestCreditedAt = new Date(creditDate);

                if (updatedDaysCompleted >= lockPeriodDays) {
                    investment.isLockCompleted = true;

                    if (!investment.completedAt) {
                        investment.completedAt = new Date();
                        console.log(
                            `🔓 [InterestCreditJob] Investment ${investment._id} unlocked after ${lockPeriodDays} days`
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
                                creditDate: new Date(creditDate),
                                daysCompleted: investment.daysCompleted,
                                daysRemaining: investment.daysRemaining,
                                isLockCompleted: investment.isLockCompleted,
                            },
                            tradeDetails: {
                                investmentId: investment._id,
                                indexId: investment.indexId,
                                stockSymbol: investment.indexSnapshot?.symbol || '',
                                dailyRate: investment.effectiveDailyRate || 0,
                                dailyInterestAmount: dailyAmount,
                                creditDate: new Date(creditDate),
                            },
                        },
                    ],
                    { session }
                );

                await session.commitTransaction();

                totalProcessed++;
                console.log(
                    `✅ [InterestCreditJob] Credited ₹${dailyAmount} → User ${user._id} | Investment ${investment._id} | Day ${investment.daysCompleted}`
                );
            } catch (investmentError) {
                await session.abortTransaction();
                totalFailed++;
                console.error(
                    `❌ [InterestCreditJob] Failed for investment ${investmentData._id}:`,
                    investmentError.message
                );
            } finally {
                session.endSession();
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
    console.log(`   📅 Credit Date (IST): ${getIstDateString(creditDate)}\n`);

    return {
        processed: totalProcessed,
        skipped: totalSkipped,
        failed: totalFailed,
        totalInvestments: totalProcessed + totalSkipped + totalFailed,
    };
};

export default runInterestCreditJob;