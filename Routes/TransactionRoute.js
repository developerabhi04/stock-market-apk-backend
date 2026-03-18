import express from "express";
import { authenticateAdmin } from "../Middleware/AdminAuth.js";
import { approvePayment, approveWithdrawal, getPendingPayments, getPendingWithdrawals, rejectPayment, rejectWithdrawal } from "../Controllers/TransactionModel.js";
import { canAccessPayments, canManageTransactions } from "../Middleware/CheckPermissions.js";
import { getAllTransactions, getWithdrawalStats } from "../Controllers/AdminController.js";

const router = express.Router();

router.use(authenticateAdmin);

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


export default router;