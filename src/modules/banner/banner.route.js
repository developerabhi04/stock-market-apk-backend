// banner.routes.js
import express from 'express';
import { authenticateAdmin } from '../../shared/middleware/adminAuth.middleware.js';
import { canManageBanners } from '../../shared/middleware/checkPermissions.middleware.js';
import {
    deleteBanner,
    getAllBannersAdmin,
    getAllBannersPublic,
    toggleBannerStatus,
    uploadBanner
} from './banner.controller.js';

const router = express.Router();

// ==================== PUBLIC ====================
router.get('/public', getAllBannersPublic);

// ==================== ADMIN ====================
router.use(authenticateAdmin);

router.get('/', canManageBanners, getAllBannersAdmin);
router.post('/', canManageBanners, uploadBanner);
router.delete('/:id', canManageBanners, deleteBanner);
router.patch('/:id/toggle', canManageBanners, toggleBannerStatus);

export default router;