import cron from 'node-cron';
import runInterestCreditJob from './interestCredit.job.js';
import runMarketSyncJob from './marketSync.job.js';
import runNotificationJob from './notification.job.js';

export const registerCronJobs = () => {
    console.log('⏰ Registering cron jobs...');

    cron.schedule(
        '0 8 * * *',
        async () => {
            console.log('⏰ [InterestCreditJob] Triggered');
            await runInterestCreditJob();
        },
        {
            timezone: 'Asia/Kolkata',
        }
    );

    cron.schedule(
        '0 18 * * *',
        async () => {
            console.log('⏰ [MarketSyncJob] Triggered');
            await runMarketSyncJob();
        },
        {
            timezone: 'Asia/Kolkata',
        }
    );

    cron.schedule(
        '55 7,12,18 * * *',
        async () => {
            console.log('⏰ [NotificationJob] Triggered');
            await runNotificationJob();
        },
        {
            timezone: 'Asia/Kolkata',
        }
    );

    console.log('✅ Cron jobs registered successfully');
};