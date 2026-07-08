import PriceHistory from './priceHistory.model.js';
import { ApiError } from '../../../shared/utils/apiError.js';

const normalizeTicker = (ticker) => ticker?.toUpperCase().trim();

const validPeriods = ['1D', '1W', '1M', '3M', '6M', '1Y', '5Y', 'All'];
const validTypes = ['Stock', 'Index'];


const validateDataPoints = (data = []) => {
    if (!Array.isArray(data) || data.length === 0) {
        throw new ApiError(400, 'Price history data array is required');
    }

    for (const point of data) {
        if (!point.timestamp || point.value === undefined) {
            throw new ApiError(400, 'Each data point must include timestamp and value');
        }

        if (Number(point.value) < 0) {
            throw new ApiError(400, 'Value cannot be negative');
        }
    }
};

export const getPriceHistoryService = async ({ ticker, period, type }) => {
    if (!ticker || !period) {
        throw new ApiError(400, 'Ticker and period are required');
    }

    const normalizedTicker = normalizeTicker(ticker);

    const history = await PriceHistory.findOne({
        ticker: normalizedTicker,
        period,
        ...(type ? { type } : {})
    }).lean();

    if (!history) {
        throw new ApiError(404, 'Price history not found');
    }

    return history;
};

export const getAllPeriodsService = async ({ ticker }) => {
    if (!ticker) {
        throw new ApiError(400, 'Ticker is required');
    }

    const histories = await PriceHistory.find({
        ticker: normalizeTicker(ticker)
    })
        .sort({ createdAt: -1 })
        .lean();

    return histories;
};

export const createOrUpdatePriceHistoryService = async (payload) => {
    const { ticker, type = 'Stock', period, data } = payload;

    if (!ticker || !period || !data) {
        throw new ApiError(400, 'Ticker, period and data are required');
    }

    if (!validPeriods.includes(period)) {
        throw new ApiError(400, 'Invalid period');
    }

    if (!validTypes.includes(type)) {
        throw new ApiError(400, 'Invalid type');
    }

    validateDataPoints(data);

    const history = await PriceHistory.findOneAndUpdate(
        {
            ticker: normalizeTicker(ticker),
            period
        },
        {
            ticker: normalizeTicker(ticker),
            type,
            period,
            data,
            lastUpdated: new Date()
        },
        {
            new: true,
            upsert: true,
            runValidators: true
        }
    );

    return history;
};

export const deletePriceHistoryService = async ({ ticker, period }) => {
    if (!ticker || !period) {
        throw new ApiError(400, 'Ticker and period are required');
    }

    const deleted = await PriceHistory.findOneAndDelete({
        ticker: normalizeTicker(ticker),
        period
    });

    if (!deleted) {
        throw new ApiError(404, 'Price history not found');
    }

    return deleted;
};

export const bulkCreatePriceHistoriesService = async ({ histories }) => {
    if (!Array.isArray(histories) || histories.length === 0) {
        throw new ApiError(400, 'Histories array is required');
    }

    const results = [];

    for (const history of histories) {
        try {
            const created = await createOrUpdatePriceHistoryService(history);

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

    return { results };
};

export const generateSampleDataService = async ({
    ticker,
    type = 'Stock',
    period,
    points = 30,
    baseValue = 100
}) => {
    if (!ticker || !period) {
        throw new ApiError(400, 'Ticker and period are required');
    }

    if (!validPeriods.includes(period)) {
        throw new ApiError(400, 'Invalid period');
    }

    if (!validTypes.includes(type)) {
        throw new ApiError(400, 'Invalid type');
    }

    const data = [];
    let currentValue = Number(baseValue);
    const now = new Date();

    for (let i = points - 1; i >= 0; i--) {
        const timestamp = new Date(now);
        timestamp.setDate(now.getDate() - i);

        const randomChange = (Math.random() - 0.5) * currentValue * 0.05;
        currentValue = Math.max(1, currentValue + randomChange);

        data.push({
            timestamp,
            value: Number(currentValue.toFixed(2)),
            volume: Math.floor(Math.random() * 1000000),
            label: timestamp.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short'
            })
        });
    }

    const history = await PriceHistory.findOneAndUpdate(
        {
            ticker: normalizeTicker(ticker),
            period
        },
        {
            ticker: normalizeTicker(ticker),
            type,
            period,
            data,
            lastUpdated: new Date()
        },
        {
            new: true,
            upsert: true,
            runValidators: true
        }
    );

    return history;
};