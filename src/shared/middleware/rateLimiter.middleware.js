import rateLimit from 'express-rate-limit';

export const rateLimiter = (maxRequests, windowMinutes) => {
    return rateLimit({
        windowMs: windowMinutes * 60 * 1000,
        max: maxRequests,
        message: {
            success: false,
            message: 'Too many requests from this device. Please try again later.'
        },
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        handler: (req, res) => {
            res.status(429).json({
                success: false,
                message: 'Too many requests. Please try again later.',
                retryAfter: req.rateLimit?.resetTime
                    ? Math.ceil(new Date(req.rateLimit.resetTime).getTime() / 1000 - Date.now() / 1000)
                    : null
            });
        }
    });
};

export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        success: false,
        message: 'Too many authentication attempts. Please try again after 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        success: false,
        message: 'Too many API requests. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

export const otpLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 3,
    message: {
        success: false,
        message: 'Too many OTP requests. Please try again after 10 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false
});

export const walletLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
        success: false,
        message: 'Too many wallet transactions. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

export default rateLimiter;