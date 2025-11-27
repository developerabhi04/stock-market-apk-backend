import Index from '../Models/IndexModel.js';
import { ApiError } from '../Utils/apiError.js';
import { ApiResponse } from '../Utils/apiResponse.js';
import { asyncHandler } from '../Utils/asyncHandler.js';

/**
 * Get All Indices
 */
export const getAllIndices = asyncHandler(async (req, res) => {
    const { category, featured, active, page = 1, limit = 100 } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (featured !== undefined) filter.isFeatured = featured === 'true';
    if (active !== undefined) filter.isActive = active === 'true';

    const indices = await Index.find(filter)
        .sort({ isFeatured: -1, currentValue: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

    const count = await Index.countDocuments(filter);

    res.status(200).json(
        new ApiResponse(200, {
            indices,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            total: count
        })
    );
});

/**
 * Get Featured Indices
 */
export const getFeaturedIndices = asyncHandler(async (req, res) => {
    const indices = await Index.find({ isFeatured: true, isActive: true })
        .sort({ currentValue: -1 })
        .limit(10)
        .lean();

    res.status(200).json(new ApiResponse(200, { indices }));
});

/**
 * Get Index by Symbol
 */
export const getIndexBySymbol = asyncHandler(async (req, res) => {
    const { symbol } = req.params;

    const index = await Index.findOne({ symbol: symbol.toUpperCase(), isActive: true });

    if (!index) {
        throw new ApiError(404, 'Index not found');
    }

    res.status(200).json(new ApiResponse(200, { index }));
});

/**
 * Create Index (Admin)
 */
export const createIndex = asyncHandler(async (req, res) => {
    const {
        name,
        symbol,
        category,
        currentValue,
        openValue,
        highValue,
        lowValue,
        previousClose,
        icon,
        isFeatured,
        marketCap,
        volume,
        description
    } = req.body;

    // Validation
    if (!name || !symbol || !category || !currentValue || !openValue || !highValue || !lowValue || !previousClose) {
        throw new ApiError(400, 'All required fields must be provided');
    }

    // Check if index already exists
    const existingIndex = await Index.findOne({ symbol: symbol.toUpperCase() });
    if (existingIndex) {
        throw new ApiError(409, 'Index with this symbol already exists');
    }

    // Calculate change
    const change = currentValue - previousClose;
    const changePercent = ((change / previousClose) * 100).toFixed(2);

    const index = await Index.create({
        name: name.trim(),
        symbol: symbol.toUpperCase().trim(),
        category,
        currentValue,
        openValue,
        highValue,
        lowValue,
        previousClose,
        change,
        changePercent,
        icon: icon || 'chart-line',
        isFeatured: isFeatured || false,
        marketCap,
        volume,
        description,
        isActive: true
    });

    res.status(201).json(
        new ApiResponse(201, { index }, 'Index created successfully')
    );
});

/**
 * Update Index (Admin)
 */
export const updateIndex = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    const index = await Index.findById(id);

    if (!index) {
        throw new ApiError(404, 'Index not found');
    }

    // If currentValue is being updated, recalculate change
    if (updateData.currentValue) {
        updateData.change = updateData.currentValue - (updateData.previousClose || index.previousClose);
        updateData.changePercent = ((updateData.change / (updateData.previousClose || index.previousClose)) * 100).toFixed(2);
        updateData.lastUpdated = new Date();
    }

    Object.assign(index, updateData);
    await index.save();

    res.status(200).json(
        new ApiResponse(200, { index }, 'Index updated successfully')
    );
});

/**
 * Delete Index (Admin)
 */
export const deleteIndex = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const index = await Index.findByIdAndDelete(id);

    if (!index) {
        throw new ApiError(404, 'Index not found');
    }

    res.status(200).json(
        new ApiResponse(200, null, 'Index deleted successfully')
    );
});

/**
 * Bulk Update Prices (Admin)
 */
export const bulkUpdatePrices = asyncHandler(async (req, res) => {
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
        throw new ApiError(400, 'Updates array is required');
    }

    const results = [];

    for (const update of updates) {
        try {
            const index = await Index.findOne({ symbol: update.symbol.toUpperCase() });
            
            if (index) {
                await index.updatePrice(update.currentValue);
                results.push({ symbol: update.symbol, success: true });
            } else {
                results.push({ symbol: update.symbol, success: false, message: 'Not found' });
            }
        } catch (error) {
            results.push({ symbol: update.symbol, success: false, message: error.message });
        }
    }

    res.status(200).json(
        new ApiResponse(200, { results }, 'Bulk update completed')
    );
});
