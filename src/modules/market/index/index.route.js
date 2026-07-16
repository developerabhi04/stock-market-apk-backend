import express from 'express';
import {
    getAllIndices,
    getFeaturedIndices,
    getIndicesBySymbol,
} from './index.controller.js';

const router = express.Router();

router.get('/', getAllIndices);
router.get('/featured', getFeaturedIndices);
router.get('/:symbol', getIndicesBySymbol);

export default router;