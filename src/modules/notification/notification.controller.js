import { ApiResponse } from "../../shared/utils/apiResponse.js"
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import {
    sendNotificationToAllService,
    sendNotificationToUserService,
    getNotificationHistoryService,
    getUserNotificationsService,
    markNotificationAsReadService,
    markNotificationAsClickedService,
    getNotificationStatsService,
    deleteNotificationService,
    getUsersForNotificationService,
} from './notification.service.js';

export const sendNotificationToAll = asyncHandler(async (req, res) => {
    const data = await sendNotificationToAllService({
        title: req.body.title,
        message: req.body.message,
        type: req.body.type,
        sentBy: req.admin.adminId,
    });

    return res
        .status(201)
        .json(
            new ApiResponse(
                201,
                data,
                'Notification sent to all users successfully'
            )
        );
});

export const sendNotificationToUser = asyncHandler(async (req, res) => {
    const data = await sendNotificationToUserService({
        userId: req.params.userId,
        title: req.body.title,
        message: req.body.message,
        type: req.body.type,
        sentBy: req.admin.adminId,
    });

    return res
        .status(201)
        .json(
            new ApiResponse(
                201,
                { notification: data.notification },
                `Notification sent to ${data.user.fullName} successfully`
            )
        );
});

export const getNotificationHistory = asyncHandler(async (req, res) => {
    const data = await getNotificationHistoryService(req.query);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                data,
                'Notification history fetched successfully'
            )
        );
});

export const getUserNotifications = asyncHandler(async (req, res) => {
    const data = await getUserNotificationsService({
        userId: req.user.userId,
        page: req.query.page,
        limit: req.query.limit,
    });

    return res
        .status(200)
        .json(new ApiResponse(200, data, 'Notifications fetched successfully'));
});

export const markAsRead = asyncHandler(async (req, res) => {
    const data = await markNotificationAsReadService({
        notificationId: req.params.notificationId,
        userId: req.user.userId,
    });

    return res
        .status(200)
        .json(new ApiResponse(200, data, 'Notification marked as read'));
});

export const markAsClicked = asyncHandler(async (req, res) => {
    const data = await markNotificationAsClickedService({
        notificationId: req.params.notificationId,
        userId: req.user.userId,
    });

    return res
        .status(200)
        .json(new ApiResponse(200, data, 'Notification marked as clicked'));
});

export const getNotificationStats = asyncHandler(async (req, res) => {
    const data = await getNotificationStatsService();

    return res
        .status(200)
        .json(
            new ApiResponse(200, data, 'Notification stats fetched successfully')
        );
});

export const deleteNotification = asyncHandler(async (req, res) => {
    await deleteNotificationService({
        notificationId: req.params.notificationId,
    });

    return res
        .status(200)
        .json(new ApiResponse(200, null, 'Notification deleted successfully'));
});

export const getUsersForNotification = asyncHandler(async (req, res) => {
    const data = await getUsersForNotificationService();

    return res
        .status(200)
        .json(new ApiResponse(200, data, 'Users fetched successfully'));
});