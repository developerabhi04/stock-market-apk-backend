import Stock from '../Models/StockModel.js';
import { ApiError } from '../Utils/apiError.js';
import { ApiResponse } from '../Utils/apiResponse.js';
import { asyncHandler } from '../Utils/asyncHandler.js';

/**
 * Get All Stocks
 */
export const getAllStocks = asyncHandler(async (req, res) => {
    const { category, featured, active, sector, page = 1, limit = 100 } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (featured !== undefined) filter.isFeatured = featured === 'true';
    if (active !== undefined) filter.isActive = active === 'true';
    if (sector) filter.sector = sector;

    const stocks = await Stock.find(filter)
        .sort({ isFeatured: -1, price: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

    const count = await Stock.countDocuments(filter);

    res.status(200).json(
        new ApiResponse(200, {
            stocks,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            total: count
        })
    );
});

/**
 * Get Stock by Ticker
 */
export const getStockByTicker = asyncHandler(async (req, res) => {
    const { ticker } = req.params;

    const stock = await Stock.findOne({ ticker: ticker.toUpperCase(), isActive: true });

    if (!stock) {
        throw new ApiError(404, 'Stock not found');
    }

    res.status(200).json(new ApiResponse(200, { stock }));
});

/**
 * Create Stock (Admin)
 */
export const createStock = asyncHandler(async (req, res) => {
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
    } = req.body;

    // Validation
    if (!name || !ticker || !symbol || !price || !openPrice || !highPrice || !lowPrice || !previousClose) {
        throw new ApiError(400, 'All required fields must be provided');
    }

    // Check if stock already exists
    const existingStock = await Stock.findOne({ ticker: ticker.toUpperCase() });
    if (existingStock) {
        throw new ApiError(409, 'Stock with this ticker already exists');
    }

    // Calculate change
    const change = price - previousClose;
    const changePercent = ((change / previousClose) * 100).toFixed(2);

    const stock = await Stock.create({
        name: name.trim(),
        ticker: ticker.toUpperCase().trim(),
        symbol: symbol.toUpperCase().trim(),
        price,
        openPrice,
        highPrice,
        lowPrice,
        previousClose,
        change,
        changePercent,
        volume: volume || 0,
        marketCap,
        sector,
        category: category || 'Stock',
        isFeatured: isFeatured || false,
        icon: icon || 'chart-line',
        description,
        isActive: true
    });

    res.status(201).json(
        new ApiResponse(201, { stock }, 'Stock created successfully')
    );
});

/**
 * Update Stock (Admin)
 */
export const updateStock = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    const stock = await Stock.findById(id);

    if (!stock) {
        throw new ApiError(404, 'Stock not found');
    }

    // If price is being updated, recalculate change
    if (updateData.price) {
        updateData.change = updateData.price - (updateData.previousClose || stock.previousClose);
        updateData.changePercent = ((updateData.change / (updateData.previousClose || stock.previousClose)) * 100).toFixed(2);
        updateData.lastUpdated = new Date();
    }

    Object.assign(stock, updateData);
    await stock.save();

    res.status(200).json(
        new ApiResponse(200, { stock }, 'Stock updated successfully')
    );
});

/**
 * Delete Stock (Admin)
 */
export const deleteStock = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const stock = await Stock.findByIdAndDelete(id);

    if (!stock) {
        throw new ApiError(404, 'Stock not found');
    }

    res.status(200).json(
        new ApiResponse(200, null, 'Stock deleted successfully')
    );
});

/**
 * Bulk Update Stock Prices (Admin)
 */
export const bulkUpdateStockPrices = asyncHandler(async (req, res) => {
    const { updates } = req.body;

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
                results.push({ ticker: update.ticker, success: false, message: 'Not found' });
            }
        } catch (error) {
            results.push({ ticker: update.ticker, success: false, message: error.message });
        }
    }

    res.status(200).json(
        new ApiResponse(200, { results }, 'Bulk update completed')
    );
});
