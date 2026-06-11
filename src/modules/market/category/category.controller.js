import { asyncHandler } from '../../../shared/utils/asyncHandler.js';
import { ApiResponse } from '../../../shared/utils/apiResponse.js';
import {
    getAllCategoriesService,
    getActiveCategoriesService,
    createCategoryService,
    updateCategoryService,
    deleteCategoryService,
    getCategoryStatsService,
    ensureDefaultCategoriesService,
} from './category.service.js';

export const getAllCategories = asyncHandler(async (req, res) => {
    await ensureDefaultCategoriesService();
    const data = await getAllCategoriesService();

    res
        .status(200)
        .json(new ApiResponse(200, data, 'Categories fetched successfully'));
});

export const getActiveCategories = asyncHandler(async (req, res) => {
    await ensureDefaultCategoriesService();
    const data = await getActiveCategoriesService();

    res
        .status(200)
        .json(new ApiResponse(200, data, 'Active categories fetched successfully'));
});

export const createCategory = asyncHandler(async (req, res) => {
    const data = await createCategoryService({
        payload: req.body,
        adminId: req.admin?.adminId || null,
    });

    res
        .status(201)
        .json(new ApiResponse(201, data, 'Category created successfully'));
});

export const updateCategory = asyncHandler(async (req, res) => {
    const data = await updateCategoryService({
        id: req.params.id,
        payload: req.body,
    });

    res
        .status(200)
        .json(new ApiResponse(200, data, 'Category updated successfully'));
});

export const deleteCategory = asyncHandler(async (req, res) => {
    await deleteCategoryService({ id: req.params.id });

    res
        .status(200)
        .json(new ApiResponse(200, null, 'Category deleted successfully'));
});

export const getCategoryStats = asyncHandler(async (req, res) => {
    await ensureDefaultCategoriesService();
    const data = await getCategoryStatsService();

    res
        .status(200)
        .json(new ApiResponse(200, data, 'Category stats fetched successfully'));
});