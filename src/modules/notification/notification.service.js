import Notification from './notification.model.js';
import User from '../user/user.model.js';
import { ApiError } from '../../shared/utils/apiError.js';

const validateNotificationPayload = ({ title, message }) => {
    if (!title || !message) {
        throw new ApiError(400, 'Title and message are required');
    }

    if (title.length > 50) {
        throw new ApiError(400, 'Title cannot exceed 50 characters');
    }

    if (message.length > 200) {
        throw new ApiError(400, 'Message cannot exceed 200 characters');
    }
};

export const sendNotificationToAllService = async ({
    title,
    message,
    type,
    sentBy,
}) => {
    validateNotificationPayload({ title, message });

    const notification = await Notification.create({
        title,
        message,
        type: type || 'general',
        recipients: 'all',
        sentBy,
    });

    return { notification };
};

export const sendNotificationToUserService = async ({
    userId,
    title,
    message,
    type,
    sentBy,
}) => {
    validateNotificationPayload({ title, message });

    const user = await User.findById(userId).lean();

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    const notification = await Notification.create({
        title,
        message,
        type: type || 'general',
        recipients: 'individual',
        userId,
        sentBy,
    });

    return {
        notification,
        user,
    };
};

export const getNotificationHistoryService = async ({
    page = 1,
    limit = 20,
    type,
    recipients,
}) => {
    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.max(Number(limit) || 20, 1);

    const filter = {};
    if (type) filter.type = type;
    if (recipients) filter.recipients = recipients;

    const notifications = await Notification.find(filter)
        .sort({ createdAt: -1 })
        .populate('sentBy', 'username fullName')
        .populate({
            path: 'userId',
            select: 'fullName phoneNumber walletBalance createdAt',
        })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean();

    const total = await Notification.countDocuments(filter);

    return {
        notifications,
        totalPages: Math.ceil(total / limitNum),
        currentPage: pageNum,
        total,
    };
};

export const getUserNotificationsService = async ({
    userId,
    page = 1,
    limit = 20,
}) => {
    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.max(Number(limit) || 20, 1);

    const filter = {
        $or: [
            { userId, recipients: 'individual' },
            { recipients: 'all' },
        ],
    };

    const notifications = await Notification.find(filter)
        .sort({ createdAt: -1 })
        .select('title message type createdAt readBy clickedBy')
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean();

    const total = await Notification.countDocuments(filter);

    const notificationsWithStatus = notifications.map((notification) => ({
        ...notification,
        isRead:
            notification.readBy?.some((id) => id.toString() === userId.toString()) || false,
        isClicked:
            notification.clickedBy?.some((id) => id.toString() === userId.toString()) || false,
    }));

    const unreadCount = notificationsWithStatus.filter(
        (notification) => !notification.isRead
    ).length;

    return {
        notifications: notificationsWithStatus,
        totalPages: Math.ceil(total / limitNum),
        currentPage: pageNum,
        total,
        unreadCount,
    };
};

export const markNotificationAsReadService = async ({
    notificationId,
    userId,
}) => {
    const notification = await Notification.findByIdAndUpdate(
        notificationId,
        { $addToSet: { readBy: userId } },
        { new: true }
    ).lean();

    if (!notification) {
        throw new ApiError(404, 'Notification not found');
    }

    return { notification };
};

export const markNotificationAsClickedService = async ({
    notificationId,
    userId,
}) => {
    const notification = await Notification.findByIdAndUpdate(
        notificationId,
        {
            $addToSet: {
                clickedBy: userId,
                readBy: userId,
            },
        },
        { new: true }
    ).lean();

    if (!notification) {
        throw new ApiError(404, 'Notification not found');
    }

    return { notification };
};

export const getNotificationStatsService = async () => {
    const stats = await Notification.aggregate([
        {
            $group: {
                _id: '$type',
                count: { $sum: 1 },
                totalReads: { $sum: { $size: { $ifNull: ['$readBy', []] } } },
                totalClicks: { $sum: { $size: { $ifNull: ['$clickedBy', []] } } },
            },
        },
    ]);

    const [total, toAll, toIndividual] = await Promise.all([
        Notification.countDocuments(),
        Notification.countDocuments({ recipients: 'all' }),
        Notification.countDocuments({ recipients: 'individual' }),
    ]);

    return {
        stats,
        summary: {
            total,
            toAll,
            toIndividual,
        },
    };
};

export const deleteNotificationService = async ({ notificationId }) => {
    const notification = await Notification.findByIdAndDelete(notificationId).lean();

    if (!notification) {
        throw new ApiError(404, 'Notification not found');
    }

    return null;
};

export const getUsersForNotificationService = async () => {
    const users = await User.find({ isActive: true })
        .select('fullName phoneNumber walletBalance createdAt')
        .lean();

    return { users };
};