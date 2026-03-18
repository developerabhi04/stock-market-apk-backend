import express from 'express';
import { authenticateAdmin } from '../Middleware/AdminAuth.js';
import { canManageNotifications } from '../Middleware/CheckPermissions.js';
import { authenticate } from '../Middleware/Auth.js';
import {
    sendNotificationToAll,
    sendNotificationToUser,
    getNotificationHistory,
    getUserNotifications,
    markAsRead,
    markAsClicked,
    getNotificationStats,
    deleteNotification,
    getUsersForNotification
} from '../Controllers/NotificationController.js';

const router = express.Router();

// ==================== ADMIN ROUTES ====================
// ✅ Now uses canManageNotifications instead of isSuperAdmin
router.post('/admin/send-all', authenticateAdmin, canManageNotifications, sendNotificationToAll);
router.post('/admin/send/:userId', authenticateAdmin, canManageNotifications, sendNotificationToUser);
router.get('/admin/history', authenticateAdmin, canManageNotifications, getNotificationHistory);
router.get('/admin/stats', authenticateAdmin, canManageNotifications, getNotificationStats);
router.delete('/admin/:notificationId', authenticateAdmin, canManageNotifications, deleteNotification);
router.get('/admin/users-list', authenticateAdmin, canManageNotifications, getUsersForNotification);

// ==================== USER ROUTES (Mobile App) ====================
router.get('/user', authenticate, getUserNotifications);
router.patch('/user/:notificationId/read', authenticate, markAsRead);
router.patch('/user/:notificationId/click', authenticate, markAsClicked);

export default router;
