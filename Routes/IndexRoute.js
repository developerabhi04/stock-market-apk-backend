import express from 'express';
import { authenticate } from '../Middleware/Auth.js';
import { authenticateAdmin } from '../Middleware/AdminAuth.js';
import { canManageMarket } from '../Middleware/CheckPermissions.js';
import {
    getAllIndices,
    getFeaturedIndices,
    getIndexBySymbol,
    createIndex,
    updateIndex,
    deleteIndex,
    bulkUpdatePrices
} from '../Controllers/IndexController.js';

const router = express.Router();

// Public routes
router.get('/', getAllIndices);
router.get('/featured', getFeaturedIndices);
router.get('/:symbol', getIndexBySymbol);

// ✅ Admin routes - now uses canManageMarket
router.post('/', authenticateAdmin, canManageMarket, createIndex);
router.put('/:id', authenticateAdmin, canManageMarket, updateIndex);
router.delete('/:id', authenticateAdmin, canManageMarket, deleteIndex);
router.post('/bulk-update', authenticateAdmin, canManageMarket, bulkUpdatePrices);

export default router;
