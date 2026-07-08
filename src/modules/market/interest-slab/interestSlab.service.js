import mongoose from 'mongoose';
import InterestSlab from './interestSlab.model.js';
import { ApiError } from '../../../shared/utils/apiError.js';

const normalizeNumericField = (value, fieldName) => {
    const numericValue = Number(value);

    if (Number.isNaN(numericValue)) {
        throw new ApiError(400, `${fieldName} must be a valid number`);
    }

    return numericValue;
};

const buildSlabResponse = (slab) => ({
    ...slab,
    id: slab._id,
    dailyRate:
        slab.dailyRate === null || typeof slab.dailyRate === 'undefined'
            ? null
            : Number(slab.dailyRate),
    minAmount:
        slab.minAmount === null || typeof slab.minAmount === 'undefined'
            ? null
            : Number(slab.minAmount),
    maxAmount:
        slab.maxAmount === null || typeof slab.maxAmount === 'undefined'
            ? null
            : Number(slab.maxAmount),
});

const ensureValidPayload = ({ title, minAmount, maxAmount, dailyRate }) => {
    if (!title?.trim()) {
        throw new ApiError(400, 'Slab title is required');
    }

    const normalizedMinAmount = normalizeNumericField(minAmount, 'Minimum amount');
    const normalizedMaxAmount = normalizeNumericField(maxAmount, 'Maximum amount');
    const normalizedDailyRate = normalizeNumericField(dailyRate, 'Daily rate');

    if (normalizedMinAmount < 0) {
        throw new ApiError(400, 'Minimum amount cannot be negative');
    }

    if (normalizedMaxAmount < 0) {
        throw new ApiError(400, 'Maximum amount cannot be negative');
    }

    if (normalizedMaxAmount < normalizedMinAmount) {
        throw new ApiError(400, 'Maximum amount must be greater than or equal to minimum amount');
    }

    if (normalizedDailyRate < 0) {
        throw new ApiError(400, 'Daily rate cannot be negative');
    }

    return {
        title: title.trim(),
        minAmount: Number(normalizedMinAmount.toFixed(2)),
        maxAmount: Number(normalizedMaxAmount.toFixed(2)),
        dailyRate: Number(normalizedDailyRate.toFixed(2)),
    };
};

const ensureNoOverlap = async ({ minAmount, maxAmount, excludeId = null, isActive = true }) => {
    if (!isActive) {
        return;
    }

    const filter = {
        isActive: true,
        minAmount: { $lte: maxAmount },
        maxAmount: { $gte: minAmount },
    };

    if (excludeId) {
        filter._id = { $ne: excludeId };
    }

    const overlappingSlab = await InterestSlab.findOne(filter).lean();

    if (overlappingSlab) {
        throw new ApiError(
            409,
            `Interest slab overlaps with existing slab "${overlappingSlab.title}" (₹${overlappingSlab.minAmount} - ₹${overlappingSlab.maxAmount})`
        );
    }
};

export const createInterestSlabService = async (payload) => {
    const normalizedPayload = ensureValidPayload(payload);

    await ensureNoOverlap({
        minAmount: normalizedPayload.minAmount,
        maxAmount: normalizedPayload.maxAmount,
        isActive: payload.isActive !== false,
    });

    const slab = await InterestSlab.create({
        ...normalizedPayload,
        isActive: typeof payload.isActive === 'boolean' ? payload.isActive : true,
        sortOrder: Number(payload.sortOrder) || 0,
        description: payload.description?.trim() || '',
    });

    return buildSlabResponse(slab.toObject());
};

export const getAllInterestSlabsService = async (query = {}) => {
    const { page = 1, limit = 20, isActive, search } = query;

    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.max(Number(limit) || 20, 1);
    const skip = (pageNum - 1) * limitNum;

    const filter = {};

    if (typeof isActive !== 'undefined' && isActive !== '') {
        filter.isActive = isActive === 'true' || isActive === true;
    }

    if (search?.trim()) {
        filter.$or = [
            { title: { $regex: search.trim(), $options: 'i' } },
            { description: { $regex: search.trim(), $options: 'i' } },
        ];
    }

    const [slabs, total] = await Promise.all([
        InterestSlab.find(filter)
            .sort({ minAmount: 1, sortOrder: 1, createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean({ virtuals: true }),
        InterestSlab.countDocuments(filter),
    ]);

    return {
        slabs: slabs.map(buildSlabResponse),
        total,
        totalPages: Math.ceil(total / limitNum),
        currentPage: pageNum,
    };
};

export const getActiveInterestSlabsService = async () => {
    const slabs = await InterestSlab.find({ isActive: true })
        .sort({ minAmount: 1, sortOrder: 1, createdAt: -1 })
        .lean({ virtuals: true });

    return slabs.map(buildSlabResponse);
};

export const getInterestSlabByIdService = async ({ slabId }) => {
    if (!mongoose.Types.ObjectId.isValid(slabId)) {
        throw new ApiError(400, 'Invalid interest slab id');
    }

    const slab = await InterestSlab.findById(slabId).lean({ virtuals: true });

    if (!slab) {
        throw new ApiError(404, 'Interest slab not found');
    }

    return buildSlabResponse(slab);
};

export const updateInterestSlabService = async ({ slabId, payload }) => {
    if (!mongoose.Types.ObjectId.isValid(slabId)) {
        throw new ApiError(400, 'Invalid interest slab id');
    }

    const slab = await InterestSlab.findById(slabId);

    if (!slab) {
        throw new ApiError(404, 'Interest slab not found');
    }

    const nextPayload = {
        title: Object.prototype.hasOwnProperty.call(payload, 'title') ? payload.title : slab.title,
        minAmount: Object.prototype.hasOwnProperty.call(payload, 'minAmount')
            ? payload.minAmount
            : slab.minAmount,
        maxAmount: Object.prototype.hasOwnProperty.call(payload, 'maxAmount')
            ? payload.maxAmount
            : slab.maxAmount,
        dailyRate: Object.prototype.hasOwnProperty.call(payload, 'dailyRate')
            ? payload.dailyRate
            : slab.dailyRate,
    };

    const normalizedPayload = ensureValidPayload(nextPayload);

    const nextIsActive =
        typeof payload.isActive === 'boolean' ? payload.isActive : slab.isActive;

    await ensureNoOverlap({
        minAmount: normalizedPayload.minAmount,
        maxAmount: normalizedPayload.maxAmount,
        excludeId: slabId,
        isActive: nextIsActive,
    });

    slab.title = normalizedPayload.title;
    slab.minAmount = normalizedPayload.minAmount;
    slab.maxAmount = normalizedPayload.maxAmount;
    slab.dailyRate = normalizedPayload.dailyRate;

    if (Object.prototype.hasOwnProperty.call(payload, 'description')) {
        slab.description = payload.description?.trim() || '';
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'sortOrder')) {
        slab.sortOrder = Number(payload.sortOrder) || 0;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'isActive')) {
        slab.isActive = payload.isActive;
    }

    await slab.save();

    return buildSlabResponse(slab.toObject());
};

export const deleteInterestSlabService = async ({ slabId }) => {
    if (!mongoose.Types.ObjectId.isValid(slabId)) {
        throw new ApiError(400, 'Invalid interest slab id');
    }

    const slab = await InterestSlab.findByIdAndDelete(slabId);

    if (!slab) {
        throw new ApiError(404, 'Interest slab not found');
    }

    return null;
};

export const getInterestSlabByAmountService = async ({ amount }) => {
    const normalizedAmount = normalizeNumericField(amount, 'Amount');

    if (normalizedAmount < 0) {
        throw new ApiError(400, 'Amount cannot be negative');
    }

    const slab = await InterestSlab.findOne({
        isActive: true,
        minAmount: { $lte: normalizedAmount },
        maxAmount: { $gte: normalizedAmount },
    })
        .sort({ minAmount: 1, sortOrder: 1 })
        .lean({ virtuals: true });

    return slab ? buildSlabResponse(slab) : null;
};