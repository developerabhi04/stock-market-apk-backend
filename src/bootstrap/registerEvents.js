import { disconnectDB } from '../shared/database/db.js';
import {
    handleUnhandledRejection,
    handleUncaughtException
} from '../shared/middleware/errorHandler.middleware.js';

export const registerEvents = () => {
    handleUncaughtException();
    handleUnhandledRejection();
};

export const registerGracefulShutdown = (server) => {
    const gracefulShutdown = async (signal) => {
        console.log(`\n⚠️ ${signal} received. Starting graceful shutdown...`);

        try {
            server.close(async () => {
                try {
                    await disconnectDB();
                    console.log('✅ Graceful shutdown completed');
                    process.exit(0);
                } catch (error) {
                    console.error('❌ Error during shutdown:', error);
                    process.exit(1);
                }
            });
        } catch (error) {
            console.error('❌ Error during shutdown:', error);
            process.exit(1);
        }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
};

export default registerEvents;