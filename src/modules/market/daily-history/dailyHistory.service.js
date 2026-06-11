import DailyHistory from './dailyHistory.model.js';
import { ApiError } from '../../../shared/Utils/apiError.js';

const normalizeTicker = (ticker) => ticker?.toUpperCase().trim();

const validatePriceData = ({ open, close, high, low }) => {
    if (high < low) {
        throw new ApiError(400, 'High price cannot be less than low price');
    }

    if (high < open || high < close || low > open || low > close) {
        throw new ApiError(400, 'Invalid price data: high/low must contain open/close');
    }
};

const calculateChangeData = (open, close) => {
    const change = close - open;
    const changePercent = Number(((change / open) * 100).toFixed(2));
    return { change, changePercent };
};

export const getDailyHistoryService = async ({ ticker, page = 1, limit = 10 }) => {
    if (!ticker) {
        throw new ApiError(400, 'Ticker is required');
    }

    const normalizedTicker = normalizeTicker(ticker);
    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    const history = await DailyHistory.find({ ticker: normalizedTicker })
        .sort({ date: -1 })
        .limit(limitNumber)
        .skip((pageNumber - 1) * limitNumber)
        .lean();

    const count = await DailyHistory.countDocuments({ ticker: normalizedTicker });

    return {
        ticker: normalizedTicker,
        history,
        totalPages: Math.ceil(count / limitNumber),
        currentPage: pageNumber,
        total: count
    };
};

export const getTodayDataService = async ({ ticker }) => {
    if (!ticker) {
        throw new ApiError(400, 'Ticker is required');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const data = await DailyHistory.findOne({
        ticker: normalizeTicker(ticker),
        date: { $gte: today }
    });

    if (!data) {
        throw new ApiError(404, 'No data for today');
    }

    return data;
};

export const createDailyHistoryService = async (payload) => {
    const { ticker, date, day, open, close, high, low, volume } = payload;

    if (
        !ticker ||
        !date ||
        !day ||
        open === undefined ||
        close === undefined ||
        high === undefined ||
        low === undefined
    ) {
        throw new ApiError(400, 'All required fields must be provided');
    }

    validatePriceData({ open, close, high, low });
    const { change, changePercent } = calculateChangeData(open, close);

    const history = await DailyHistory.create({
        ticker: normalizeTicker(ticker),
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

    return history;
};

export const updateDailyHistoryService = async ({ id, updateData }) => {
    const history = await DailyHistory.findById(id);

    if (!history) {
        throw new ApiError(404, 'Daily history not found');
    }

    const open = updateData.open ?? history.open;
    const close = updateData.close ?? history.close;
    const high = updateData.high ?? history.high;
    const low = updateData.low ?? history.low;

    validatePriceData({ open, close, high, low });

    if (updateData.open !== undefined || updateData.close !== undefined) {
        const { change, changePercent } = calculateChangeData(open, close);
        updateData.change = change;
        updateData.changePercent = changePercent;
    }

    Object.assign(history, updateData);
    await history.save();

    return history;
};

export const deleteDailyHistoryService = async ({ id }) => {
    const history = await DailyHistory.findByIdAndDelete(id);

    if (!history) {
        throw new ApiError(404, 'Daily history not found');
    }

    return history;
};

export const bulkCreateDailyHistoryService = async ({ histories }) => {
    if (!Array.isArray(histories) || histories.length === 0) {
        throw new ApiError(400, 'Histories array is required');
    }

    const results = [];

    for (const history of histories) {
        try {
            const { change, changePercent } = calculateChangeData(history.open, history.close);

            const created = await DailyHistory.create({
                ...history,
                ticker: normalizeTicker(history.ticker),
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

    return { results };
};

export const generateSampleDailyHistoryService = async ({
    ticker,
    startDate,
    days,
    basePrice
}) => {
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

        if (date.getDay() === 0 || date.getDay() === 6) continue;

        const dayName = daysOfWeek[date.getDay() - 1];

        const openChange = (Math.random() - 0.5) * 0.1 * currentPrice;
        const open = Math.max(currentPrice + openChange, basePrice * 0.5);

        const closeChange = (Math.random() - 0.5) * 0.08 * open;
        const close = Math.max(open + closeChange, basePrice * 0.5);

        const high = Math.max(open, close) * (1 + Math.random() * 0.03);
        const low = Math.min(open, close) * (1 - Math.random() * 0.03);

        const { change, changePercent } = calculateChangeData(open, close);

        histories.push({
            ticker: normalizeTicker(ticker),
            date,
            day: dayName,
            open: Number(open.toFixed(2)),
            close: Number(close.toFixed(2)),
            high: Number(high.toFixed(2)),
            low: Number(low.toFixed(2)),
            volume: Math.floor(Math.random() * 1000000) + 100000,
            change: Number(change.toFixed(2)),
            changePercent
        });

        currentPrice = close;
    }

    const created = await DailyHistory.insertMany(histories);

    return {
        count: created.length,
        histories: created
    };
};