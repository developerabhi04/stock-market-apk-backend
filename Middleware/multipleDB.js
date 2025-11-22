import mongoose from 'mongoose';

/**
 * Create multiple database connections
 * Useful for separating trading data from user data
 */

// Main Database (Users, Authentication, KYC)
export const mainDB = mongoose.createConnection(process.env.MONGODB_URI, {
    maxPoolSize: 30,
    minPoolSize: 5,
    socketTimeoutMS: 45000,
    serverSelectionTimeoutMS: 5000
});

// Trading Database (Orders, Transactions, Portfolio)
export const tradingDB = mongoose.createConnection(process.env.MONGODB_TRADING_URI || process.env.MONGODB_URI, {
    maxPoolSize: 40,
    minPoolSize: 10,
    socketTimeoutMS: 45000,
    serverSelectionTimeoutMS: 5000
});

// Analytics Database (Logs, Reports)
export const analyticsDB = mongoose.createConnection(process.env.MONGODB_ANALYTICS_URI || process.env.MONGODB_URI, {
    maxPoolSize: 20,
    minPoolSize: 5,
    socketTimeoutMS: 45000,
    serverSelectionTimeoutMS: 5000
});

// Event Listeners for Main DB
mainDB.on('connected', () => {
    console.log('✅ Main Database Connected');
});

mainDB.on('error', (err) => {
    console.error('❌ Main Database Error:', err.message);
});

// Event Listeners for Trading DB
tradingDB.on('connected', () => {
    console.log('✅ Trading Database Connected');
});

tradingDB.on('error', (err) => {
    console.error('❌ Trading Database Error:', err.message);
});

// Event Listeners for Analytics DB
analyticsDB.on('connected', () => {
    console.log('✅ Analytics Database Connected');
});

analyticsDB.on('error', (err) => {
    console.error('❌ Analytics Database Error:', err.message);
});

/**
 * Close all database connections
 */
export const closeAllConnections = async () => {
    await Promise.all([
        mainDB.close(),
        tradingDB.close(),
        analyticsDB.close()
    ]);
    console.log('✅ All database connections closed');
};
