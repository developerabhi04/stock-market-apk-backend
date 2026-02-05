import express from 'express';
import { authenticateAdmin } from '../Middleware/AdminAuth.js';
import {
    isSuperAdmin,
    canAccessPayments,
    canViewDashboard,
    canManageUsers,
    canManageMarket,
    canManageKYC,           // ✅ NEW
    canManageTransactions,  // ✅ NEW
    canManageBanners,       // ✅ NEW
    canManageNotifications, // ✅ NEW
    canViewReports,         // ✅ NEW
    canManageCategories     // ✅ NEW
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

    // Admin Management
    createAdmin,
    getAllAdmins,
    updateAdminRole,
    deleteAdmin,
    getAdminActivity,
    createPaymentManager
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

// ✅ Payments (Super Admin + Admins with payment access)
router.get('/payments/pending', canAccessPayments, getPendingPayments);
router.post('/payments/approve', canAccessPayments, approvePayment);
router.post('/payments/reject', canAccessPayments, rejectPayment);

// ✅ Withdrawals (Super Admin + Admins with payment access)
router.get('/withdrawals/pending', canAccessPayments, getPendingWithdrawals);
router.post('/withdrawals/approve', canAccessPayments, approveWithdrawal);
router.post('/withdrawals/reject', canAccessPayments, rejectWithdrawal);
router.get('/withdrawals/stats', canAccessPayments, getWithdrawalStats);

// ✅ Transactions (Super Admin + Admins with transaction access)
router.get('/transactions', canManageTransactions, getAllTransactions);

// ✅ User Management (Super Admin + Admins with user access)
router.get('/users', canManageUsers, getAllUsers);
router.get('/users/stats', canManageUsers, getUserStats);
router.get('/users/:userId', canManageUsers, getUserDetails);
router.post('/users/update-balance', canManageUsers, updateUserBalance); // ✅ Changed from isSuperAdmin

// ==================== ADMIN MANAGEMENT (Super Admin Only) ====================
router.post('/admins/create', isSuperAdmin, createAdmin);
router.get('/admins', isSuperAdmin, getAllAdmins);
router.put('/admins/:adminId/role', isSuperAdmin, updateAdminRole);
router.delete('/admins/:adminId', isSuperAdmin, deleteAdmin);
router.get('/admins/:adminId/activity', isSuperAdmin, getAdminActivity);
router.post('/create-payment-manager', isSuperAdmin, createPaymentManager);

// ==================== MARKET DATA (Super Admin + Admins with market access) ====================
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
