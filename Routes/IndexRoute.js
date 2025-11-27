import express from 'express';
import { authenticate } from '../Middleware/Auth.js';
import { authenticateAdmin } from '../Middleware/AdminAuth.js';
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

// Admin routes
router.post('/', authenticate, authenticateAdmin, createIndex);
router.put('/:id', authenticate, authenticateAdmin, updateIndex);
router.delete('/:id', authenticate, authenticateAdmin, deleteIndex);
router.post('/bulk-update', authenticate, authenticateAdmin, bulkUpdatePrices);

export default router;
