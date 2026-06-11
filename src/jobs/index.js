import cron from 'node-cron';
import runMarketSyncJob from './marketSync.job.js';
import runNotificationJob from './notification.job.js';
import runCleanupJob from './cleanup.job.js';

export const registerJobs = () => {
    console.log('⏰ Registering cron jobs...');

    cron.schedule('*/15 * * * *', async () => {
        await runMarketSyncJob();
    });

    cron.schedule('*/5 * * * *', async () => {
        await runNotificationJob();
    });

    cron.schedule('0 2 * * *', async () => {
        await runCleanupJob();
    });

    console.log('✅ Cron jobs registered successfully');
};

export default registerJobs;