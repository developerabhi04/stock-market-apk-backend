import mongoose from 'mongoose';
import Index from './index.model.js';
import Category from '../category/category.model.js';
import { ApiError } from '../../../shared/utils/apiError.js';


const normalizeCategoryInput = (value = '') => value.trim().toLowerCase();


const normalizeDefaultDailyRate = (value) => {
  if (value === '' || value === null || typeof value === 'undefined') {
    return null;
  }

  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    throw new ApiError(400, 'Default daily rate must be a valid number');
  }

  if (numericValue < 0) {
    throw new ApiError(400, 'Default daily rate cannot be negative');
  }

  return Number(numericValue.toFixed(2));
};


const findCategoryFromInput = async (categoryValue) => {
  if (!categoryValue || categoryValue === 'All' || categoryValue === 'All Indices') {
    return null;
  }

  const normalized = normalizeCategoryInput(categoryValue);

  const category = await Category.findOne({
    $or: [
      { slug: normalized },
      { name: new RegExp(`^${categoryValue.trim()}$`, 'i') },
    ],
  });

  return category;
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
    filters.$or = [
      { name: { $regex: search.trim(), $options: 'i' } },
      { symbol: { $regex: search.trim(), $options: 'i' } },
    ];
  }

  if (category && category !== 'All' && category !== 'All Indices') {
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;

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
  categoryId: item.category?._id || item.category || null,
  categoryName: item.category?.name || '',
  categorySlug: item.category?.slug || '',
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
    .populate('category', 'name slug')
    .sort({ lastUpdated: -1, createdAt: -1 })
    .limit(10)
    .lean({ virtuals: true });

  return indices.map(mapIndexResponse);
};


export const getIndexBySymbolService = async ({ symbol }) => {
  const index = await Index.findOne({
    symbol: symbol?.trim().toUpperCase(),
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
  if (!payload.name?.trim()) {
    throw new ApiError(400, 'Index name is required');
  }

  if (!payload.symbol?.trim()) {
    throw new ApiError(400, 'Index symbol is required');
  }

  if (!payload.category) {
    throw new ApiError(400, 'Category is required');
  }

  const existingName = await Index.findOne({ name: payload.name.trim() });
  if (existingName) {
    throw new ApiError(409, 'Index with this name already exists');
  }

  const existingSymbol = await Index.findOne({
    symbol: payload.symbol.trim().toUpperCase(),
  });
  if (existingSymbol) {
    throw new ApiError(409, 'Index with this symbol already exists');
  }

  let categoryId = payload.category;

  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  if (!objectIdRegex.test(String(payload.category))) {
    const categoryDoc = await findCategoryFromInput(String(payload.category));

    if (!categoryDoc) {
      throw new ApiError(404, 'Selected category not found');
    }

    categoryId = categoryDoc._id;
  }

  const index = await Index.create({
    ...payload,
    name: payload.name.trim(),
    symbol: payload.symbol.trim().toUpperCase(),
    category: categoryId,
    defaultDailyRate: normalizeDefaultDailyRate(payload.defaultDailyRate),
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

  if (payload.name && payload.name.trim() !== index.name) {
    const existingName = await Index.findOne({
      name: payload.name.trim(),
      _id: { $ne: indexId },
    });

    if (existingName) {
      throw new ApiError(409, 'Index with this name already exists');
    }
  }

  if (payload.symbol && payload.symbol.trim().toUpperCase() !== index.symbol) {
    const existingSymbol = await Index.findOne({
      symbol: payload.symbol.trim().toUpperCase(),
      _id: { $ne: indexId },
    });

    if (existingSymbol) {
      throw new ApiError(409, 'Index with this symbol already exists');
    }
  }

  const nextPayload = { ...payload };

  if (payload.name) {
    nextPayload.name = payload.name.trim();
  }

  if (payload.symbol) {
    nextPayload.symbol = payload.symbol.trim().toUpperCase();
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'defaultDailyRate')) {
    nextPayload.defaultDailyRate = normalizeDefaultDailyRate(payload.defaultDailyRate);
  }

  if (payload.category) {
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    if (!objectIdRegex.test(String(payload.category))) {
      const categoryDoc = await findCategoryFromInput(String(payload.category));

      if (!categoryDoc) {
        throw new ApiError(404, 'Selected category not found');
      }

      nextPayload.category = categoryDoc._id;
    }
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
