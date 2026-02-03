import { ApiError } from '../Utils/apiError.js';

/**
 * ✅ Check if admin is super admin
 */
export const isSuperAdmin = (req, res, next) => {
    if (req.admin.role !== 'super_admin') {
        throw new ApiError(403, 'Only super admin can perform this action');
    }
    next();
};

/**
 * ✅ Check if admin can access payments (super_admin OR payment_manager)
 */
export const canAccessPayments = (req, res, next) => {
    const allowedRoles = ['super_admin', 'payment_manager'];

    if (!allowedRoles.includes(req.admin.role)) {
        throw new ApiError(403, 'Access denied. Payment management only.');
    }

    next();
};

/**
 * ✅ Check if admin can view dashboard (super_admin only for now)
 */
export const canViewDashboard = (req, res, next) => {
    if (req.admin.role !== 'super_admin') {
        throw new ApiError(403, 'Dashboard access restricted to super admin');
    }
    next();
};

/**
 * ✅ Check if admin can manage users (super_admin only)
 */
export const canManageUsers = (req, res, next) => {
    if (req.admin.role !== 'super_admin') {
        throw new ApiError(403, 'User management restricted to super admin');
    }
    next();
};

/**
 * ✅ Check if admin can manage market data (super_admin only)
 */
export const canManageMarket = (req, res, next) => {
    if (req.admin.role !== 'super_admin') {
        throw new ApiError(403, 'Market management restricted to super admin');
    }
    next();
};
