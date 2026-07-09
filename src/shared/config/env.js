// src/shared/config/env.js
const _env = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: Number(process.env.PORT) || 5000,

    // App
    APP_NAME: process.env.APP_NAME || 'TradeHub',

    // MongoDB
    MONGODB_URI: process.env.MONGODB_URI,
    MONGODB_TRADING_URI: process.env.MONGODB_TRADING_URI || null,
    MONGODB_ANALYTICS_URI: process.env.MONGODB_ANALYTICS_URI || null,

    // JWT
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',

    // Admin JWT
    ADMIN_JWT_SECRET: process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET,
    ADMIN_JWT_EXPIRES_IN: process.env.ADMIN_JWT_EXPIRES_IN || '1d',

    // Redis
    REDIS_URL: process.env.REDIS_URL || null,

    // 2Factor.in
    TWO_FACTOR_API_KEY: process.env.TWO_FACTOR_API_KEY || null,
    TWO_FACTOR_TEMPLATE_SIGNUP: process.env.TWO_FACTOR_TEMPLATE_SIGNUP || 'OTP1',
    TWO_FACTOR_TEMPLATE_LOGIN: process.env.TWO_FACTOR_TEMPLATE_LOGIN || 'OTP1',
    TWO_FACTOR_TEMPLATE_FORGOT: process.env.TWO_FACTOR_TEMPLATE_FORGOT || 'OTP1',
    TWO_FACTOR_TEMPLATE_WALLET: process.env.TWO_FACTOR_TEMPLATE_WALLET || 'OTP1',

    // Uploads
    UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',
    MAX_FILE_SIZE: Number(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024,

    // CORS
    CORS_ORIGIN: process.env.CORS_ORIGIN || process.env.CLIENT_URL || '*',
    CLIENT_URL: process.env.CLIENT_URL || process.env.CORS_ORIGIN || '*',
};

// Only require what is truly mandatory right now
const REQUIRED = ['MONGODB_URI', 'JWT_SECRET'];

REQUIRED.forEach((key) => {
    if (!_env[key]) {
        console.error(`❌ Missing required env variable: ${key}`);
        process.exit(1);
    }
});

export const env = _env;
export default env;