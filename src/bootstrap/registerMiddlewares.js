import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
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

const normalizeOrigin = (origin = '') => origin.trim().replace(/\/$/, '');

export const registerMiddlewares = (app) => {
    app.set('trust proxy', 1);

    const uploadsDir = path.join(__dirname, '../../uploads');
    const publicBaseUrl = normalizeOrigin(process.env.PUBLIC_BASE_URL || '');
    const allowedOrigins = (process.env.CLIENT_URL || '')
        .split(',')
        .map(normalizeOrigin)
        .filter(Boolean);

    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }

    console.log('📁 uploadsDir:', uploadsDir);
    console.log('🌐 PUBLIC_BASE_URL:', publicBaseUrl || 'Not set');
    console.log('🛡️ Allowed Origins:', allowedOrigins.length ? allowedOrigins : ['*']);

    app.use(
        helmet({
            crossOriginResourcePolicy: false,
        })
    );

    app.use(mongoSanitizeMiddleware);

    app.use(
        cors({
            origin: (origin, callback) => {
                if (!origin) return callback(null, true);

                const normalizedOrigin = normalizeOrigin(origin);

                if (allowedOrigins.length === 0 || allowedOrigins.includes(normalizedOrigin)) {
                    return callback(null, true);
                }

                return callback(new Error(`CORS not allowed for: ${origin}`));
            },
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization'],
            optionsSuccessStatus: 200,
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
            message: 'Too many requests from this IP, please try again after 15 minutes.',
        },
    });

    const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 10,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: limiterKey,
        message: {
            success: false,
            message: 'Too many auth attempts, please try again after 15 minutes.',
        },
    });

    app.use('/api', globalLimiter);
    app.use('/api/v1/auth', authLimiter);

    app.use(
        '/uploads',
        (req, res, next) => {
            const requestOrigin = normalizeOrigin(req.headers.origin || '');

            if (requestOrigin && (allowedOrigins.length === 0 || allowedOrigins.includes(requestOrigin))) {
                res.header('Access-Control-Allow-Origin', requestOrigin);
            } else {
                res.header('Access-Control-Allow-Origin', '*');
            }

            res.header('Cross-Origin-Resource-Policy', 'cross-origin');
            res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            next();
        },
        express.static(uploadsDir, {
            maxAge: '7d',
            etag: true,
            lastModified: true,
            index: false,
        })
    );

    app.use('/api', dbHealthCheck);

    app.get('/', (_req, res) => {
        res.status(200).json({
            success: true,
            message: `${config.app.name} API is running`,
            version: '1.0.0',
            environment: config.app.env,
            baseUrl: publicBaseUrl || null,
            endpoints: {
                auth: '/api/v1/auth',
                wallet: '/api/v1/wallet',
                admin: '/api/v1/admin',
                user: '/api/v1/user',
                banners: '/api/v1/banners',
                market: '/api/v1/admin/market',
                categories: '/api/v1/admin/market/categories',
                notifications: '/api/v1/notifications',
                uploads: '/uploads',
            },
        });
    });

    app.get('/health', detailedHealthCheck);

    app.get('/health/simple', (_req, res) => {
        res.status(200).json({
            status: 'OK',
            app: config.app.name,
            timestamp: new Date().toISOString(),
            uptime: `${Math.floor(process.uptime())}s`,
            baseUrl: publicBaseUrl || null,
        });
    });
};

export const registerErrorMiddleware = (app) => {
    app.use(notFound);
    app.use(errorHandler);
};

export default registerMiddlewares;