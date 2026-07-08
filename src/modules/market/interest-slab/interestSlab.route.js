import express from 'express';
import {
    createInterestSlab,
    deleteInterestSlab,
    getActiveInterestSlabs,
    getAllInterestSlabs,
    getInterestSlabByAmount,
    getInterestSlabById,
    updateInterestSlab,
} from './interestSlab.controller.js';
import { authenticate } from '../../../shared/middleware/auth.middleware.js';
import { authenticateAdmin } from '../../../shared/middleware/adminAuth.middleware.js';
import { canManageMarket } from '../../../shared/middleware/checkPermissions.middleware.js';

const router = express.Router();

// Public/User-facing helper route
router.get('/resolve', authenticate, getInterestSlabByAmount);

// Admin routes
router.get('/', authenticateAdmin, canManageMarket, getAllInterestSlabs);
router.get('/active', authenticateAdmin, canManageMarket, getActiveInterestSlabs);
router.get('/:slabId', authenticateAdmin, canManageMarket, getInterestSlabById);
router.post('/', authenticateAdmin, canManageMarket, createInterestSlab);
router.patch('/:slabId', authenticateAdmin, canManageMarket, updateInterestSlab);
router.delete('/:slabId', authenticateAdmin, canManageMarket, deleteInterestSlab);

export default router;