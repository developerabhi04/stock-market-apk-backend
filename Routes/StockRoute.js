import express from 'express';
import { authenticate } from '../Middleware/Auth.js';
import { authenticateAdmin } from '../Middleware/AdminAuth.js';
import { canManageMarket } from '../Middleware/CheckPermissions.js';
import {
    getAllStocks,
    getStockByTicker,
    createStock,
    updateStock,
    deleteStock,
    bulkUpdateStockPrices
} from '../Controllers/StockController.js';

const router = express.Router();

// Public routes
router.get('/', getAllStocks);
router.get('/:ticker', getStockByTicker);

// ✅ Admin routes - now uses canManageMarket
router.post('/', authenticateAdmin, canManageMarket, createStock);
router.put('/:id', authenticateAdmin, canManageMarket, updateStock);
router.delete('/:id', authenticateAdmin, canManageMarket, deleteStock);
router.post('/bulk-update', authenticateAdmin, canManageMarket, bulkUpdateStockPrices);

export default router;
