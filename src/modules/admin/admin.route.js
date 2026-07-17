import express from 'express';
import { authenticateAdmin } from '../../shared/middleware/adminAuth.middleware.js';
import {
    isSuperAdmin,
    canAccessPayments,
    canManageMarket,
    canManageTransactions,
    canManageUsers,
    canViewDashboard,
} from '../../shared/middleware/checkPermissions.middleware.js';

import {
    adminLogin,
    bulkUpdatePrices,
    createAdmin,
    createFirstAdmin,
    createStock,
    deleteAdmin,
    deleteStock,
    generateSampleChartData,
    generateSampleDailyHistory,
    getAdminActivity,
    getAllAdmins,
    getAllStocksAdmin,
    getAllTransactions,
    getAllUsers,
    getCompleteDashboardStats,
    getDashboardStats,
    getMarketDashboardStats,
    getUserDetails,
    getUserStats,
    getWithdrawalStats,
    updateAdminRole,
    updateStock,
    updateUserBalance,
} from './admin.controller.js';

const router = express.Router();

router.post('/login', adminLogin);
router.post('/create-first-admin', createFirstAdmin);

router.use(authenticateAdmin);

router.get('/dashboard/stats', canViewDashboard, getDashboardStats);
router.get('/dashboard/complete-stats', canViewDashboard, getCompleteDashboardStats);
router.get('/dashboard/market-stats', canViewDashboard, getMarketDashboardStats);

router.get('/withdrawals/stats', canAccessPayments, getWithdrawalStats);

router.get('/transactions', canManageTransactions, getAllTransactions);

router.get('/users', canManageUsers, getAllUsers);
router.get('/users/stats', canManageUsers, getUserStats);
router.get('/users/:userId', canManageUsers, getUserDetails);
router.post('/users/update-balance', canManageUsers, updateUserBalance);

router.post('/admins/create', isSuperAdmin, createAdmin);
router.get('/admins', isSuperAdmin, getAllAdmins);
router.put('/admins/:adminId/role', isSuperAdmin, updateAdminRole);
router.delete('/admins/:adminId', isSuperAdmin, deleteAdmin);
router.get('/admins/:adminId/activity', isSuperAdmin, getAdminActivity);

// router.get('/indices', canManageMarket, getAllIndicesAdmin);
// router.post('/indices', canManageMarket, createIndex);
// router.put('/indices/:id', canManageMarket, updateIndex);
// router.delete('/indices/:id', canManageMarket, deleteIndex);

router.get('/stocks', canManageMarket, getAllStocksAdmin);
router.post('/stocks', canManageMarket, createStock);
router.put('/stocks/:id', canManageMarket, updateStock);
router.delete('/stocks/:id', canManageMarket, deleteStock);

router.post('/market/bulk-update-prices', canManageMarket, bulkUpdatePrices);
router.post('/market/generate-chart-data', canManageMarket, generateSampleChartData);
router.post('/market/generate-daily-history', canManageMarket, generateSampleDailyHistory);

export default router;