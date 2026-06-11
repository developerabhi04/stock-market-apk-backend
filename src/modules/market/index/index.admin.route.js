import express from 'express';
import { authenticateAdmin } from '../../../shared/middleware/adminAuth.middleware.js';
import { canManageMarket } from '../../../shared/middleware/checkPermissions.middleware.js';
import {
    getAdminIndices,
    createIndex,
    updateIndex,
    deleteIndex,
} from './index.controller.js';

const router = express.Router();

router.use(authenticateAdmin);
router.use(canManageMarket);


router.get('/indices', getAdminIndices);
router.post('/indices', createIndex);
router.put('/indices/:id', updateIndex);
router.delete('/indices/:id', deleteIndex);

export default router;