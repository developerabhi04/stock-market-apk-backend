import express from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware.js';
import { authenticateAdmin } from '../../shared/middleware/adminAuth.middleware.js';
import {
    canManageReferrals,
} from '../../shared/middleware/checkPermissions.middleware.js';
import {
    getMyReferralInfo,
    getMyReferralHistory,
    getAllReferralsAdmin,
    getReferralStatsAdmin,
} from './referral.controller.js';

const router = express.Router();

// User routes
router.get('/my-info', authenticate, getMyReferralInfo);
router.get('/my-history', authenticate, getMyReferralHistory);

// Admin routes
router.get('/admin/all', authenticateAdmin, canManageReferrals, getAllReferralsAdmin);
router.get('/admin/stats', authenticateAdmin, canManageReferrals, getReferralStatsAdmin);

export default router;