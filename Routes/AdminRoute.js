import express from 'express';
import { authenticateAdmin } from '../Middleware/AdminAuth.js';
import {
    isSuperAdmin,
    canAccessPayments,
    canViewDashboard,
    canManageUsers,
    canManageMarket
} from '../Middleware/CheckPermissions.js';

import {
    // Auth
    adminLogin,
    createFirstAdmin,

    // Dashboard
    getDashboardStats,
    getCompleteDashboardStats,

    // Payments
    getPendingPayments,
    approvePayment,
    rejectPayment,

    // Withdrawals
    getPendingWithdrawals,
    approveWithdrawal,
    rejectWithdrawal,
    getWithdrawalStats,

    // Transactions
    getAllTransactions,

    // Users
    getAllUsers,
    getUserStats,
    getUserDetails,
    updateUserBalance,

    // Market Data - Indices
    getMarketDashboardStats,
    getAllIndicesAdmin,
    createIndex,
    updateIndex,
    deleteIndex,

    // Market Data - Stocks
    getAllStocksAdmin,
    createStock,
    updateStock,
    deleteStock,

    // Market Data - Bulk & Sample
    bulkUpdatePrices,
    generateSampleChartData,
    generateSampleDailyHistory,

    // ✅ NEW - Admin Management
    createPaymentManager,
    getAllAdmins,
    deleteAdmin
} from '../Controllers/AdminController.js';

const router = express.Router();

// ==================== PUBLIC ROUTES ====================
router.post('/login', adminLogin);
router.post('/create-first-admin', createFirstAdmin);

// ==================== PROTECTED ROUTES ====================
router.use(authenticateAdmin);

// ✅ Dashboard (Super Admin Only)
router.get('/dashboard/stats', canViewDashboard, getDashboardStats);
router.get('/dashboard/complete-stats', canViewDashboard, getCompleteDashboardStats);
router.get('/dashboard/market-stats', canViewDashboard, getMarketDashboardStats);

// ✅ Payments (Super Admin + Payment Manager)
router.get('/payments/pending', canAccessPayments, getPendingPayments);
router.post('/payments/approve', canAccessPayments, approvePayment);
router.post('/payments/reject', canAccessPayments, rejectPayment);

// ✅ Withdrawals (Super Admin + Payment Manager)
router.get('/withdrawals/pending', canAccessPayments, getPendingWithdrawals);
router.post('/withdrawals/approve', canAccessPayments, approveWithdrawal);
router.post('/withdrawals/reject', canAccessPayments, rejectWithdrawal);
router.get('/withdrawals/stats', canAccessPayments, getWithdrawalStats);

// ✅ Transactions (Super Admin Only)
router.get('/transactions', canViewDashboard, getAllTransactions);


// ✅ User Management (Super Admin Only)
router.get('/users', canManageUsers, getAllUsers);
router.get('/users/stats', canManageUsers, getUserStats);
router.get('/users/:userId', canManageUsers, getUserDetails);
router.post('/users/update-balance', isSuperAdmin, updateUserBalance);


// ==================== ADMIN MANAGEMENT (Super Admin Only) ====================
router.post('/create-payment-manager', isSuperAdmin, createPaymentManager);
router.get('/admins', isSuperAdmin, getAllAdmins);
router.delete('/admins/:adminId', isSuperAdmin, deleteAdmin);


// ==================== MARKET DATA (Super Admin Only) ====================
router.get('/indices', canManageMarket, getAllIndicesAdmin);
router.post('/indices', canManageMarket, createIndex);
router.put('/indices/:id', canManageMarket, updateIndex);
router.delete('/indices/:id', canManageMarket, deleteIndex);


router.get('/stocks', canManageMarket, getAllStocksAdmin);
router.post('/stocks', canManageMarket, createStock);
router.put('/stocks/:id', canManageMarket, updateStock);
router.delete('/stocks/:id', canManageMarket, deleteStock);


router.post('/market/bulk-update-prices', canManageMarket, bulkUpdatePrices);
router.post('/market/generate-chart-data', canManageMarket, generateSampleChartData);
router.post('/market/generate-daily-history', canManageMarket, generateSampleDailyHistory);

export default router;
