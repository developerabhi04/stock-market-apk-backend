import { ApiResponse } from '../../../shared/utils/apiResponse.js';
import { asyncHandler } from '../../../shared/utils/asyncHandler.js';
import {
    getPriceHistoryService,
    getAllPeriodsService,
    createOrUpdatePriceHistoryService,
    generateSampleDataService,
    deletePriceHistoryService,
    bulkCreatePriceHistoriesService
} from './priceHistory.service.js';

export const getPriceHistory = asyncHandler(async (req, res) => {
    const history = await getPriceHistoryService({
        ticker: req.query.ticker,
        period: req.query.period,
        type: req.query.type
    });

    res.status(200).json(new ApiResponse(200, { history }));
});

export const getAllPeriods = asyncHandler(async (req, res) => {
    const histories = await getAllPeriodsService({
        ticker: req.params.ticker
    });

    res.status(200).json(new ApiResponse(200, { histories }));
});

export const createOrUpdatePriceHistory = asyncHandler(async (req, res) => {
    const history = await createOrUpdatePriceHistoryService(req.body);

    res
        .status(200)
        .json(new ApiResponse(200, { history }, 'Price history saved successfully'));
});

export const generateSampleData = asyncHandler(async (req, res) => {
    const history = await generateSampleDataService(req.body);

    res
        .status(201)
        .json(new ApiResponse(201, { history }, 'Sample price history generated successfully'));
});

export const bulkCreatePriceHistories = asyncHandler(async (req, res) => {
    const result = await bulkCreatePriceHistoriesService(req.body);

    res
        .status(200)
        .json(new ApiResponse(200, result, 'Bulk create completed successfully'));
});

export const deletePriceHistory = asyncHandler(async (req, res) => {
    await deletePriceHistoryService({
        ticker: req.params.ticker,
        period: req.params.period
    });

    res
        .status(200)
        .json(new ApiResponse(200, null, 'Price history deleted successfully'));
});