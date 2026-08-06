import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { ApiResponse } from '../../shared/utils/apiResponse.js';
import { ApiError } from '../../shared/utils/apiError.js';
import {
    getMyReferralInfoService,
    getMyReferralHistoryService,
    getAllReferralsAdminService,
    getReferralStatsAdminService,
} from './referral.service.js';

const getAuthenticatedUserId = (req) => {
    const userId = req.user?._id || req.user?.id || req.user?.userId;
    if (!userId) {
        throw new ApiError(401, 'Authenticated user id not found in token');
    }
    return userId;
};

export const getMyReferralInfo = asyncHandler(async (req, res) => {
    const data = await getMyReferralInfoService({ userId: getAuthenticatedUserId(req) });
    res.status(200).json(new ApiResponse(200, data, 'Referral info fetched successfully'));
});

export const getMyReferralHistory = asyncHandler(async (req, res) => {
    const data = await getMyReferralHistoryService({
        userId: getAuthenticatedUserId(req),
        page: req.query.page,
        limit: req.query.limit,
    });
    res.status(200).json(new ApiResponse(200, data, 'Referral history fetched successfully'));
});

// Admin
export const getAllReferralsAdmin = asyncHandler(async (req, res) => {
    const data = await getAllReferralsAdminService(req.query);
    res.status(200).json(new ApiResponse(200, data, 'All referrals fetched successfully'));
});

export const getReferralStatsAdmin = asyncHandler(async (req, res) => {
    const data = await getReferralStatsAdminService();
    res.status(200).json(new ApiResponse(200, data, 'Referral stats fetched successfully'));
});