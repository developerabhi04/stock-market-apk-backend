import PriceHistory from '../Models/PriceHistoryModel.js';
import Stock from '../Models/StockModel.js';
import Index from '../Models/IndexModel.js';
import { ApiError } from '../Utils/apiError.js';
import { ApiResponse } from '../Utils/apiResponse.js';
import { asyncHandler } from '../Utils/asyncHandler.js';

/**
 * Get Price History for Chart
 */
export const getPriceHistory = asyncHandler(async (req, res) => {
    const { ticker, period = '1D' } = req.query;

    if (!ticker) {
        throw new ApiError(400, 'Ticker is required');
    }

    const history = await PriceHistory.findOne({
        ticker: ticker.toUpperCase(),
        period: period.toUpperCase()
    });

    if (!history) {
        throw new ApiError(404, 'Price history not found');
    }

    res.status(200).json(
        new ApiResponse(200, {
            ticker: history.ticker,
            period: history.period,
            data: history.data,
            lastUpdated: history.lastUpdated
        })
    );
});

/**
 * Get All Periods for a Ticker
 */
export const getAllPeriods = asyncHandler(async (req, res) => {
    const { ticker } = req.params;

    if (!ticker) {
        throw new ApiError(400, 'Ticker is required');
    }

    const histories = await PriceHistory.find({
        ticker: ticker.toUpperCase()
    }).select('period data lastUpdated');

    if (!histories || histories.length === 0) {
        throw new ApiError(404, 'No price history found');
    }

    const response = {};
    histories.forEach(history => {
        response[history.period] = {
            data: history.data,
            lastUpdated: history.lastUpdated
        };
    });

    res.status(200).json(
        new ApiResponse(200, {
            ticker: ticker.toUpperCase(),
            periods: response
        })
    );
});

/**
 * Create/Update Price History (Admin)
 */
export const createOrUpdatePriceHistory = asyncHandler(async (req, res) => {
    const { ticker, type, period, data } = req.body;

    // Validation
    if (!ticker || !type || !period || !data || !Array.isArray(data)) {
        throw new ApiError(400, 'Ticker, type, period, and data array are required');
    }

    // Validate data format
    const isValidData = data.every(point => 
        point.timestamp && 
        point.value !== undefined && 
        typeof point.value === 'number'
    );

    if (!isValidData) {
        throw new ApiError(400, 'Each data point must have timestamp and value');
    }

    // Check if stock/index exists
    if (type === 'Stock') {
        const stock = await Stock.findOne({ ticker: ticker.toUpperCase() });
        if (!stock) {
            throw new ApiError(404, 'Stock not found');
        }
    } else if (type === 'Index') {
        const index = await Index.findOne({ symbol: ticker.toUpperCase() });
        if (!index) {
            throw new ApiError(404, 'Index not found');
        }
    }

    // Update or create
    const history = await PriceHistory.findOneAndUpdate(
        {
            ticker: ticker.toUpperCase(),
            period: period.toUpperCase()
        },
        {
            ticker: ticker.toUpperCase(),
            type,
            period: period.toUpperCase(),
            data: data.map(point => ({
                timestamp: new Date(point.timestamp),
                value: point.value,
                volume: point.volume || 0,
                label: point.label || ''
            })),
            lastUpdated: new Date()
        },
        {
            upsert: true,
            new: true,
            runValidators: true
        }
    );

    res.status(200).json(
        new ApiResponse(200, { history }, 'Price history updated successfully')
    );
});

/**
 * Generate Sample Data (Admin - for testing)
 */
export const generateSampleData = asyncHandler(async (req, res) => {
    const { ticker, type, period, basePrice, days } = req.body;

    if (!ticker || !type || !period || !basePrice || !days) {
        throw new ApiError(400, 'All fields are required');
    }

    const data = [];
    let currentPrice = basePrice;
    const now = new Date();

    for (let i = days; i >= 0; i--) {
        const timestamp = new Date(now);
        timestamp.setDate(timestamp.getDate() - i);

        // Random price change (-2% to +2%)
        const change = (Math.random() - 0.5) * 0.04 * currentPrice;
        currentPrice = Math.max(currentPrice + change, basePrice * 0.8); // Don't drop below 20%

        data.push({
            timestamp,
            value: parseFloat(currentPrice.toFixed(2)),
            volume: Math.floor(Math.random() * 1000000) + 100000,
            label: timestamp.toLocaleDateString('en-IN', { 
                month: 'short', 
                day: 'numeric' 
            })
        });
    }

    const history = await PriceHistory.findOneAndUpdate(
        {
            ticker: ticker.toUpperCase(),
            period: period.toUpperCase()
        },
        {
            ticker: ticker.toUpperCase(),
            type,
            period: period.toUpperCase(),
            data,
            lastUpdated: new Date()
        },
        {
            upsert: true,
            new: true,
            runValidators: true
        }
    );

    res.status(200).json(
        new ApiResponse(200, { history }, 'Sample data generated successfully')
    );
});

/**
 * Delete Price History (Admin)
 */
export const deletePriceHistory = asyncHandler(async (req, res) => {
    const { ticker, period } = req.params;

    const history = await PriceHistory.findOneAndDelete({
        ticker: ticker.toUpperCase(),
        period: period.toUpperCase()
    });

    if (!history) {
        throw new ApiError(404, 'Price history not found');
    }

    res.status(200).json(
        new ApiResponse(200, null, 'Price history deleted successfully')
    );
});

/**
 * Bulk Create Price Histories (Admin)
 */
export const bulkCreatePriceHistories = asyncHandler(async (req, res) => {
    const { histories } = req.body;

    if (!Array.isArray(histories) || histories.length === 0) {
        throw new ApiError(400, 'Histories array is required');
    }

    const results = [];

    for (const history of histories) {
        try {
            const created = await PriceHistory.findOneAndUpdate(
                {
                    ticker: history.ticker.toUpperCase(),
                    period: history.period.toUpperCase()
                },
                {
                    ...history,
                    ticker: history.ticker.toUpperCase(),
                    period: history.period.toUpperCase(),
                    lastUpdated: new Date()
                },
                {
                    upsert: true,
                    new: true
                }
            );

            results.push({
                ticker: history.ticker,
                period: history.period,
                success: true,
                id: created._id
            });
        } catch (error) {
            results.push({
                ticker: history.ticker,
                period: history.period,
                success: false,
                error: error.message
            });
        }
    }

    res.status(200).json(
        new ApiResponse(200, { results }, 'Bulk create completed')
    );
});
