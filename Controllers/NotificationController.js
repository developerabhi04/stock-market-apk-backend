import Notification from '../Models/NotificationModel.js';
import User from '../Models/UserModel.js';
import { ApiError } from '../Utils/apiError.js';
import { ApiResponse } from '../Utils/apiResponse.js';
import { asyncHandler } from '../Utils/asyncHandler.js';

/**
 * ✅ Send Notification to All Users
 */
export const sendNotificationToAll = asyncHandler(async (req, res) => {
    const { title, message, type } = req.body;

    // Validation
    if (!title || !message) {
        throw new ApiError(400, 'Title and message are required');
    }

    if (title.length > 50) {
        throw new ApiError(400, 'Title cannot exceed 50 characters');
    }

    if (message.length > 200) {
        throw new ApiError(400, 'Message cannot exceed 200 characters');
    }

    // Create notification record
    const notification = await Notification.create({
        title,
        message,
        type: type || 'general',
        recipients: 'all',
        sentBy: req.admin.adminId
    });

    // TODO: Integrate with Firebase Cloud Messaging (FCM) or your push notification service
    // Example:
    // await sendPushNotificationToAll({ title, message, type });

    console.log('📢 Notification sent to all users:', notification);

    res.status(201).json(
        new ApiResponse(201, { notification }, 'Notification sent to all users successfully')
    );
});

/**
 * ✅ Send Notification to Individual User
 */
export const sendNotificationToUser = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { title, message, type } = req.body;

    // Validation
    if (!title || !message) {
        throw new ApiError(400, 'Title and message are required');
    }

    if (title.length > 50) {
        throw new ApiError(400, 'Title cannot exceed 50 characters');
    }

    if (message.length > 200) {
        throw new ApiError(400, 'Message cannot exceed 200 characters');
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    // Create notification record
    const notification = await Notification.create({
        title,
        message,
        type: type || 'general',
        recipients: 'individual',
        userId,
        sentBy: req.admin.adminId
    });

    // TODO: Integrate with FCM to send push notification to specific user
    // Example:
    // if (user.fcmToken) {
    //     await sendPushNotificationToDevice(user.fcmToken, { title, message, type });
    // }

    console.log('📧 Notification sent to user:', userId, notification);

    res.status(201).json(
        new ApiResponse(201, { notification }, `Notification sent to ${user.fullName} successfully`)
    );
});

/**
 * ✅ Get Notification History (Admin)
 */
export const getNotificationHistory = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, type, recipients } = req.query;

    const filter = {};

    if (type) {
        filter.type = type;
    }

    if (recipients) {
        filter.recipients = recipients;
    }

    const notifications = await Notification.find(filter)
        .sort({ createdAt: -1 })
        .populate('sentBy', 'username fullName')
        .populate('userId', 'fullName phone')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

    const count = await Notification.countDocuments(filter);

    res.status(200).json(
        new ApiResponse(200, {
            notifications,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page),
            total: count
        }, 'Notification history fetched successfully')
    );
});

/**
 * ✅ Get User Notifications (For Mobile App)
 */
export const getUserNotifications = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { page = 1, limit = 20 } = req.query;

    // Get notifications sent to this user or to all users
    const notifications = await Notification.find({
        $or: [
            { userId: userId, recipients: 'individual' },
            { recipients: 'all' }
        ]
    })
        .sort({ createdAt: -1 })
        .select('title message type createdAt readBy clickedBy')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

    const count = await Notification.countDocuments({
        $or: [
            { userId: userId, recipients: 'individual' },
            { recipients: 'all' }
        ]
    });

    // Mark notifications with read/clicked status
    const notificationsWithStatus = notifications.map(notif => ({
        ...notif,
        isRead: notif.readBy?.includes(userId) || false,
        isClicked: notif.clickedBy?.includes(userId) || false
    }));

    res.status(200).json(
        new ApiResponse(200, {
            notifications: notificationsWithStatus,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page),
            total: count,
            unreadCount: notifications.filter(n => !n.readBy?.includes(userId)).length
        })
    );
});

/**
 * ✅ Mark Notification as Read
 */
export const markAsRead = asyncHandler(async (req, res) => {
    const { notificationId } = req.params;
    const userId = req.user.userId;

    const notification = await Notification.findByIdAndUpdate(
        notificationId,
        { $addToSet: { readBy: userId } },
        { new: true }
    );

    if (!notification) {
        throw new ApiError(404, 'Notification not found');
    }

    res.status(200).json(
        new ApiResponse(200, { notification }, 'Notification marked as read')
    );
});

/**
 * ✅ Mark Notification as Clicked
 */
export const markAsClicked = asyncHandler(async (req, res) => {
    const { notificationId } = req.params;
    const userId = req.user.userId;

    const notification = await Notification.findByIdAndUpdate(
        notificationId,
        {
            $addToSet: {
                clickedBy: userId,
                readBy: userId // Also mark as read when clicked
            }
        },
        { new: true }
    );

    if (!notification) {
        throw new ApiError(404, 'Notification not found');
    }

    res.status(200).json(
        new ApiResponse(200, { notification }, 'Notification marked as clicked')
    );
});

/**
 * ✅ Get Notification Statistics
 */
export const getNotificationStats = asyncHandler(async (req, res) => {
    const stats = await Notification.aggregate([
        {
            $group: {
                _id: '$type',
                count: { $sum: 1 },
                totalReads: { $sum: { $size: { $ifNull: ['$readBy', []] } } },
                totalClicks: { $sum: { $size: { $ifNull: ['$clickedBy', []] } } }
            }
        }
    ]);

    const totalNotifications = await Notification.countDocuments();
    const totalToAll = await Notification.countDocuments({ recipients: 'all' });
    const totalToIndividual = await Notification.countDocuments({ recipients: 'individual' });

    res.status(200).json(
        new ApiResponse(200, {
            stats,
            summary: {
                total: totalNotifications,
                toAll: totalToAll,
                toIndividual: totalToIndividual
            }
        })
    );
});

/**
 * ✅ Delete Notification (Admin)
 */
export const deleteNotification = asyncHandler(async (req, res) => {
    const { notificationId } = req.params;

    const notification = await Notification.findByIdAndDelete(notificationId);

    if (!notification) {
        throw new ApiError(404, 'Notification not found');
    }

    res.status(200).json(
        new ApiResponse(200, null, 'Notification deleted successfully')
    );
});
