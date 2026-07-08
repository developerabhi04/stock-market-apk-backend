import express from 'express';
import {
    getAdminPaymentConfig,
    updateBankConfig,
    updateFullPaymentConfig,
    updateUpiConfig,
} from './paymentConfig.controller.js';
import { authenticateAdmin } from '../../shared/middleware/adminAuth.middleware.js';

const router = express.Router();

// All routes require admin auth
router.use(authenticateAdmin);

router.get('/', getAdminPaymentConfig);           // GET full config
router.put('/', updateFullPaymentConfig);          // PUT full config (save all)
router.put('/upi', updateUpiConfig);              // PUT UPI only
router.put('/bank', updateBankConfig);            // PUT Bank only

export default router;