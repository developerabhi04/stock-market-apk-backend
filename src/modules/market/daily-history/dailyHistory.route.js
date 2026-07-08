import express from 'express';
import { authenticateAdmin } from '../../../shared/middleware/adminAuth.middleware.js';
import { canManageMarket } from '../../../shared/middleware/checkPermissions.middleware.js';
import {
    getDailyHistory,
    getTodayData,
    createDailyHistory,
    updateDailyHistory,
    deleteDailyHistory,
    bulkCreateDailyHistory,
    generateSampleDailyHistory
} from './dailyHistory.controller.js';

const router = express.Router();


router.get('/:ticker/today', getTodayData);
router.get('/:ticker', getDailyHistory);

router.post('/', authenticateAdmin, canManageMarket, createDailyHistory);
router.put('/:id', authenticateAdmin, canManageMarket, updateDailyHistory);
router.delete('/:id', authenticateAdmin, canManageMarket, deleteDailyHistory);
router.post('/bulk-create', authenticateAdmin, canManageMarket, bulkCreateDailyHistory);
router.post('/generate-sample', authenticateAdmin, canManageMarket, generateSampleDailyHistory);

export default router;