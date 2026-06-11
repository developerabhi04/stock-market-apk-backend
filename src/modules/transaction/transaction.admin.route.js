import express from 'express';
import { authenticateAdmin } from '../../shared/middleware/adminAuth.middleware.js';
import {
    canAccessPayments,
    canManageTransactions
} from '../../shared/middleware/checkPermissions.middleware.js';
import {
    approvePayment,
    approveWithdrawal,
    getAllTransactions,
    getPendingPayments,
    getPendingWithdrawals,
    getWithdrawalStats,
    rejectPayment,
    rejectWithdrawal
} from './transaction.controller.js';

const router = express.Router();

router.use(authenticateAdmin);

// Payments
router.get('/payments/pending', canAccessPayments, getPendingPayments);
router.post('/payments/approve', canAccessPayments, approvePayment);
router.post('/payments/reject', canAccessPayments, rejectPayment);

// Withdrawals
router.get('/withdrawals/pending', canAccessPayments, getPendingWithdrawals);
router.post('/withdrawals/approve', canAccessPayments, approveWithdrawal);
router.post('/withdrawals/reject', canAccessPayments, rejectWithdrawal);
router.get('/withdrawals/stats', canAccessPayments, getWithdrawalStats);

// All transactions
router.get('/transactions', canManageTransactions, getAllTransactions);

export default router;