import { ApiResponse } from '../../../shared/utils/apiResponse.js';
import { asyncHandler } from '../../../shared/utils/asyncHandler.js';
import {
    getDailyHistoryService,
    getTodayDataService,
    createDailyHistoryService,
    updateDailyHistoryService,
    deleteDailyHistoryService,
    bulkCreateDailyHistoryService,
    generateSampleDailyHistoryService
} from './dailyHistory.service.js';

export const getDailyHistory = asyncHandler(async (req, res) => {
    const data = await getDailyHistoryService({
        ticker: req.params.ticker,
        page: req.query.page || 1,
        limit: req.query.limit || 10
    });

    res.status(200).json(new ApiResponse(200, data));
});

export const getTodayData = asyncHandler(async (req, res) => {
    const data = await getTodayDataService({
        ticker: req.params.ticker
    });

    res.status(200).json(new ApiResponse(200, { data }));
});

export const createDailyHistory = asyncHandler(async (req, res) => {
    const history = await createDailyHistoryService(req.body);

    res
        .status(201)
        .json(new ApiResponse(201, { history }, 'Daily history created successfully'));
});

export const updateDailyHistory = asyncHandler(async (req, res) => {
    const history = await updateDailyHistoryService({
        id: req.params.id,
        updateData: req.body
    });

    res
        .status(200)
        .json(new ApiResponse(200, { history }, 'Daily history updated successfully'));
});

export const deleteDailyHistory = asyncHandler(async (req, res) => {
    await deleteDailyHistoryService({ id: req.params.id });

    res
        .status(200)
        .json(new ApiResponse(200, null, 'Daily history deleted successfully'));
});

export const bulkCreateDailyHistory = asyncHandler(async (req, res) => {
    const result = await bulkCreateDailyHistoryService(req.body);

    res.status(200).json(new ApiResponse(200, result, 'Bulk create completed'));
});

export const generateSampleDailyHistory = asyncHandler(async (req, res) => {
    const result = await generateSampleDailyHistoryService(req.body);

    res
        .status(201)
        .json(new ApiResponse(201, result, 'Sample data generated successfully'));
});