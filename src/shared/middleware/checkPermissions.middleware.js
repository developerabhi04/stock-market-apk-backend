import { ApiError } from '../utils/apiError.js';
import Admin from '../../modules/admin/admin.model.js';

export const isSuperAdmin = (req, res, next) => {
    if (req.admin.role !== 'super_admin') {
        throw new ApiError(403, 'Only super admin can perform this action');
    }
    next();
};

export const checkRouteAccess = (requiredPath) => {
    return async (req, res, next) => {
        try {
            if (req.admin.role === 'super_admin') return next();

            const admin = await Admin.findById(req.admin.adminId).select('allowedRoutes role');
            if (!admin) throw new ApiError(401, 'Admin not found');

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

export const canAccessPayments = async (req, res, next) => {
    try {
        if (req.admin.role === 'super_admin') return next();
        const admin = await Admin.findById(req.admin.adminId).select('allowedRoutes role');
        if (!admin) throw new ApiError(401, 'Admin not found');
        if (admin.allowedRoutes?.includes('/dashboard/payment-manager')) return next();
        throw new ApiError(403, 'Access denied. Payment management permission required.');
    } catch (error) { next(error); }
};

export const canViewDashboard = async (req, res, next) => {
    try {
        if (req.admin.role === 'super_admin') return next();
        throw new ApiError(403, 'Dashboard access restricted to super admin');
    } catch (error) { next(error); }
};

export const canManageUsers = async (req, res, next) => {
    try {
        if (req.admin.role === 'super_admin') return next();
        const admin = await Admin.findById(req.admin.adminId).select('allowedRoutes role');
        if (!admin) throw new ApiError(401, 'Admin not found');
        if (admin.allowedRoutes?.includes('/dashboard/users')) return next();
        throw new ApiError(403, 'User management permission required');
    } catch (error) { next(error); }
};

export const canManageMarket = async (req, res, next) => {
    try {
        if (req.admin.role === 'super_admin') return next();
        const admin = await Admin.findById(req.admin.adminId).select('allowedRoutes role');
        if (!admin) throw new ApiError(401, 'Admin not found');
        if (admin.allowedRoutes?.includes('/dashboard/market')) return next();
        throw new ApiError(403, 'Market management permission required');
    } catch (error) { next(error); }
};

export const canManageKYC = async (req, res, next) => {
    try {
        if (req.admin.role === 'super_admin') return next();
        const admin = await Admin.findById(req.admin.adminId).select('allowedRoutes role');
        if (!admin) throw new ApiError(401, 'Admin not found');
        if (admin.allowedRoutes?.includes('/dashboard/kyc')) return next();
        throw new ApiError(403, 'KYC management permission required');
    } catch (error) { next(error); }
};

export const canManageTransactions = async (req, res, next) => {
    try {
        if (req.admin.role === 'super_admin') return next();
        const admin = await Admin.findById(req.admin.adminId).select('allowedRoutes role');
        if (!admin) throw new ApiError(401, 'Admin not found');
        if (admin.allowedRoutes?.includes('/dashboard/transactions')) return next();
        throw new ApiError(403, 'Transaction management permission required');
    } catch (error) { next(error); }
};

export const canManageBanners = async (req, res, next) => {
    try {
        if (req.admin.role === 'super_admin') return next();
        const admin = await Admin.findById(req.admin.adminId).select('allowedRoutes role');
        if (!admin) throw new ApiError(401, 'Admin not found');
        if (admin.allowedRoutes?.includes('/dashboard/banners')) return next();
        throw new ApiError(403, 'Banner management permission required');
    } catch (error) { next(error); }
};

export const canManageNotifications = async (req, res, next) => {
    try {
        if (req.admin.role === 'super_admin') return next();
        const admin = await Admin.findById(req.admin.adminId).select('allowedRoutes role');
        if (!admin) throw new ApiError(401, 'Admin not found');
        if (admin.allowedRoutes?.includes('/dashboard/notifications')) return next();
        throw new ApiError(403, 'Notification management permission required');
    } catch (error) { next(error); }
};

export const canViewReports = async (req, res, next) => {
    try {
        if (req.admin.role === 'super_admin') return next();
        const admin = await Admin.findById(req.admin.adminId).select('allowedRoutes role');
        if (!admin) throw new ApiError(401, 'Admin not found');
        if (admin.allowedRoutes?.includes('/dashboard/reports')) return next();
        throw new ApiError(403, 'Report access permission required');
    } catch (error) { next(error); }
};

export const canManageCategories = async (req, res, next) => {
    try {
        if (req.admin.role === 'super_admin') return next();
        const admin = await Admin.findById(req.admin.adminId).select('allowedRoutes role');
        if (!admin) throw new ApiError(401, 'Admin not found');
        if (admin.allowedRoutes?.includes('/dashboard/index-categories')) return next();
        throw new ApiError(403, 'Category management permission required');
    } catch (error) { next(error); }
};
