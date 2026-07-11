import { env } from './env.js';

export const config = {
    app: {
        name: env.APP_NAME,
        env: env.NODE_ENV,
        port: env.PORT,
        isDev: env.NODE_ENV === 'development',
        isProd: env.NODE_ENV === 'production',
    },

    db: {
        uri: env.MONGODB_URI,
        options: {
            maxPoolSize: 50,
            minPoolSize: 10,
            socketTimeoutMS: 45000,
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 10000,
            maxIdleTimeMS: 30000,
            waitQueueTimeoutMS: 10000,
            w: 'majority',
            retryWrites: true,
            autoIndex: env.NODE_ENV !== 'production',
            family: 4,
            readPreference: 'primary',
            readConcern: { level: 'majority' },
            writeConcern: { w: 'majority' },
            dbName: 'Trading',
        },
    },

    jwt: {
        secret: env.JWT_SECRET,
        expiresIn: env.JWT_EXPIRES_IN,
        refreshSecret: env.JWT_REFRESH_SECRET,
        refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
    },

    adminJwt: {
        secret: env.ADMIN_JWT_SECRET,
        expiresIn: env.ADMIN_JWT_EXPIRES_IN,
    },

    redis: {
        url: env.REDIS_URL,
        enabled: !!env.REDIS_URL,
    },

    twoFactor: {
        apiKey: env.TWO_FACTOR_API_KEY,
        templates: {
            signup: env.TWO_FACTOR_TEMPLATE_SIGNUP,
            login: env.TWO_FACTOR_TEMPLATE_LOGIN,
            forgot_password: env.TWO_FACTOR_TEMPLATE_FORGOT,
            wallet_withdrawal: env.TWO_FACTOR_TEMPLATE_WALLET,
        },
        enabled: !!env.TWO_FACTOR_API_KEY,
    },

    upload: {
        dir: env.UPLOAD_DIR,
        maxSize: env.MAX_FILE_SIZE,
        allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
        allowedDocTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    },

    pagination: {
        defaultLimit: 20,
        maxLimit: 100,
    },

    rateLimit: {
        windowMs: 15 * 60 * 1000,
        max: 100,
        authMax: 10,
    },
};

export default config;