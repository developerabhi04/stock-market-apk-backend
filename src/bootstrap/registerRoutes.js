import adminRoutes from '../modules/admin/admin.route.js';
import authRoutes from '../modules/auth/auth.route.js';
import bannerRouter from '../modules/banner/banner.route.js';
import walletRouter from '../modules/wallet/wallet.route.js';
import transactionAdminRouter from '../modules/transaction/transaction.admin.route.js';
import userRoutes from '../modules/user/user.route.js';
import reportsRoutes from '../modules/reports/reports.route.js';
import notificationRoutes from '../modules/notification/notification.route.js';
import indexAdminRouter from '../modules/market/index/index.admin.route.js';
import adminCategoryRouter from '../modules/market/category/category.route.js';

import marketRoutes from '../modules/market/market.route.js';

import { notFound } from '../shared/middleware/errorHandler.middleware.js';

export const registerRoutes = (app) => {
    // Auth & User
    app.use('/api/v1/auth', authRoutes);
    app.use('/api/v1/user', userRoutes);

    // Admin
    app.use('/api/v1/admin', adminRoutes);
    app.use('/api/v1/admin', transactionAdminRouter);

    // General
    app.use('/api/v1/banners', bannerRouter);
    app.use('/api/v1/wallet', walletRouter);

    // Market
    app.use('/api/v1/market', marketRoutes);
    app.use('/api/v1/admin/market', indexAdminRouter);
    app.use('/api/v1/admin/market/categories', adminCategoryRouter);

    // Reports
    app.use('/api/v1/admin', reportsRoutes);

    app.use('/api/v1/notifications', notificationRoutes);

    // 404 handler — must always be last
    app.use(notFound);
};

export default registerRoutes;