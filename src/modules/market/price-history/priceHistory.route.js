import express from 'express';
import { authenticateAdmin } from '../../../shared/middleware/adminAuth.middleware.js';
import { canManageMarket } from '../../../shared/middleware/checkPermissions.middleware.js';
import {
    getPriceHistory,
    getAllPeriods,
    createOrUpdatePriceHistory,
    generateSampleData,
    deletePriceHistory,
    bulkCreatePriceHistories
} from './priceHistory.controller.js';

const router = express.Router();

router.get('/', getPriceHistory);
router.get('/:ticker/all', getAllPeriods);

router.post('/', authenticateAdmin, canManageMarket, createOrUpdatePriceHistory);
router.post('/generate-sample', authenticateAdmin, canManageMarket, generateSampleData);
router.post('/bulk-create', authenticateAdmin, canManageMarket, bulkCreatePriceHistories);
router.delete('/:ticker/:period', authenticateAdmin, canManageMarket, deletePriceHistory);

export default router;