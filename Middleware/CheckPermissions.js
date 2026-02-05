import { ApiError } from '../Utils/apiError.js';
import Admin from '../Models/AdminModel.js';

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
 * ✅ NEW: Check if admin has access to specific route
 * This middleware checks both role AND allowedRoutes
 */
export const checkRouteAccess = (requiredPath) => {
    return async (req, res, next) => {
        try {
            // Super admins have access to everything
            if (req.admin.role === 'super_admin') {
                return next();
            }

            // For regular admins, check allowedRoutes
            const admin = await Admin.findById(req.admin.adminId).select('allowedRoutes role');

            if (!admin) {
                throw new ApiError(401, 'Admin not found');
            }

            // Check if admin has access to this route
            if (admin.allowedRoutes && admin.allowedRoutes.includes(requiredPath)) {
                console.log(`✅ Admin ${admin._id} has access to ${requiredPath}`);
                return next();
            }

            console.warn(`❌ Admin ${admin._id} denied access to ${requiredPath}`);
            throw new ApiError(403, 'You do not have permission to access this resource');
        } catch (error) {
            next(error);
        }
    };
};

/**
 * ✅ UPDATED: Check if admin can access payments
 * Now checks allowedRoutes too
 */
export const canAccessPayments = async (req, res, next) => {
    try {
        // Super admins always have access
        if (req.admin.role === 'super_admin') {
            return next();
        }

        // Check if admin has payment-manager route in allowedRoutes
        const admin = await Admin.findById(req.admin.adminId).select('allowedRoutes role');

        if (!admin) {
            throw new ApiError(401, 'Admin not found');
        }

        // Check if admin has access to payment routes
        const hasPaymentAccess = admin.allowedRoutes?.includes('/dashboard/payment-manager');

        if (hasPaymentAccess) {
            // console.log(`✅ Admin ${admin._id} has payment access`);
            return next();
        }

        throw new ApiError(403, 'Access denied. Payment management permission required.');
    } catch (error) {
        next(error);
    }
};

/**
 * ✅ UPDATED: Check if admin can view dashboard
 */
export const canViewDashboard = async (req, res, next) => {
    try {
        // Super admins always have access
        if (req.admin.role === 'super_admin') {
            return next();
        }

        // Regular admins can't access main dashboard
        throw new ApiError(403, 'Dashboard access restricted to super admin');
    } catch (error) {
        next(error);
    }
};

/**
 * ✅ UPDATED: Check if admin can manage users
 */
export const canManageUsers = async (req, res, next) => {
    try {
        // Super admins always have access
        if (req.admin.role === 'super_admin') {
            return next();
        }

        // Check if admin has users route in allowedRoutes
        const admin = await Admin.findById(req.admin.adminId).select('allowedRoutes role');

        if (!admin) {
            throw new ApiError(401, 'Admin not found');
        }

        // Check if admin has access to users route
        const hasUserAccess = admin.allowedRoutes?.includes('/dashboard/users');

        if (hasUserAccess) {
            console.log(`✅ Admin ${admin._id} has user management access`);
            return next();
        }

        throw new ApiError(403, 'User management permission required');
    } catch (error) {
        next(error);
    }
};

/**
 * ✅ UPDATED: Check if admin can manage market data
 */
export const canManageMarket = async (req, res, next) => {
    try {
        // Super admins always have access
        if (req.admin.role === 'super_admin') {
            return next();
        }

        // Check if admin has market route in allowedRoutes
        const admin = await Admin.findById(req.admin.adminId).select('allowedRoutes role');

        if (!admin) {
            throw new ApiError(401, 'Admin not found');
        }

        // Check if admin has access to market route
        const hasMarketAccess = admin.allowedRoutes?.includes('/dashboard/market');

        if (hasMarketAccess) {
            console.log(`✅ Admin ${admin._id} has market management access`);
            return next();
        }

        throw new ApiError(403, 'Market management permission required');
    } catch (error) {
        next(error);
    }
};

/**
 * ✅ NEW: Check if admin can manage KYC
 */
export const canManageKYC = async (req, res, next) => {
    try {
        // Super admins always have access
        if (req.admin.role === 'super_admin') {
            return next();
        }

        const admin = await Admin.findById(req.admin.adminId).select('allowedRoutes role');

        if (!admin) {
            throw new ApiError(401, 'Admin not found');
        }

        const hasKYCAccess = admin.allowedRoutes?.includes('/dashboard/kyc');

        if (hasKYCAccess) {
            console.log(`✅ Admin ${admin._id} has KYC management access`);
            return next();
        }

        throw new ApiError(403, 'KYC management permission required');
    } catch (error) {
        next(error);
    }
};

/**
 * ✅ NEW: Check if admin can manage transactions
 */
export const canManageTransactions = async (req, res, next) => {
    try {
        // Super admins always have access
        if (req.admin.role === 'super_admin') {
            return next();
        }

        const admin = await Admin.findById(req.admin.adminId).select('allowedRoutes role');

        if (!admin) {
            throw new ApiError(401, 'Admin not found');
        }

        const hasTransactionAccess = admin.allowedRoutes?.includes('/dashboard/transactions');

        if (hasTransactionAccess) {
            console.log(`✅ Admin ${admin._id} has transaction management access`);
            return next();
        }

        throw new ApiError(403, 'Transaction management permission required');
    } catch (error) {
        next(error);
    }
};

/**
 * ✅ NEW: Check if admin can manage banners
 */
export const canManageBanners = async (req, res, next) => {
    try {
        // Super admins always have access
        if (req.admin.role === 'super_admin') {
            return next();
        }

        const admin = await Admin.findById(req.admin.adminId).select('allowedRoutes role');

        if (!admin) {
            throw new ApiError(401, 'Admin not found');
        }

        const hasBannerAccess = admin.allowedRoutes?.includes('/dashboard/banners');

        if (hasBannerAccess) {
            console.log(`✅ Admin ${admin._id} has banner management access`);
            return next();
        }

        throw new ApiError(403, 'Banner management permission required');
    } catch (error) {
        next(error);
    }
};

/**
 * ✅ NEW: Check if admin can manage notifications
 */
export const canManageNotifications = async (req, res, next) => {
    try {
        // Super admins always have access
        if (req.admin.role === 'super_admin') {
            return next();
        }

        const admin = await Admin.findById(req.admin.adminId).select('allowedRoutes role');

        if (!admin) {
            throw new ApiError(401, 'Admin not found');
        }

        const hasNotificationAccess = admin.allowedRoutes?.includes('/dashboard/notifications');

        if (hasNotificationAccess) {
            console.log(`✅ Admin ${admin._id} has notification management access`);
            return next();
        }

        throw new ApiError(403, 'Notification management permission required');
    } catch (error) {
        next(error);
    }
};

/**
 * ✅ NEW: Check if admin can view reports
 */
export const canViewReports = async (req, res, next) => {
    try {
        // Super admins always have access
        if (req.admin.role === 'super_admin') {
            return next();
        }

        const admin = await Admin.findById(req.admin.adminId).select('allowedRoutes role');

        if (!admin) {
            throw new ApiError(401, 'Admin not found');
        }

        const hasReportAccess = admin.allowedRoutes?.includes('/dashboard/reports');

        if (hasReportAccess) {
            console.log(`✅ Admin ${admin._id} has report access`);
            return next();
        }

        throw new ApiError(403, 'Report access permission required');
    } catch (error) {
        next(error);
    }
};

/**
 * ✅ NEW: Check if admin can manage index categories
 */
export const canManageCategories = async (req, res, next) => {
    try {
        // Super admins always have access
        if (req.admin.role === 'super_admin') {
            return next();
        }

        const admin = await Admin.findById(req.admin.adminId).select('allowedRoutes role');

        if (!admin) {
            throw new ApiError(401, 'Admin not found');
        }

        const hasCategoryAccess = admin.allowedRoutes?.includes('/dashboard/index-categories');

        if (hasCategoryAccess) {
            console.log(`✅ Admin ${admin._id} has category management access`);
            return next();
        }

        throw new ApiError(403, 'Category management permission required');
    } catch (error) {
        next(error);
    }
};
