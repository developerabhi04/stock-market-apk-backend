import mongoose from 'mongoose';
import Category from './category.model.js';
import Index from '../index/index.model.js';
import { ApiError } from '../../../shared/utils/apiError.js';

const slugify = (value = '') =>
    value
        .trim()
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-');

const attachIndicesCount = async (categories = [], activeOnly = false) => {
    if (!categories.length) return [];

    const categoryIds = categories.map((item) => item._id);

    const matchStage = {
        category: { $in: categoryIds },
    };

    if (activeOnly) {
        matchStage.isActive = true;
    }

    const counts = await Index.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: '$category',
                indicesCount: { $sum: 1 },
            },
        },
    ]);

    const countMap = new Map(
        counts.map((item) => [String(item._id), item.indicesCount])
    );

    return categories.map((category) => ({
        ...category,
        indicesCount: countMap.get(String(category._id)) || 0,
    }));
};

export const ensureDefaultCategoriesService = async () => {
    const defaultCategories = [
        {
            name: 'Indian Indices',
            slug: 'indian-indices',
            description: 'Major Indian market indices',
            displayOrder: 1,
            icon: 'flag',
            color: '#00C896',
            isActive: true,
        },
        {
            name: 'Global Indices',
            slug: 'global-indices',
            description: 'Major global market indices',
            displayOrder: 2,
            icon: 'earth',
            color: '#2196F3',
            isActive: true,
        },
        {
            name: 'Crypto',
            slug: 'crypto',
            description: 'Crypto market indices',
            displayOrder: 3,
            icon: 'bitcoin',
            color: '#FF9800',
            isActive: true,
        },
    ];

    for (const item of defaultCategories) {
        const exists = await Category.findOne({ slug: item.slug }).lean();
        if (!exists) {
            await Category.create(item);
        }
    }
};

export const getAllCategoriesService = async () => {
    const categories = await Category.find()
        .sort({ displayOrder: 1, createdAt: -1 })
        .populate('createdBy', 'username fullName')
        .lean();

    return await attachIndicesCount(categories, false);
};

export const getActiveCategoriesService = async () => {
    const categories = await Category.find({ isActive: true })
        .sort({ displayOrder: 1, createdAt: 1 })
        .lean();

    return await attachIndicesCount(categories, true);
};

export const createCategoryService = async ({ payload, adminId }) => {
    const { name, description, displayOrder, isActive, icon, color } = payload;

    if (!name?.trim()) {
        throw new ApiError(400, 'Category name is required');
    }

    const slug = slugify(name);

    const existingCategory = await Category.findOne({
        $or: [{ name: name.trim() }, { slug }],
    }).lean();

    if (existingCategory) {
        throw new ApiError(409, 'Category already exists');
    }

    const category = await Category.create({
        name: name.trim(),
        slug,
        description: description?.trim() || '',
        displayOrder: Number(displayOrder || 0),
        isActive: isActive !== false,
        icon: icon?.trim() || '',
        color: color?.trim() || '',
        createdBy: adminId || null,
    });

    return category;
};

export const updateCategoryService = async ({ id, payload }) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, 'Invalid category id');
    }

    const category = await Category.findById(id);

    if (!category) {
        throw new ApiError(404, 'Category not found');
    }

    const { name, description, displayOrder, isActive, icon, color } = payload;

    if (name?.trim() && name.trim() !== category.name) {
        const newSlug = slugify(name);

        const existingCategory = await Category.findOne({
            _id: { $ne: id },
            $or: [{ name: name.trim() }, { slug: newSlug }],
        }).lean();

        if (existingCategory) {
            throw new ApiError(409, 'Category already exists');
        }

        category.name = name.trim();
        category.slug = newSlug;
    }

    if (description !== undefined) category.description = description?.trim() || '';
    if (displayOrder !== undefined) category.displayOrder = Number(displayOrder || 0);
    if (isActive !== undefined) category.isActive = isActive;
    if (icon !== undefined) category.icon = icon?.trim() || '';
    if (color !== undefined) category.color = color?.trim() || '';

    await category.save();

    return category;
};

export const deleteCategoryService = async ({ id }) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, 'Invalid category id');
    }

    const category = await Category.findById(id);

    if (!category) {
        throw new ApiError(404, 'Category not found');
    }

    const indicesCount = await Index.countDocuments({ category: id });

    if (indicesCount > 0) {
        throw new ApiError(
            400,
            `Cannot delete category with ${indicesCount} indices. Reassign or delete indices first.`
        );
    }

    await Category.findByIdAndDelete(id);
    return null;
};

export const getCategoryStatsService = async () => {
    const totalCategories = await Category.countDocuments();
    const activeCategories = await Category.countDocuments({ isActive: true });

    const topCategories = await Category.aggregate([
        {
            $lookup: {
                from: 'indices',
                localField: '_id',
                foreignField: 'category',
                as: 'indices',
            },
        },
        {
            $project: {
                name: 1,
                slug: 1,
                indicesCount: { $size: '$indices' },
            },
        },
        { $sort: { indicesCount: -1 } },
        { $limit: 5 },
    ]);

    return {
        totalCategories,
        activeCategories,
        topCategories,
    };
};

export const getCategoryBySlugOrNameService = async (value) => {
    if (!value?.trim()) {
        return null;
    }

    const normalized = value.trim().toLowerCase();

    const category = await Category.findOne({
        $or: [
            { slug: normalized },
            { name: new RegExp(`^${value.trim()}$`, 'i') },
        ],
    });

    return category;
};