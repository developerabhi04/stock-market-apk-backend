import express from 'express';
import { authenticate } from '../Middleware/Auth.js';
import {
    addBankAccount,
    getBankAccounts,
    deleteBankAccount,
    setPrimaryBankAccount,
    getUserProfile,
    updateUserProfile
} from '../Controllers/UserController.js';
import { rateLimiter } from '../Middleware/RateLimiter.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Profile routes
router.get('/profile', getUserProfile);
router.put('/profile', updateUserProfile);


// Bank account routes
router.get('/bank-accounts', getBankAccounts);
router.post('/bank-accounts', rateLimiter(10, 15), addBankAccount);
router.delete('/bank-accounts/:accountId', deleteBankAccount);
router.patch('/bank-accounts/:accountId/primary', setPrimaryBankAccount);



export default router;
