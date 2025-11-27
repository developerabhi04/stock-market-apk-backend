import express from 'express';
import { authenticate } from '../Middleware/Auth.js';
import { authenticateAdmin } from '../Middleware/AdminAuth.js';
import {
    getDailyHistory,
    getTodayData,
    createDailyHistory,
    updateDailyHistory,
    deleteDailyHistory,
    bulkCreateDailyHistory,
    generateSampleDailyHistory
} from '../Controllers/DailyHistoryController.js';

const router = express.Router();

// Public routes
router.get('/:ticker', getDailyHistory);
router.get('/:ticker/today', getTodayData);

// Admin routes
router.post('/', authenticate, authenticateAdmin, createDailyHistory);
router.put('/:id', authenticate, authenticateAdmin, updateDailyHistory);
router.delete('/:id', authenticate, authenticateAdmin, deleteDailyHistory);
router.post('/bulk-create', authenticate, authenticateAdmin, bulkCreateDailyHistory);
router.post('/generate-sample', authenticate, authenticateAdmin, generateSampleDailyHistory);

export default router;
