import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { dbHealthCheck, detailedHealthCheck } from './shared/middleware/dbHealthCheck.middleware.js';
import { errorHandler, notFound } from './shared/middleware/errorHandler.middleware.js';
import { getConnectionStats } from './shared/database/db.js';

// ── Module Routes ──────────────────────────────────────
import authRoutes from './modules/auth/auth.route.js';
import userRoutes from './modules/user/user.route.js';
import adminRoutes from './modules/admin/admin.route.js';
import walletRoutes from './modules/transaction/wallet.route.js';
import transactionRoutes from './modules/transaction/transaction.route.js';
import stockRoutes from './modules/stock/stock.route.js';
import categoryRoutes from './modules/stock/category.route.js';
import indexRoutes from './modules/stock/index.route.js';
import priceHistoryRoutes from './modules/market/priceHistory.route.js';
import dailyHistoryRoutes from './modules/market/dailyHistory.route.js';
import bannerRoutes from './modules/banner/banner.route.js';
import notificationRoutes from './modules/notification/notification.route.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Security
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(compression());

// Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files — note path goes up one level from src/
app.use('/uploads', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
}, express.static(path.join(__dirname, '../uploads')));

// Root
app.get('/', (req, res) => {
    res.status(200).json({
        message: "TradeHub API is working!",
        version: "1.0.0",
        endpoints: {
            auth: "/api/v1/auth",
            wallet: "/api/v1/wallet",
            admin: "/api/v1/admin",
            user: "/api/v1/user",
            banners: "/api/v1/banners",
            market: {
                indices: "/api/v1/indices",
                stocks: "/api/v1/stocks",
                priceHistory: "/api/v1/price-history",
                dailyHistory: "/api/v1/daily-history"
            }
        }
    });
});

// Health Checks
app.get('/health', detailedHealthCheck);
app.get('/health/simple', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date(), uptime: process.uptime() });
});
app.get('/health/db-stats', (req, res) => {
    res.status(200).json(getConnectionStats());
});

// DB guard on all /api routes
app.use('/api', dbHealthCheck);

// ── Registered Module Routes ───────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/admin/categories', categoryRoutes);
app.use('/api/v1/indices', indexRoutes);
app.use('/api/v1/stocks', stockRoutes);
app.use('/api/v1/price-history', priceHistoryRoutes);
app.use('/api/v1/daily-history', dailyHistoryRoutes);
app.use('/api/v1/banners', bannerRoutes);
app.use('/api/v1/notifications', notificationRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
