import express from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware.js';         // ← was ../Middleware/Auth.js
import { rateLimiter } from '../../shared/middleware/rateLimiter.middleware.js';  // ← was ../Middleware/RateLimiter.js
import {
    addBankAccount, getBankAccounts, deleteBankAccount,
    setPrimaryBankAccount, getUserProfile, updateUserProfile
} from './user.controller.js';  // ← was ../Controllers/UserController.js

const router = express.Router();

router.use(authenticate);

router.get('/profile', getUserProfile);
router.put('/profile', updateUserProfile);
router.get('/bank-accounts', getBankAccounts);
router.post('/bank-accounts', rateLimiter(10, 15), addBankAccount);
router.delete('/bank-accounts/:accountId', deleteBankAccount);
router.patch('/bank-accounts/:accountId/primary', setPrimaryBankAccount);

export default router;
