import express from 'express';
import { authenticate } from '../Middleware/Auth.js';
import { authenticateAdmin } from '../Middleware/AdminAuth.js';
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

// Admin routes
router.post('/', authenticate, authenticateAdmin, createStock);
router.put('/:id', authenticate, authenticateAdmin, updateStock);
router.delete('/:id', authenticate, authenticateAdmin, deleteStock);
router.post('/bulk-update', authenticate, authenticateAdmin, bulkUpdateStockPrices);

export default router;
