import express from 'express';
import { authenticateAdmin } from '../../../shared/middleware/adminAuth.middleware.js';
import { canManageCategories } from '../../../shared/middleware/checkPermissions.middleware.js';
import {
    getAllCategories,
    getActiveCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getCategoryStats,
} from './category.controller.js';

const router = express.Router();

// Public route
router.get('/active', getActiveCategories);

// Admin routes
router.use(authenticateAdmin);
router.use(canManageCategories);

router.get('/', getAllCategories);
router.get('/stats', getCategoryStats);
router.post('/', createCategory);
router.put('/:id', updateCategory);
router.delete('/:id', deleteCategory);

export default router;