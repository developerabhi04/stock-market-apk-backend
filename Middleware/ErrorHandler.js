import { ApiError } from '../Utils/apiError.js';

/**
 * Global Error Handler Middleware
 * Must be placed AFTER all routes in server.js
 * Handles all errors thrown in the application
 */
export const errorHandler = (err, req, res, next) => {
    // Default error values
    let error = {
        statusCode: err.statusCode || 500,
        message: err.message || 'Internal Server Error',
        success: false
    };

    // Log error details for debugging (only in development)
    if (process.env.NODE_ENV === 'development') {
        console.error('🔴 Error Details:', {
            message: err.message,
            statusCode: err.statusCode,
            stack: err.stack,
            name: err.name
        });
    }

    // Mongoose Bad ObjectId Error (CastError)
    if (err.name === 'CastError') {
        error.message = `Invalid ${err.path}: ${err.value}`;
        error.statusCode = 400;
    }

    // Mongoose Duplicate Key Error (E11000)
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        error.message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
        error.statusCode = 409;
    }

    // Mongoose Validation Error
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(el => el.message);
        error.message = `Validation failed: ${errors.join(', ')}`;
        error.statusCode = 400;
    }

    // JWT Errors
    if (err.name === 'JsonWebTokenError') {
        error.message = 'Invalid token. Please login again.';
        error.statusCode = 401;
    }

    if (err.name === 'TokenExpiredError') {
        error.message = 'Your session has expired. Please login again.';
        error.statusCode = 401;
    }

    // Multer File Upload Error
    if (err.name === 'MulterError') {
        if (err.code === 'LIMIT_FILE_SIZE') {
            error.message = 'File size too large. Maximum size is 5MB.';
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            error.message = 'Unexpected field in file upload.';
        } else {
            error.message = 'File upload error.';
        }
        error.statusCode = 400;
    }

    // Rate Limit Error
    if (err.name === 'TooManyRequestsError') {
        error.message = 'Too many requests. Please try again later.';
        error.statusCode = 429;
    }

    // Send error response
    res.status(error.statusCode).json({
        success: error.success,
        message: error.message,
        ...(process.env.NODE_ENV === 'development' && {
            error: err,
            stack: err.stack
        })
    });
};

/**
 * Handle 404 Not Found errors
 * Place this BEFORE errorHandler in server.js
 */
export const notFound = (req, res, next) => {
    const error = new ApiError(
        404,
        `Route not found: ${req.originalUrl}`
    );
    next(error);
};

/**
 * Handle unhandled promise rejections
 * Place in server.js
 */
export const handleUnhandledRejection = () => {
    process.on('unhandledRejection', (err) => {
        console.error('🔴 UNHANDLED REJECTION! Shutting down...');
        console.error(err.name, err.message);
        process.exit(1);
    });
};

/**
 * Handle uncaught exceptions
 * Place in server.js at the very top
 */
export const handleUncaughtException = () => {
    process.on('uncaughtException', (err) => {
        console.error('🔴 UNCAUGHT EXCEPTION! Shutting down...');
        console.error(err.name, err.message);
        process.exit(1);
    });
};
