import DailyHistory from '../Models/DailyHistoryModel.js';
import Stock from '../Models/StockModel.js';
import Index from '../Models/IndexModel.js';
import { ApiError } from '../Utils/apiError.js';
import { ApiResponse } from '../Utils/apiResponse.js';
import { asyncHandler } from '../Utils/asyncHandler.js';

/**
 * Get Daily History
 */
export const getDailyHistory = asyncHandler(async (req, res) => {
    const { ticker } = req.params;
    const { days = 30, page = 1, limit = 10 } = req.query;

    if (!ticker) {
        throw new ApiError(400, 'Ticker is required');
    }

    const history = await DailyHistory.find({
        ticker: ticker.toUpperCase()
    })
        .sort({ date: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

    const count = await DailyHistory.countDocuments({
        ticker: ticker.toUpperCase()
    });

    res.status(200).json(
        new ApiResponse(200, {
            ticker: ticker.toUpperCase(),
            history,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            total: count
        })
    );
});

/**
 * Get Today's Data
 */
export const getTodayData = asyncHandler(async (req, res) => {
    const { ticker } = req.params;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayData = await DailyHistory.findOne({
        ticker: ticker.toUpperCase(),
        date: { $gte: today }
    });

    if (!todayData) {
        throw new ApiError(404, 'No data for today');
    }

    res.status(200).json(
        new ApiResponse(200, { data: todayData })
    );
});

/**
 * Create Daily History Entry (Admin)
 */
export const createDailyHistory = asyncHandler(async (req, res) => {
    const {
        ticker,
        date,
        day,
        open,
        close,
        high,
        low,
        volume
    } = req.body;

    // Validation
    if (!ticker || !date || !day || !open || !close || !high || !low) {
        throw new ApiError(400, 'All required fields must be provided');
    }

    // Validate high/low
    if (high < low) {
        throw new ApiError(400, 'High price cannot be less than low price');
    }

    if (high < open || high < close || low > open || low > close) {
        throw new ApiError(400, 'Invalid price data: high/low must contain open/close');
    }

    // Calculate change
    const change = close - open;
    const changePercent = ((change / open) * 100).toFixed(2);

    const history = await DailyHistory.create({
        ticker: ticker.toUpperCase(),
        date: new Date(date),
        day: day.trim(),
        open,
        close,
        high,
        low,
        volume: volume || 0,
        change,
        changePercent
    });

    res.status(201).json(
        new ApiResponse(201, { history }, 'Daily history created successfully')
    );
});

/**
 * Update Daily History (Admin)
 */
export const updateDailyHistory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    const history = await DailyHistory.findById(id);

    if (!history) {
        throw new ApiError(404, 'Daily history not found');
    }

    // Recalculate change if prices updated
    if (updateData.open || updateData.close) {
        const open = updateData.open || history.open;
        const close = updateData.close || history.close;
        updateData.change = close - open;
        updateData.changePercent = ((updateData.change / open) * 100).toFixed(2);
    }

    Object.assign(history, updateData);
    await history.save();

    res.status(200).json(
        new ApiResponse(200, { history }, 'Daily history updated successfully')
    );
});

/**
 * Delete Daily History (Admin)
 */
export const deleteDailyHistory = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const history = await DailyHistory.findByIdAndDelete(id);

    if (!history) {
        throw new ApiError(404, 'Daily history not found');
    }

    res.status(200).json(
        new ApiResponse(200, null, 'Daily history deleted successfully')
    );
});

/**
 * Bulk Create Daily History (Admin)
 */
export const bulkCreateDailyHistory = asyncHandler(async (req, res) => {
    const { histories } = req.body;

    if (!Array.isArray(histories) || histories.length === 0) {
        throw new ApiError(400, 'Histories array is required');
    }

    const results = [];

    for (const history of histories) {
        try {
            const change = history.close - history.open;
            const changePercent = ((change / history.open) * 100).toFixed(2);

            const created = await DailyHistory.create({
                ...history,
                ticker: history.ticker.toUpperCase(),
                date: new Date(history.date),
                change,
                changePercent
            });

            results.push({
                ticker: history.ticker,
                date: history.date,
                success: true,
                id: created._id
            });
        } catch (error) {
            results.push({
                ticker: history.ticker,
                date: history.date,
                success: false,
                error: error.message
            });
        }
    }

    res.status(200).json(
        new ApiResponse(200, { results }, 'Bulk create completed')
    );
});

/**
 * Generate Sample Daily History (Admin)
 */
export const generateSampleDailyHistory = asyncHandler(async (req, res) => {
    const { ticker, startDate, days, basePrice } = req.body;

    if (!ticker || !startDate || !days || !basePrice) {
        throw new ApiError(400, 'All fields are required');
    }

    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const histories = [];
    let currentPrice = basePrice;
    const start = new Date(startDate);

    for (let i = 0; i < days; i++) {
        const date = new Date(start);
        date.setDate(date.getDate() + i);

        // Skip weekends
        if (date.getDay() === 0 || date.getDay() === 6) {
            continue;
        }

        const dayName = daysOfWeek[date.getDay() - 1];

        // Random daily change (-5% to +5%)
        const openChange = (Math.random() - 0.5) * 0.1 * currentPrice;
        const open = Math.max(currentPrice + openChange, basePrice * 0.5);

        const closeChange = (Math.random() - 0.5) * 0.08 * open;
        const close = Math.max(open + closeChange, basePrice * 0.5);

        const high = Math.max(open, close) * (1 + Math.random() * 0.03);
        const low = Math.min(open, close) * (1 - Math.random() * 0.03);

        const change = close - open;
        const changePercent = ((change / open) * 100).toFixed(2);

        histories.push({
            ticker: ticker.toUpperCase(),
            date,
            day: dayName,
            open: parseFloat(open.toFixed(2)),
            close: parseFloat(close.toFixed(2)),
            high: parseFloat(high.toFixed(2)),
            low: parseFloat(low.toFixed(2)),
            volume: Math.floor(Math.random() * 1000000) + 100000,
            change: parseFloat(change.toFixed(2)),
            changePercent: parseFloat(changePercent)
        });

        currentPrice = close;
    }

    const created = await DailyHistory.insertMany(histories);

    res.status(201).json(
        new ApiResponse(201, {
            count: created.length,
            histories: created
        }, 'Sample data generated successfully')
    );
});
