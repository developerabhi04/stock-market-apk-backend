import jwt from 'jsonwebtoken';
import { ApiError } from '../Utils/apiError.js';
import { asyncHandler } from '../Utils/asyncHandler.js';

export const authenticateAdmin = asyncHandler(async (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        throw new ApiError(401, 'Admin authentication required');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check if admin (you can add admin role check here)
        if (!decoded.isAdmin) {
            throw new ApiError(403, 'Admin access required');
        }

        req.admin = decoded;
        next();
    } catch (error) {
        throw new ApiError(401, 'Invalid or expired admin token');
    }
});
