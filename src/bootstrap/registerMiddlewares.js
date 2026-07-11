import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import mongoSanitizeMiddleware from '../shared/middleware/mongoSanitize.middleware.js';
import { config } from '../shared/config/config.js';
import {
    dbHealthCheck,
    detailedHealthCheck
} from '../shared/middleware/dbHealthCheck.middleware.js';
import {
    errorHandler,
    notFound
} from '../shared/middleware/errorHandler.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const registerMiddlewares = (app) => {
    app.set('trust proxy', 1);

    app.use(helmet());
    app.use(mongoSanitizeMiddleware);

    const allowedOrigins = (process.env.CLIENT_URL || '')
        .split(',')
        .map((o) => o.trim().replace(/\/$/, ''))
        .filter(Boolean);

    app.use(
        cors({
            origin: (origin, callback) => {
                if (!origin) return callback(null, true);

                const normalizedOrigin = origin.replace(/\/$/, '');

                if (
                    allowedOrigins.length === 0 ||
                    allowedOrigins.includes(normalizedOrigin)
                ) {
                    return callback(null, true);
                }

                return callback(new Error(`CORS not allowed for: ${origin}`));
            },
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization'],
            optionsSuccessStatus: 200
        })
    );

    app.use(compression());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    const limiterKey = (req) => ipKeyGenerator(req.ip);

    const globalLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 200,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: limiterKey,
        message: {
            success: false,
            message: 'Too many requests from this IP, please try again after 15 minutes.'
        }
    });

    const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 10,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: limiterKey,
        message: {
            success: false,
            message: 'Too many auth attempts, please try again after 15 minutes.'
        }
    });

    app.use('/api', globalLimiter);
    app.use('/api/v1/auth', authLimiter);

    app.use(
        '/uploads',
        (req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Cross-Origin-Resource-Policy', 'cross-origin');
            next();
        },
        express.static(path.join(__dirname, '../../uploads'))
    );

    app.use('/api', dbHealthCheck);

    app.get('/', (_req, res) => {
        res.status(200).json({
            message: `${config.app.name} API is running`,
            version: '1.0.0',
            environment: config.app.env,
            endpoints: {
                auth: '/api/v1/auth',
                wallet: '/api/v1/wallet',
                admin: '/api/v1/admin',
                user: '/api/v1/user',
                banners: '/api/v1/banners',
                market: '/api/v1/admin/market',
                categories: '/api/v1/admin/categories',
                notifications: '/api/v1/notifications'
            }
        });
    });

    app.get('/health', detailedHealthCheck);

    app.get('/health/simple', (_req, res) => {
        res.status(200).json({
            status: 'OK',
            app: config.app.name,
            timestamp: new Date().toISOString(),
            uptime: `${Math.floor(process.uptime())}s`
        });
    });
};

export const registerErrorMiddleware = (app) => {
    app.use(notFound);
    app.use(errorHandler);
};

export default registerMiddlewares;