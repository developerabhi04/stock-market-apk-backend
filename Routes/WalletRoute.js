import express from 'express';
import { rateLimiter } from '../Middleware/RateLimiter.js';
import { authenticate } from '../Middleware/Auth.js';
import { addMoney, getTransactions, getWalletBalance, withdrawMoney } from '../Controllers/WalletController.js';

const router = express.Router();

// All routes are protected
router.use(authenticate);

router.get('/balance', getWalletBalance);
router.post('/add-money', rateLimiter(10, 15), addMoney);
router.post('/withdraw', rateLimiter(5, 15), withdrawMoney);
router.get('/transactions', getTransactions);

export default router;
