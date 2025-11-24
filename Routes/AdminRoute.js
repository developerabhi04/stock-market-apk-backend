import express from 'express';
import { authenticateAdmin } from '../Middleware/AdminAuth.js';
import { adminLogin, approvePayment, approveWithdrawal, createFirstAdmin, getAllTransactions, getAllUsers, getDashboardStats, getPendingPayments, getPendingWithdrawals, getUserDetails, getUserStats, getWithdrawalStats, rejectPayment, rejectWithdrawal, updateUserBalance } from '../Controllers/AdminController.js';


const router = express.Router();

// ✅ Public routes (no auth required)
router.post('/login', adminLogin);
router.post('/create-first-admin', createFirstAdmin);  

// ✅ Protected routes (require admin auth)
router.use(authenticateAdmin);

router.get('/dashboard/stats', getDashboardStats);
router.get('/payments/pending', getPendingPayments);
router.post('/payments/approve', approvePayment);
router.post('/payments/reject', rejectPayment);

// Transaction
router.get('/transactions', getAllTransactions);


// ✅ NEW: Withdrawal Management
router.get('/withdrawals/pending', getPendingWithdrawals);
router.post('/withdrawals/approve', approveWithdrawal);
router.post('/withdrawals/reject', rejectWithdrawal);
router.get('/withdrawals/stats', getWithdrawalStats);


// ✅ NEW: User Management Routes
router.get('/users', getAllUsers);
router.get('/users/stats', getUserStats);
router.get('/users/:userId', getUserDetails);
router.post('/users/update-balance', updateUserBalance);




export default router;
