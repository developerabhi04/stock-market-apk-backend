import express from 'express';
import {
    getAllIndices,
    getFeaturedIndices,
    getIndexById,
    getIndexBySymbol,
} from './index.controller.js';

const router = express.Router();

router.get('/', getAllIndices);
router.get('/featured', getFeaturedIndices);
router.get('/id/:id', getIndexById);
router.get('/:symbol', getIndexBySymbol);

export default router;