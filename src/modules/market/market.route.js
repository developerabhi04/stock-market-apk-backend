import express from 'express';

import categoryRoutes from './category/category.route.js';
import indexRoutes from './index/index.route.js';
import dailyHistoryRoutes from './daily-history/dailyHistory.route.js';
import priceHistoryRoutes from './price-history/priceHistory.route.js';
import stockRoutes from './stock/stock.route.js';

const router = express.Router();

router.use('/categories', categoryRoutes);
router.use('/indices', indexRoutes);
router.use('/daily-history', dailyHistoryRoutes);
router.use('/price-history', priceHistoryRoutes);
router.use('/stocks', stockRoutes);

export default router;