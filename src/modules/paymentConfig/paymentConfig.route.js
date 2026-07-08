import express from 'express';
import { getPublicPaymentConfig } from './paymentConfig.controller.js';

const router = express.Router();

// Public — no auth needed, React Native app reads this
router.get('/public', getPublicPaymentConfig);

export default router;