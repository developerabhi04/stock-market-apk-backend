import express from 'express';
import { authenticateAdmin } from '../Middleware/AdminAuth.js';
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
    generateSampleDailyHistory
} from '../Controllers/AdminController.js';

const router = express.Router();

// ==================== PUBLIC ROUTES ====================
router.post('/login', adminLogin);
router.post('/create-first-admin', createFirstAdmin);

// ==================== PROTECTED ROUTES ====================
router.use(authenticateAdmin);

// Dashboard
router.get('/dashboard/stats', getDashboardStats);
router.get('/dashboard/complete-stats', getCompleteDashboardStats);
router.get('/dashboard/market-stats', getMarketDashboardStats);

// Payments Management
router.get('/payments/pending', getPendingPayments);
router.post('/payments/approve', approvePayment);
router.post('/payments/reject', rejectPayment);

// Withdrawals Management
router.get('/withdrawals/pending', getPendingWithdrawals);
router.post('/withdrawals/approve', approveWithdrawal);
router.post('/withdrawals/reject', rejectWithdrawal);
router.get('/withdrawals/stats', getWithdrawalStats);

// Transactions Management
router.get('/transactions', getAllTransactions);

// User Management
router.get('/users', getAllUsers);
router.get('/users/stats', getUserStats);
router.get('/users/:userId', getUserDetails);
router.post('/users/update-balance', updateUserBalance);

// ==================== MARKET DATA MANAGEMENT ====================

// Indices Management
router.get('/indices', getAllIndicesAdmin);
router.post('/indices', createIndex);
router.put('/indices/:id', updateIndex);
router.delete('/indices/:id', deleteIndex);

// Stocks Management
router.get('/stocks', getAllStocksAdmin);
router.post('/stocks', createStock);
router.put('/stocks/:id', updateStock);
router.delete('/stocks/:id', deleteStock);

// Bulk Operations
router.post('/market/bulk-update-prices', bulkUpdatePrices);
router.post('/market/generate-chart-data', generateSampleChartData);
router.post('/market/generate-daily-history', generateSampleDailyHistory);

export default router;
