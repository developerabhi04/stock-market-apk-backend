import express from 'express';
import {
    getAllStocks,
    getStockByTicker,
} from './stock.controller.js';

const router = express.Router();

router.get('/', getAllStocks);
router.get('/:ticker', getStockByTicker);

export default router;