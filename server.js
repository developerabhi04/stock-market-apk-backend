import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
// import mongoSanitize from 'express-mongo-sanitize';
import connectDB, { disconnectDB, getConnectionStats } from './Database/Db.js';
import { dbHealthCheck, detailedHealthCheck } from './Middleware/dbHealthCheck.js';
import {
    errorHandler,
    notFound,
    handleUnhandledRejection,
    handleUncaughtException
} from './Middleware/ErrorHandler.js';


// Routes
import authRoutes from './Routes/AuthRoute.js';
import walletRoutes from './Routes/WalletRoute.js';
import adminRoutes from './Routes/AdminRoute.js';


// Handle uncaught exceptions
handleUncaughtException();

const app = express();

// Security Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CLIENT_URL || '*',
    credentials: true
}));
// app.use(mongoSanitize());
app.use(compression());


// Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));



// Server testing 
app.get('/', (req, res) => {
    res.status(200).json({
        message: "API is working!"
    })
})


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

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/admin', adminRoutes);

// 404 Handler
app.use(notFound);

// Global Error Handlerr
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
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});

server.on('error', (error) => {
    console.error('🔴 Server Error:', error);
    process.exit(1);
});

export default app;
