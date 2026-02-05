import Category from '../Models/CategoryModel.js';
import Index from '../Models/IndexModel.js';
import { ApiError } from '../Utils/apiError.js';
import { ApiResponse } from '../Utils/apiResponse.js';
import { asyncHandler } from '../Utils/asyncHandler.js';

/**
 * ✅ Get All Categories
 */
export const getAllCategories = asyncHandler(async (req, res) => {
    const categories = await Category.find()
        .sort({ displayOrder: 1, createdAt: -1 })
        .populate('createdBy', 'username fullName')
        .lean();

    // Get indices count for each category
    const categoriesWithCount = await Promise.all(
        categories.map(async (category) => {
            const indicesCount = await Index.countDocuments({ category: category._id });
            return { ...category, indicesCount };
        })
    );

    res.status(200).json(
        new ApiResponse(200, { categories: categoriesWithCount })
    );
});

/**
 * ✅ Get Active Categories (Public)
 */
export const getActiveCategories = asyncHandler(async (req, res) => {
    const categories = await Category.find({ isActive: true })
        .sort({ displayOrder: 1 })
        .select('name description displayOrder')
        .lean();

    const categoriesWithCount = await Promise.all(
        categories.map(async (category) => {
            const indicesCount = await Index.countDocuments({
                category: category._id,
                isActive: true
            });
            return { ...category, indicesCount };
        })
    );

    res.status(200).json(
        new ApiResponse(200, { categories: categoriesWithCount })
    );
});

/**
 * ✅ Create Category
 */
export const createCategory = asyncHandler(async (req, res) => {
    const { name, description, displayOrder, isActive } = req.body;

    if (!name || !name.trim()) {
        throw new ApiError(400, 'Category name is required');
    }

    // Check if category already exists
    const existingCategory = await Category.findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') }
    });

    if (existingCategory) {
        throw new ApiError(400, 'Category with this name already exists');
    }

    const category = await Category.create({
        name: name.trim(),
        description: description?.trim() || '',
        displayOrder: displayOrder || 0,
        isActive: isActive !== false,
        createdBy: req.admin.adminId
    });

    res.status(201).json(
        new ApiResponse(201, { category }, 'Category created successfully')
    );
});

/**
 * ✅ Update Category
 */
export const updateCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, description, displayOrder, isActive } = req.body;

    const category = await Category.findById(id);

    if (!category) {
        throw new ApiError(404, 'Category not found');
    }

    // Check if new name conflicts with existing category
    if (name && name !== category.name) {
        const existingCategory = await Category.findOne({
            name: { $regex: new RegExp(`^${name}$`, 'i') },
            _id: { $ne: id }
        });

        if (existingCategory) {
            throw new ApiError(400, 'Category with this name already exists');
        }
    }

    // Update fields
    if (name) category.name = name.trim();
    if (description !== undefined) category.description = description.trim();
    if (displayOrder !== undefined) category.displayOrder = displayOrder;
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();

    res.status(200).json(
        new ApiResponse(200, { category }, 'Category updated successfully')
    );
});

/**
 * ✅ Delete Category
 */
export const deleteCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const category = await Category.findById(id);

    if (!category) {
        throw new ApiError(404, 'Category not found');
    }

    // Check if category has indices
    const indicesCount = await Index.countDocuments({ category: id });

    if (indicesCount > 0) {
        throw new ApiError(400, `Cannot delete category with ${indicesCount} indices. Please reassign or delete indices first.`);
    }

    await Category.findByIdAndDelete(id);

    res.status(200).json(
        new ApiResponse(200, null, 'Category deleted successfully')
    );
});

/**
 * ✅ Get Category Stats
 */
export const getCategoryStats = asyncHandler(async (req, res) => {
    const totalCategories = await Category.countDocuments();
    const activeCategories = await Category.countDocuments({ isActive: true });

    const categoriesWithIndices = await Category.aggregate([
        {
            $lookup: {
                from: 'indices',
                localField: '_id',
                foreignField: 'category',
                as: 'indices'
            }
        },
        {
            $project: {
                name: 1,
                indicesCount: { $size: '$indices' }
            }
        },
        { $sort: { indicesCount: -1 } },
        { $limit: 5 }
    ]);

    res.status(200).json(
        new ApiResponse(200, {
            totalCategories,
            activeCategories,
            topCategories: categoriesWithIndices
        })
    );
});
