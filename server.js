import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
// ✅ ADD THESE IMPORTS
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
// ✅ END OF NEW IMPORTS

import connectDB, { disconnectDB, getConnectionStats } from './Database/Db.js';
import { dbHealthCheck, detailedHealthCheck } from './Middleware/dbHealthCheck.js';
import {
    errorHandler,
    notFound,
    handleUnhandledRejection,
    handleUncaughtException
} from './Middleware/ErrorHandler.js';
import bannerRoutes from './Routes/BannerRoute.js';
import notificationRoutes from './Routes/NotificationRoute.js';

// Routes
import authRoutes from './Routes/AuthRoute.js';
import walletRoutes from './Routes/WalletRoute.js';
import adminRoutes from './Routes/AdminRoute.js';
import userRoutes from './Routes/UserRoute.js';
import indexRoutes from './Routes/IndexRoute.js';
import stockRoutes from './Routes/StockRoute.js';
import priceHistoryRoutes from './Routes/PriceHistoryRoute.js';
import dailyHistoryRoutes from './Routes/DailyHistoryRoute.js';
import categoryRoutes from './Routes/CategoryRoute.js';

// ✅ Get __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Handle uncaught exceptions
handleUncaughtException();

const app = express();

// Security Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CLIENT_URL || '*',
    credentials: true
}));
app.use(compression());

// Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ Serve static files with CORS headers
app.use('/uploads', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
}, express.static(path.join(__dirname, 'uploads')));

// Server testing 
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
    })
});

// Health Check Routes
app.get('/health', detailedHealthCheck);
app.get('/health/simple', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date(),
        uptime: process.uptime()
    });
});

app.get('/health/db-stats', (req, res) => {
    const stats = getConnectionStats();
    res.status(200).json(stats);
});

// Apply DB health check to API routes
app.use('/api', dbHealthCheck);

// ==================== ROUTES ====================
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/admin/categories', categoryRoutes);

// ✅ Market Data Routes (Public)
app.use('/api/v1/indices', indexRoutes);
app.use('/api/v1/stocks', stockRoutes);
app.use('/api/v1/price-history', priceHistoryRoutes);
app.use('/api/v1/daily-history', dailyHistoryRoutes);
app.use('/api/v1/banners', bannerRoutes);
app.use('/api/v1/notifications', notificationRoutes);

// 404 Handler
app.use(notFound);

// Global Error Handler
app.use(errorHandler);

// Connect to MongoDB
await connectDB();

// Handle unhandled promise rejections
handleUnhandledRejection();

// Graceful Shutdown
const gracefulShutdown = async (signal) => {
    console.log(`\n⚠️ ${signal} received. Starting graceful shutdown...`);

    try {
        await disconnectDB();
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
    console.log('\n🚀 TradeHub Backend Started Successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📡 Server running on port: ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 Health Check: http://localhost:${PORT}/health`);
    console.log(`📊 Admin API: http://localhost:${PORT}/api/v1/admin`);
    console.log(`🖼️ Banners API: http://localhost:${PORT}/api/v1/banners`);
    console.log(`📈 Market API: http://localhost:${PORT}/api/v1/indices`);
    console.log(`📁 Uploads: http://localhost:${PORT}/uploads`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});

server.on('error', (error) => {
    console.error('🔴 Server Error:', error);
    process.exit(1);
});

export default app;
