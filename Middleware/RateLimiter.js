import rateLimit from 'express-rate-limit';

/**
 * Simple Rate Limiter using in-memory store
 * Good for single-server deployments
 * For production with multiple servers, use Redis store
 */
export const rateLimiter = (maxRequests, windowMinutes) => {
    return rateLimit({
        windowMs: windowMinutes * 60 * 1000, // Convert minutes to milliseconds
        max: maxRequests, // Max requests per window
        message: {
            success: false,
            message: 'Too many requests from this device. Please try again later.'
        },
        standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
        legacyHeaders: false, // Disable `X-RateLimit-*` headers
        // Store is automatically handled by default MemoryStore
        skipSuccessfulRequests: false, // Count successful requests
        skipFailedRequests: false, // Count failed requests
        handler: (req, res) => {
            res.status(429).json({
                success: false,
                message: 'Too many requests. Please try again later.',
                retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
            });
        }
    });
};

/**
 * Different rate limiters for different endpoints
 */

// Strict rate limiter for authentication endpoints
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Max 5 requests per 15 minutes
    message: {
        success: false,
        message: 'Too many authentication attempts. Please try again after 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// General API rate limiter
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Max 100 requests per 15 minutes
    message: {
        success: false,
        message: 'Too many API requests. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Strict limiter for OTP endpoints
export const otpLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 3, // Max 3 OTP requests per 10 minutes
    message: {
        success: false,
        message: 'Too many OTP requests. Please try again after 10 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false
});

// Wallet operations limiter
export const walletLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Max 10 wallet operations per 15 minutes
    message: {
        success: false,
        message: 'Too many wallet transactions. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

export default rateLimiter;
