import express from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware.js';
import { authenticateAdmin } from '../../../shared/middleware/adminAuth.middleware.js';
import { canManageMarket } from '../../../shared/middleware/checkPermissions.middleware.js';
import {
    approveInvestmentOrder,
    cancelInvestment,
    getAllInvestmentOrdersAdmin,
    getInvestmentByIdAdmin,
    getMyInvestmentById,
    getMyOrders,
    getMyPortfolio,
    overrideInvestmentRate,
    placeInvestmentOrder,
    rejectInvestmentOrder,
    resolveInvestmentPreview,
    unlockInvestment,
    renewInvestment,
    reinvestInvestment,
} from './investment.controller.js';

const router = express.Router();

// User Routes
router.post('/preview', authenticate, resolveInvestmentPreview);
router.post('/orders', authenticate, placeInvestmentOrder);
router.get('/my-orders', authenticate, getMyOrders);
router.get('/portfolio', authenticate, getMyPortfolio);

// Admin Routes
router.get('/admin/orders', authenticateAdmin, canManageMarket, getAllInvestmentOrdersAdmin);
router.get('/admin/:investmentId', authenticateAdmin, canManageMarket, getInvestmentByIdAdmin);
router.patch('/admin/:investmentId/approve', authenticateAdmin, canManageMarket, approveInvestmentOrder);
router.patch('/admin/:investmentId/reject', authenticateAdmin, canManageMarket, rejectInvestmentOrder);
router.patch('/admin/:investmentId/rate', authenticateAdmin, canManageMarket, overrideInvestmentRate);


// Unlock / Renew / Reinvest
router.post('/:investmentId/unlock', authenticate, unlockInvestment);
router.post('/:investmentId/renew', authenticate, renewInvestment);
router.post('/:investmentId/reinvest', authenticate, reinvestInvestment);
router.post('/:investmentId/cancel', authenticate, cancelInvestment);

// Dynamic route last
router.get('/:investmentId', authenticate, getMyInvestmentById);

export default router;