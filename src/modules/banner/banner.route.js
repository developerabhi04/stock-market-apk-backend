import express from 'express';
import { authenticateAdmin } from '../../shared/middleware/adminAuth.middleware.js';
import { canManageBanners } from '../../shared/middleware/checkPermissions.middleware.js';
import { uploadBannerImage } from '../../shared/middleware/upload.middleware.js';
import {
    deleteBanner,
    getAllBannersAdmin,
    getAllBannersPublic,
    reorderBanners,
    toggleBannerStatus,
    uploadBanner
} from './banner.controller.js';

const router = express.Router();

// ==================== PUBLIC ====================
router.get('/public', getAllBannersPublic);

// ==================== ADMIN ====================
router.use(authenticateAdmin);

router.get('/', canManageBanners, getAllBannersAdmin);
router.post('/', canManageBanners, uploadBannerImage, uploadBanner);
router.delete('/:id', canManageBanners, deleteBanner);
router.patch('/:id/toggle', canManageBanners, toggleBannerStatus);
router.post('/reorder', canManageBanners, reorderBanners);

export default router;