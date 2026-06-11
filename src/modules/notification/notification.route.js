import express from 'express';
import { authenticateAdmin } from '../../shared/middleware/adminAuth.middleware.js';
import { canManageNotifications } from '../../shared/middleware/checkPermissions.middleware.js';
import { authenticate } from '../../shared/middleware/auth.middleware.js';
import {
    sendNotificationToAll,
    sendNotificationToUser,
    getNotificationHistory,
    getUserNotifications,
    markAsRead,
    markAsClicked,
    getNotificationStats,
    deleteNotification,
    getUsersForNotification,
} from './notification.controller.js';

const router = express.Router();

// Admin routes
router.post(
    '/admin/send-all',
    authenticateAdmin,
    canManageNotifications,
    sendNotificationToAll
);

router.post(
    '/admin/send/:userId',
    authenticateAdmin,
    canManageNotifications,
    sendNotificationToUser
);

router.get(
    '/admin/history',
    authenticateAdmin,
    canManageNotifications,
    getNotificationHistory
);

router.get(
    '/admin/stats',
    authenticateAdmin,
    canManageNotifications,
    getNotificationStats
);

router.delete(
    '/admin/:notificationId',
    authenticateAdmin,
    canManageNotifications,
    deleteNotification
);

router.get(
    '/admin/users-list',
    authenticateAdmin,
    canManageNotifications,
    getUsersForNotification
);

// User routes
router.get('/user', authenticate, getUserNotifications);
router.patch('/user/:notificationId/read', authenticate, markAsRead);
router.patch('/user/:notificationId/click', authenticate, markAsClicked);

export default router;