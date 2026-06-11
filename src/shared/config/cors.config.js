// src/shared/config/cors.config.js
import { env } from './env.js';

const allowedOrigins =
    env.CORS_ORIGIN === '*'
        ? '*'
        : env.CORS_ORIGIN
            .split(',')
            .map((o) => o.trim().replace(/\/$/, ''))
            .filter(Boolean);

export const corsOptions = {
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        const normalizedOrigin = origin.replace(/\/$/, '');

        if (allowedOrigins === '*') return callback(null, true);

        if (allowedOrigins.includes(normalizedOrigin)) {
            return callback(null, true);
        }

        return callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Limit'],
    credentials: true,
    optionsSuccessStatus: 200,
    maxAge: 86400,
};

export default corsOptions;