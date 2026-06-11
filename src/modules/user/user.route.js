import express from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware.js';
import { rateLimiter } from '../../shared/middleware/rateLimiter.middleware.js';
import {
    addBankAccount,
    updateBankAccount,
    getBankAccounts,
    deleteBankAccount,
    setPrimaryBankAccount,
    getUserProfile,
    updateUserProfile,
    checkPhoneExists
} from './user.controller.js';

const router = express.Router();

router.use(authenticate);

router.get('/profile', getUserProfile);
router.put('/profile', updateUserProfile);

router.get('/check-phone/:phoneNumber', checkPhoneExists);

router.get('/bank-accounts', getBankAccounts);
router.post('/bank-accounts', rateLimiter(10, 15), addBankAccount);
router.put('/bank-accounts/:accountId', rateLimiter(10, 15), updateBankAccount);
router.delete('/bank-accounts/:accountId', deleteBankAccount);
router.patch('/bank-accounts/:accountId/primary', setPrimaryBankAccount);

export default router;