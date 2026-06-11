import express from 'express';
import { authenticateAdmin } from '../../shared/middleware/adminAuth.middleware.js';
import { getReportsOverview } from './reports.controller.js';

const router = express.Router();

router.get('/reports/overview', authenticateAdmin, getReportsOverview);

export default router;