import { ApiError } from '../Utils/apiError.js';
import { asyncHandler } from '../Utils/asyncHandler.js';
import { verifyToken } from '../Utils/JwtService.js';

export const authenticate = asyncHandler(async (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        throw new ApiError(401, 'Authentication token is required');
    }

    try {
        const decoded = verifyToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        throw new ApiError(401, 'Invalid or expired token. Please login again.');
    }
});
