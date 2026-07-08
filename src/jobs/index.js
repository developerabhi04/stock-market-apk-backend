import cron from 'node-cron';
import runMarketSyncJob from './marketSync.job.js';
import runNotificationJob from './notification.job.js';
import runCleanupJob from './cleanup.job.js';
import runInterestCreditJob from './interestCredit.job.js';

export const registerJobs = () => {
    console.log('⏰ Registering cron jobs...');

    // Every 15 mins — market sync
    cron.schedule(
        '*/15 * * * *',
        async () => {
            try {
                console.log('⏰ [MarketSyncJob] Triggered');
                await runMarketSyncJob();
            } catch (error) {
                console.error('❌ [MarketSyncJob] Failed:', error?.message || error);
            }
        },
        {
            noOverlap: true,
        }
    );

    // Every 5 mins — notifications
    cron.schedule(
        '*/5 * * * *',
        async () => {
            try {
                console.log('⏰ [NotificationJob] Triggered');
                await runNotificationJob();
            } catch (error) {
                console.error('❌ [NotificationJob] Failed:', error?.message || error);
            }
        },
        {
            noOverlap: true,
        }
    );

    // Daily at 2:00 AM — cleanup
    cron.schedule(
        '0 2 * * *',
        async () => {
            try {
                console.log('⏰ [CleanupJob] Triggered at 2:00 AM');
                await runCleanupJob();
            } catch (error) {
                console.error('❌ [CleanupJob] Failed:', error?.message || error);
            }
        },
        {
            noOverlap: true,
        }
    );

    // Daily at 4:00 AM IST — interest credit
    cron.schedule(
        '0 4 * * *',
        async () => {
            try {
                console.log('⏰ [InterestCreditJob] Triggered at 4:00 AM IST');
                await runInterestCreditJob();
            } catch (error) {
                console.error('❌ [InterestCreditJob] Failed:', error?.message || error);
            }
        },
        {
            timezone: 'Asia/Kolkata',
            noOverlap: true,
        }
    );

    console.log('✅ Cron jobs registered successfully');
};

export default registerJobs;