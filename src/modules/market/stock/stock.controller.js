import { ApiError } from '../../../shared/utils/apiError.js';
import { ApiResponse } from '../../../shared/utils/apiResponse.js';
import { asyncHandler } from '../../../shared/utils/asyncHandler.js';
import {
    getAllStocksService,
    getStockByTickerService,
} from './stock.service.js';

export const getAllStocks = asyncHandler(async (req, res) => {
    const data = await getAllStocksService(req.query);

    res.status(200).json(new ApiResponse(200, data));
});

export const getStockByTicker = asyncHandler(async (req, res) => {
    const data = await getStockByTickerService({ ticker: req.params.ticker });

    res.status(200).json(new ApiResponse(200, data));
});
