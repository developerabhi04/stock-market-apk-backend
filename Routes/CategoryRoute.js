import express from 'express';
import { authenticateAdmin } from '../Middleware/AdminAuth.js';
import { canManageCategories } from '../Middleware/CheckPermissions.js';
import {
    getAllCategories,
    getActiveCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getCategoryStats
} from '../Controllers/CategoryController.js';

const router = express.Router();

// ==================== PUBLIC ROUTES ====================
router.get('/active', getActiveCategories);

// ==================== ADMIN ROUTES ====================
router.use(authenticateAdmin);

// ✅ Now uses canManageCategories instead of isSuperAdmin
router.get('/', canManageCategories, getAllCategories);
router.get('/stats', canManageCategories, getCategoryStats);
router.post('/', canManageCategories, createCategory);
router.put('/:id', canManageCategories, updateCategory);
router.delete('/:id', canManageCategories, deleteCategory);

export default router;
