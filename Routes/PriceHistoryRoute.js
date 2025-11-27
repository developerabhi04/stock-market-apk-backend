import express from 'express';
import { authenticate } from '../Middleware/Auth.js';
import { authenticateAdmin } from '../Middleware/AdminAuth.js';
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

// Admin routes
router.post('/', authenticate, authenticateAdmin, createOrUpdatePriceHistory);
router.post('/generate-sample', authenticate, authenticateAdmin, generateSampleData);
router.post('/bulk-create', authenticate, authenticateAdmin, bulkCreatePriceHistories);
router.delete('/:ticker/:period', authenticate, authenticateAdmin, deletePriceHistory);

export default router;
