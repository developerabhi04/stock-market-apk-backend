import { ApiResponse } from '../../shared/utils/apiResponse.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { getReportsOverviewService } from './reports.service.js';

export const getReportsOverview = asyncHandler(async (req, res) => {
    const data = await getReportsOverviewService();

    res
        .status(200)
        .json(new ApiResponse(200, data, 'Reports fetched successfully'));
});