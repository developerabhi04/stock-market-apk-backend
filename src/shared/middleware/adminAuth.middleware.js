import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const authenticateAdmin = asyncHandler(async (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        throw new ApiError(401, 'Admin authentication required');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check if admin
        if (!decoded.isAdmin) {
            throw new ApiError(403, 'Admin access required');
        }

        // ✅ Attach admin info to request (includes role)
        req.admin = {
            adminId: decoded.adminId,
            username: decoded.username,
            role: decoded.role,  // ✅ This is already being sent from login
            isAdmin: decoded.isAdmin
        };

        next();
    } catch (error) {
        throw new ApiError(401, 'Invalid or expired admin token');
    }
});
