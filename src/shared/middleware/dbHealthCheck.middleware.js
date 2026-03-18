import mongoose from 'mongoose';
import { getConnectionStateName } from '../database/dbStates.js';

export const dbHealthCheck = (req, res, next) => {
    const readyState = mongoose.connection.readyState;

    if (readyState !== 1) {
        return res.status(503).json({
            success: false,
            message: 'Database connection unavailable',
            status: getConnectionStateName(readyState)
        });
    }

    next();
};

export const detailedHealthCheck = async (req, res) => {
    const readyState = mongoose.connection.readyState;
    const isHealthy = readyState === 1;

    const healthData = {
        status: isHealthy ? 'healthy' : 'unhealthy',
        database: {
            state: getConnectionStateName(readyState),
            host: mongoose.connection.host || 'N/A',
            port: mongoose.connection.port || 'N/A',
            name: mongoose.connection.name || 'N/A'
        },
        server: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            nodeVersion: process.version
        },
        timestamp: new Date().toISOString()
    };

    if (isHealthy) {
        try {
            await mongoose.connection.db.admin().ping();
            healthData.database.ping = 'successful';
        } catch (error) {
            healthData.database.ping = 'failed';
            healthData.database.error = error.message;
        }
    }

    res.status(isHealthy ? 200 : 503).json(healthData);
};
