import Stock from './stock.model.js';
import { ApiError } from '../../../shared/utils/apiError.js';

export const getAllStocksService = async ({
    category,
    featured,
    active,
    sector,
    page = 1,
    limit = 100
}) => {
    const filter = {};
    if (category) filter.category = category;
    if (featured !== undefined) filter.isFeatured = featured === 'true';
    if (active !== undefined) filter.isActive = active === 'true';
    if (sector) filter.sector = sector;

    const pageNum = Number(page);
    const limitNum = Number(limit);

    const stocks = await Stock.find(filter)
        .sort({ isFeatured: -1, price: -1 })
        .limit(limitNum)
        .skip((pageNum - 1) * limitNum)
        .lean();

    const count = await Stock.countDocuments(filter);

    return {
        stocks,
        totalPages: Math.ceil(count / limitNum),
        currentPage: pageNum,
        total: count
    };
};

export const getStockByTickerService = async ({ ticker }) => {
    const stock = await Stock.findOne({
        ticker: ticker.toUpperCase(),
        isActive: true
    }).lean();

    if (!stock) {
        throw new ApiError(404, 'Stock not found');
    }

    return { stock };
};

export const createStockService = async (payload) => {
    const {
        name,
        ticker,
        symbol,
        price,
        openPrice,
        highPrice,
        lowPrice,
        previousClose,
        volume,
        marketCap,
        sector,
        category,
        isFeatured,
        icon,
        description
    } = payload;

    if (
        !name ||
        !ticker ||
        !symbol ||
        price === undefined ||
        openPrice === undefined ||
        highPrice === undefined ||
        lowPrice === undefined ||
        previousClose === undefined
    ) {
        throw new ApiError(400, 'All required fields must be provided');
    }

    const existingStock = await Stock.findOne({ ticker: ticker.toUpperCase() });
    if (existingStock) {
        throw new ApiError(409, 'Stock with this ticker already exists');
    }

    const change = Number(price) - Number(previousClose);
    const changePercent = Number(((change / Number(previousClose)) * 100).toFixed(2));

    const stock = await Stock.create({
        name: name.trim(),
        ticker: ticker.toUpperCase().trim(),
        symbol: symbol.toUpperCase().trim(),
        price: Number(price),
        openPrice: Number(openPrice),
        highPrice: Number(highPrice),
        lowPrice: Number(lowPrice),
        previousClose: Number(previousClose),
        change,
        changePercent,
        volume: Number(volume) || 0,
        marketCap,
        sector,
        category: category || 'Stock',
        isFeatured: isFeatured || false,
        icon: icon || 'chart-line',
        description,
        isActive: true
    });

    return { stock };
};

export const updateStockService = async ({ id, updateData }) => {
    const stock = await Stock.findById(id);

    if (!stock) {
        throw new ApiError(404, 'Stock not found');
    }

    if (updateData.price !== undefined) {
        const previousClose = updateData.previousClose ?? stock.previousClose;
        updateData.change = Number(updateData.price) - Number(previousClose);
        updateData.changePercent = Number(
            ((updateData.change / Number(previousClose)) * 100).toFixed(2)
        );
        updateData.lastUpdated = new Date();
    }

    Object.assign(stock, updateData);
    await stock.save();

    return { stock };
};

export const deleteStockService = async ({ id }) => {
    const stock = await Stock.findByIdAndDelete(id);

    if (!stock) {
        throw new ApiError(404, 'Stock not found');
    }

    return null;
};

export const bulkUpdateStockPricesService = async ({ updates }) => {
    if (!Array.isArray(updates) || updates.length === 0) {
        throw new ApiError(400, 'Updates array is required');
    }

    const results = [];

    for (const update of updates) {
        try {
            const stock = await Stock.findOne({ ticker: update.ticker.toUpperCase() });

            if (stock) {
                await stock.updatePrice(update.price);
                results.push({ ticker: update.ticker, success: true });
            } else {
                results.push({
                    ticker: update.ticker,
                    success: false,
                    message: 'Not found'
                });
            }
        } catch (error) {
            results.push({
                ticker: update.ticker,
                success: false,
                message: error.message
            });
        }
    }

    return { results };
};