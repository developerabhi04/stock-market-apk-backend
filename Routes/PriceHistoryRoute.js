import express from 'express';
import { authenticate } from '../Middleware/Auth.js';
import { authenticateAdmin } from '../Middleware/AdminAuth.js';
import { canManageMarket } from '../Middleware/CheckPermissions.js';
import {
    getPriceHistory,
    getAllPeriods,
    createOrUpdatePriceHistory,
    generateSampleData,
    deletePriceHistory,
    bulkCreatePriceHistories
} from '../Controllers/PriceHistoryController.js';

const router = express.Router();

// Public routes
router.get('/', getPriceHistory);
router.get('/:ticker/all', getAllPeriods);

// ✅ Admin routes - now uses canManageMarket
router.post('/', authenticateAdmin, canManageMarket, createOrUpdatePriceHistory);
router.post('/generate-sample', authenticateAdmin, canManageMarket, generateSampleData);
router.post('/bulk-create', authenticateAdmin, canManageMarket, bulkCreatePriceHistories);
router.delete('/:ticker/:period', authenticateAdmin, canManageMarket, deletePriceHistory);

export default router;
