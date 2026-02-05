import express from 'express';
import { authenticateAdmin } from '../Middleware/AdminAuth.js';
import { canManageBanners } from '../Middleware/CheckPermissions.js';
import { uploadBannerImage } from '../Middleware/UploadMiddleware.js';
import {
    getAllBannersPublic,
    getAllBannersAdmin,
    uploadBanner,
    deleteBanner,
    toggleBannerStatus,
    reorderBanners
} from '../Controllers/BannerController.js';

const router = express.Router();

// ==================== PUBLIC ROUTES ====================
router.get('/public', getAllBannersPublic);

// ==================== ADMIN ROUTES ====================
router.use(authenticateAdmin);

// ✅ Now uses canManageBanners instead of isSuperAdmin
router.get('/', canManageBanners, getAllBannersAdmin);
router.post('/', canManageBanners, uploadBannerImage, uploadBanner);
router.delete('/:id', canManageBanners, deleteBanner);
router.patch('/:id/toggle', canManageBanners, toggleBannerStatus);
router.post('/reorder', canManageBanners, reorderBanners);

export default router;
