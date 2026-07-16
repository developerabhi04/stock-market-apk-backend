import mongoose from 'mongoose';
import Index from './index.model.js';
import Category from '../category/category.model.js';
import { ApiError } from '../../../shared/utils/apiError.js';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeCategoryInput = (value = '') => String(value).trim().toLowerCase();

const normalizeString = (value, fieldName) => {
  if (value === null || typeof value === 'undefined') {
    return '';
  }

  const normalized = String(value).trim();

  if (!normalized) {
    throw new ApiError(400, `${fieldName} is required`);
  }

  return normalized;
};

const normalizeOptionalString = (value) => {
  if (value === null || typeof value === 'undefined') {
    return '';
  }

  return String(value).trim();
};

const normalizeRequiredNumber = (value, fieldName, { min = 0, integer = false } = {}) => {
  if (value === '' || value === null || typeof value === 'undefined') {
    throw new ApiError(400, `${fieldName} is required`);
  }

  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    throw new ApiError(400, `${fieldName} must be a valid number`);
  }

  if (numericValue < min) {
    throw new ApiError(400, `${fieldName} must be at least ${min}`);
  }

  if (integer && !Number.isInteger(numericValue)) {
    throw new ApiError(400, `${fieldName} must be a whole number`);
  }

  return integer ? numericValue : Number(numericValue.toFixed(2));
};

const normalizeOptionalNumber = (value, fieldName, { min = 0 } = {}) => {
  if (value === '' || value === null || typeof value === 'undefined') {
    return null;
  }

  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    throw new ApiError(400, `${fieldName} must be a valid number`);
  }

  if (numericValue < min) {
    throw new ApiError(400, `${fieldName} cannot be less than ${min}`);
  }

  return Number(numericValue.toFixed(2));
};

const normalizeDefaultDailyRate = (value) => {
  return normalizeOptionalNumber(value, 'Default daily rate', { min: 0 });
};

const normalizeMinimumInvestment = (value) => {
  return normalizeRequiredNumber(value, 'Minimum investment', { min: 0.01 });
};

const normalizeLockPeriodDays = (value) => {
  return normalizeRequiredNumber(value, 'Lock period days', { min: 1, integer: true });
};

const normalizeNonNegativeNumber = (value, fieldName) => {
  if (value === '' || value === null || typeof value === 'undefined') {
    return 0;
  }

  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    throw new ApiError(400, `${fieldName} must be a valid number`);
  }

  if (numericValue < 0) {
    throw new ApiError(400, `${fieldName} cannot be negative`);
  }

  return Number(numericValue.toFixed(2));
};

const findCategoryFromInput = async (categoryValue) => {
  if (!categoryValue || categoryValue === 'All' || categoryValue === 'All Indices') {
    return null;
  }

  const normalized = normalizeCategoryInput(categoryValue);
  const safeRegex = new RegExp(`^${escapeRegex(String(categoryValue).trim())}$`, 'i');

  const category = await Category.findOne({
    $or: [
      { slug: normalized },
      { name: safeRegex },
    ],
  });

  return category;
};

const resolveCategoryId = async (categoryValue, required = true) => {
  if (!categoryValue) {
    if (required) {
      throw new ApiError(400, 'Category is required');
    }
    return undefined;
  }

  if (objectIdRegex.test(String(categoryValue))) {
    const exists = await Category.findById(categoryValue).lean();
    if (!exists) {
      throw new ApiError(404, 'Selected category not found');
    }
    return categoryValue;
  }

  const categoryDoc = await findCategoryFromInput(String(categoryValue));

  if (!categoryDoc) {
    throw new ApiError(404, 'Selected category not found');
  }

  return categoryDoc._id;
};

const buildFilters = async (query = {}, publicOnly = false) => {
  const { category, featured, isFeatured, isActive, search } = query;
  const filters = {};

  if (publicOnly) {
    filters.isActive = true;
  } else if (typeof isActive !== 'undefined' && isActive !== '') {
    filters.isActive = isActive === 'true' || isActive === true;
  }

  const featuredValue = typeof featured !== 'undefined' ? featured : isFeatured;

  if (typeof featuredValue !== 'undefined' && featuredValue !== '') {
    filters.isFeatured = featuredValue === 'true' || featuredValue === true;
  }

  if (search?.trim()) {
    const safeSearch = escapeRegex(search.trim());
    filters.$or = [
      { name: { $regex: safeSearch, $options: 'i' } },
      { symbol: { $regex: safeSearch, $options: 'i' } },
    ];
  }

  if (category && category !== 'All' && category !== 'All Indices') {
    if (objectIdRegex.test(String(category))) {
      filters.category = category;
    } else {
      const categoryDoc = await findCategoryFromInput(category);

      if (!categoryDoc) {
        throw new ApiError(400, `Invalid category filter: ${category}`);
      }

      filters.category = categoryDoc._id;
    }
  }

  return filters;
};

const calculatePagination = (page = 1, limit = 20) => {
  const pageNumber = Math.max(Number(page) || 1, 1);
  const limitNumber = Math.max(Number(limit) || 20, 1);
  const skip = (pageNumber - 1) * limitNumber;
  return { pageNumber, limitNumber, skip };
};

const mapIndexResponse = (item) => ({
  ...item,
  defaultDailyRate:
    item.defaultDailyRate === null || typeof item.defaultDailyRate === 'undefined'
      ? null
      : Number(item.defaultDailyRate),
  minimumInvestment:
    item.minimumInvestment === null || typeof item.minimumInvestment === 'undefined'
      ? null
      : Number(item.minimumInvestment),
  lockPeriodDays:
    item.lockPeriodDays === null || typeof item.lockPeriodDays === 'undefined'
      ? null
      : Number(item.lockPeriodDays),
  highValue: Number(item.highValue || 0),
  lowValue: Number(item.lowValue || 0),
  previousClose: Number(item.previousClose || 0),
  change: Number(item.change || 0),
  changePercent: Number(item.changePercent || 0),
  marketCap: Number(item.marketCap || 0),
  volume: Number(item.volume || 0),
  categoryId: item.category?._id || item.category || null,
  categoryName: item.category?.name || '',
  categorySlug: item.category?.slug || '',
  categoryColor: item.category?.color || '',
  categoryIcon: item.category?.icon || '',
});

export const getAllIndicesService = async (query) => {
  const filters = await buildFilters(query, false);
  const { pageNumber, limitNumber, skip } = calculatePagination(query.page, query.limit);

  const [indices, total] = await Promise.all([
    Index.find(filters)
      .populate('category', 'name slug color icon displayOrder isActive')
      .sort({ isFeatured: -1, createdAt: -1, name: 1 })
      .skip(skip)
      .limit(limitNumber)
      .lean({ virtuals: true }),
    Index.countDocuments(filters),
  ]);

  return {
    indices: indices.map(mapIndexResponse),
    total,
    totalPages: Math.ceil(total / limitNumber),
    currentPage: pageNumber,
  };
};

export const getPublicIndicesService = async (query) => {
  const filters = await buildFilters(query, true);
  const { pageNumber, limitNumber, skip } = calculatePagination(query.page, query.limit);

  const [indices, total] = await Promise.all([
    Index.find(filters)
      .populate('category', 'name slug color icon displayOrder isActive')
      .sort({ isFeatured: -1, createdAt: -1, name: 1 })
      .skip(skip)
      .limit(limitNumber)
      .lean({ virtuals: true }),
    Index.countDocuments(filters),
  ]);

  return {
    indices: indices.map(mapIndexResponse),
    total,
    totalPages: Math.ceil(total / limitNumber),
    currentPage: pageNumber,
  };
};

export const getFeaturedIndicesService = async () => {
  const indices = await Index.find({ isFeatured: true, isActive: true })
    .populate('category', 'name slug color icon displayOrder isActive')
    .sort({ lastUpdated: -1, createdAt: -1 })
    .limit(10)
    .lean({ virtuals: true });

  return indices.map(mapIndexResponse);
};

export const getIndexBySymbolService = async ({ symbol }) => {
  const normalizedSymbol = normalizeString(symbol, 'Symbol');

  const index = await Index.findOne({
    symbol: normalizedSymbol,
    isActive: true,
  })
    .populate('category', 'name slug color icon displayOrder isActive')
    .lean({ virtuals: true });

  if (!index) {
    throw new ApiError(404, 'Index not found');
  }

  return mapIndexResponse(index);
};

export const createIndexService = async (payload) => {
  const name = normalizeString(payload.name, 'Index name');
  const symbol = normalizeString(payload.symbol, 'Index symbol');
  const category = await resolveCategoryId(payload.category, true);

  const existingName = await Index.findOne({ name });
  if (existingName) {
    throw new ApiError(409, 'Index with this name already exists');
  }

  const index = await Index.create({
    name,
    symbol,
    category,
    highValue: normalizeRequiredNumber(payload.highValue, 'High value', { min: 0 }),
    lowValue: normalizeRequiredNumber(payload.lowValue, 'Low value', { min: 0 }),
    previousClose: normalizeRequiredNumber(payload.previousClose, 'Previous close', { min: 0 }),
    logoUrl: normalizeOptionalString(payload.logoUrl),
    defaultDailyRate: normalizeDefaultDailyRate(payload.defaultDailyRate),
    minimumInvestment: normalizeMinimumInvestment(payload.minimumInvestment),
    lockPeriodDays: normalizeLockPeriodDays(payload.lockPeriodDays),
    isFeatured: typeof payload.isFeatured === 'boolean' ? payload.isFeatured : false,
    isActive: typeof payload.isActive === 'boolean' ? payload.isActive : true,
    marketCap: normalizeNonNegativeNumber(payload.marketCap, 'Market cap'),
    volume: normalizeNonNegativeNumber(payload.volume, 'Volume'),
    description: normalizeOptionalString(payload.description),
    change: normalizeOptionalNumber(payload.change, 'Change', { min: -Infinity }) ?? 0,
    changePercent: normalizeOptionalNumber(payload.changePercent, 'Change percent', { min: -Infinity }) ?? 0,
  });

  const populated = await Index.findById(index._id)
    .populate('category', 'name slug color icon displayOrder isActive')
    .lean({ virtuals: true });

  return mapIndexResponse(populated);
};

export const updateIndexService = async ({ indexId, payload }) => {
  if (!mongoose.Types.ObjectId.isValid(indexId)) {
    throw new ApiError(400, 'Invalid index id');
  }

  const index = await Index.findById(indexId);

  if (!index) {
    throw new ApiError(404, 'Index not found');
  }

  const nextPayload = {};

  if (Object.prototype.hasOwnProperty.call(payload, 'name')) {
    const nextName = normalizeString(payload.name, 'Index name');

    if (nextName !== index.name) {
      const existingName = await Index.findOne({
        name: nextName,
        _id: { $ne: indexId },
      });

      if (existingName) {
        throw new ApiError(409, 'Index with this name already exists');
      }
    }

    nextPayload.name = nextName;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'symbol')) {
    const nextSymbol = normalizeString(payload.symbol, 'Index symbol');
    nextPayload.symbol = nextSymbol;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'category')) {
    nextPayload.category = await resolveCategoryId(payload.category, true);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'highValue')) {
    nextPayload.highValue = normalizeRequiredNumber(payload.highValue, 'High value', { min: 0 });
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'lowValue')) {
    nextPayload.lowValue = normalizeRequiredNumber(payload.lowValue, 'Low value', { min: 0 });
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'previousClose')) {
    nextPayload.previousClose = normalizeRequiredNumber(payload.previousClose, 'Previous close', { min: 0 });
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'logoUrl')) {
    nextPayload.logoUrl = normalizeOptionalString(payload.logoUrl);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'defaultDailyRate')) {
    nextPayload.defaultDailyRate = normalizeDefaultDailyRate(payload.defaultDailyRate);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'minimumInvestment')) {
    nextPayload.minimumInvestment = normalizeMinimumInvestment(payload.minimumInvestment);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'lockPeriodDays')) {
    nextPayload.lockPeriodDays = normalizeLockPeriodDays(payload.lockPeriodDays);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'isFeatured')) {
    nextPayload.isFeatured = payload.isFeatured === true || payload.isFeatured === 'true';
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'isActive')) {
    nextPayload.isActive = payload.isActive === true || payload.isActive === 'true';
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'marketCap')) {
    nextPayload.marketCap = normalizeNonNegativeNumber(payload.marketCap, 'Market cap');
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'volume')) {
    nextPayload.volume = normalizeNonNegativeNumber(payload.volume, 'Volume');
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'description')) {
    nextPayload.description = normalizeOptionalString(payload.description);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'change')) {
    nextPayload.change = normalizeOptionalNumber(payload.change, 'Change', { min: -Infinity }) ?? 0;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'changePercent')) {
    nextPayload.changePercent = normalizeOptionalNumber(payload.changePercent, 'Change percent', { min: -Infinity }) ?? 0;
  }

  Object.assign(index, nextPayload);
  await index.save();

  const populated = await Index.findById(index._id)
    .populate('category', 'name slug color icon displayOrder isActive')
    .lean({ virtuals: true });

  return mapIndexResponse(populated);
};

export const deleteIndexService = async ({ indexId }) => {
  if (!mongoose.Types.ObjectId.isValid(indexId)) {
    throw new ApiError(400, 'Invalid index id');
  }

  const index = await Index.findByIdAndDelete(indexId);

  if (!index) {
    throw new ApiError(404, 'Index not found');
  }

  return null;
};