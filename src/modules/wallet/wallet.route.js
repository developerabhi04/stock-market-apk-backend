import express from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware.js';
import { rateLimiter } from '../../shared/middleware/rateLimiter.middleware.js';
import {
    addMoney,
    getTransactions,
    getWalletBalance,
    withdrawMoney
} from './wallet.controller.js';

const router = express.Router();

router.use(authenticate);

router.get('/balance', getWalletBalance);
router.post('/add-money', rateLimiter(10, 15), addMoney);
router.post('/withdraw', rateLimiter(5, 15), withdrawMoney);
router.get('/transactions', getTransactions);

export default router;