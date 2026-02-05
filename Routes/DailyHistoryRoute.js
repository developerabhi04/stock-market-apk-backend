import express from 'express';
import { authenticate } from '../Middleware/Auth.js';
import { authenticateAdmin } from '../Middleware/AdminAuth.js';
import { canManageMarket } from '../Middleware/CheckPermissions.js';
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

// ✅ Admin routes - now uses canManageMarket
router.post('/', authenticateAdmin, canManageMarket, createDailyHistory);
router.put('/:id', authenticateAdmin, canManageMarket, updateDailyHistory);
router.delete('/:id', authenticateAdmin, canManageMarket, deleteDailyHistory);
router.post('/bulk-create', authenticateAdmin, canManageMarket, bulkCreateDailyHistory);
router.post('/generate-sample', authenticateAdmin, canManageMarket, generateSampleDailyHistory);

export default router;
