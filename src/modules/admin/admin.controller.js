import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { ApiResponse } from '../../shared/utils/apiResponse.js';
import {
    validateAdminLogin,
    validateBalanceUpdate,
    validateCreateAdmin,
    validateCreateFirstAdmin
} from './admin.validator.js';
import {
    adminLoginService,
    bulkUpdatePricesService,
    createAdminService,
    createFirstAdminService,
    createStockService,
    deleteAdminService,
    deleteStockService,
    generateSampleChartDataService,
    generateSampleDailyHistoryService,
    getAdminActivityService,
    getAllAdminsService,
    getAllStocksAdminService,
    getAllTransactionsService,
    getAllUsersService,
    getCompleteDashboardStatsService,
    getDashboardStatsService,
    getMarketDashboardStatsService,
    getUserDetailsService,
    getUserStatsService,
    getWithdrawalStatsService,
    updateAdminRoleService,
    updateStockService,
    updateUserBalanceService
} from './admin.service.js';


export const adminLogin = asyncHandler(async (req, res) => {
    validateAdminLogin(req.body);
    const data = await adminLoginService(req.body);
    res.status(200).json(new ApiResponse(200, data, 'Login successful'));
});

export const createFirstAdmin = asyncHandler(async (req, res) => {
    validateCreateFirstAdmin(req.body);
    const data = await createFirstAdminService(req.body);
    res.status(201).json(new ApiResponse(201, data, 'Super admin created successfully'));
});

export const createAdmin = asyncHandler(async (req, res) => {
    validateCreateAdmin(req.body);
    const data = await createAdminService(req.body, req.admin);
    res.status(201).json(new ApiResponse(201, data, 'Admin created successfully'));
});

export const getAllAdmins = asyncHandler(async (req, res) => {
    const data = await getAllAdminsService();
    res.status(200).json(new ApiResponse(200, data, 'Admins fetched successfully'));
});

export const deleteAdmin = asyncHandler(async (req, res) => {
    await deleteAdminService({
        adminId: req.params.adminId,
        currentAdminId: req.admin.adminId
    });
    res.status(200).json(new ApiResponse(200, null, 'Admin deleted successfully'));
});

export const updateAdminRole = asyncHandler(async (req, res) => {
    const data = await updateAdminRoleService({
        adminId: req.params.adminId,
        role: req.body.role
    });
    res.status(200).json(new ApiResponse(200, data, data.message));
});

export const getAdminActivity = asyncHandler(async (req, res) => {
    const data = await getAdminActivityService(req.query);
    res.status(200).json(new ApiResponse(200, data, 'Admin activity fetched successfully'));
});

export const getDashboardStats = asyncHandler(async (req, res) => {
    const data = await getDashboardStatsService();
    res.status(200).json(new ApiResponse(200, data, 'Dashboard stats fetched successfully'));
});

export const getCompleteDashboardStats = asyncHandler(async (req, res) => {
    const data = await getCompleteDashboardStatsService();
    res.status(200).json(new ApiResponse(200, data, 'Complete dashboard stats fetched successfully'));
});

export const getWithdrawalStats = asyncHandler(async (req, res) => {
    const data = await getWithdrawalStatsService();
    res.status(200).json(new ApiResponse(200, data, 'Withdrawal statistics fetched successfully'));
});

export const getAllTransactions = asyncHandler(async (req, res) => {
    const data = await getAllTransactionsService(req.query);
    res.status(200).json(new ApiResponse(200, data, 'Transactions fetched successfully'));
});

export const getAllUsers = asyncHandler(async (req, res) => {
    const data = await getAllUsersService(req.query);
    res.status(200).json(new ApiResponse(200, data, 'Users fetched successfully'));
});

export const getUserStats = asyncHandler(async (req, res) => {
    const data = await getUserStatsService();
    res.status(200).json(new ApiResponse(200, data, 'User statistics fetched successfully'));
});

export const getUserDetails = asyncHandler(async (req, res) => {
    const data = await getUserDetailsService({ userId: req.params.userId });
    res.status(200).json(new ApiResponse(200, data, 'User details fetched successfully'));
});

export const updateUserBalance = asyncHandler(async (req, res) => {
    validateBalanceUpdate(req.body);
    const data = await updateUserBalanceService({
        ...req.body,
        adminId: req.admin.adminId
    });
    res.status(200).json(new ApiResponse(200, data, data.message));
});

export const getMarketDashboardStats = asyncHandler(async (req, res) => {
    const data = await getMarketDashboardStatsService();
    res.status(200).json(new ApiResponse(200, data, 'Market dashboard stats fetched successfully'));
});

export const getAllIndicesAdmin = asyncHandler(async (req, res) => {
    const data = await getAllIndicesAdminService(req.query);
    res.status(200).json(new ApiResponse(200, data, 'Indices fetched successfully'));
});

export const createIndex = asyncHandler(async (req, res) => {
    const data = await createIndexService(req.body);
    res.status(201).json(new ApiResponse(201, data, 'Index created successfully'));
});

export const updateIndex = asyncHandler(async (req, res) => {
    const data = await updateIndexService({
        id: req.params.id,
        updateData: req.body
    });
    res.status(200).json(new ApiResponse(200, data, 'Index updated successfully'));
});

export const deleteIndex = asyncHandler(async (req, res) => {
    await deleteIndexService({ id: req.params.id });
    res.status(200).json(new ApiResponse(200, null, 'Index and related data deleted successfully'));
});

export const getAllStocksAdmin = asyncHandler(async (req, res) => {
    const data = await getAllStocksAdminService(req.query);
    res.status(200).json(new ApiResponse(200, data, 'Stocks fetched successfully'));
});

export const createStock = asyncHandler(async (req, res) => {
    const data = await createStockService(req.body);
    res.status(201).json(new ApiResponse(201, data, 'Stock created successfully'));
});

export const updateStock = asyncHandler(async (req, res) => {
    const data = await updateStockService({
        id: req.params.id,
        updateData: req.body
    });
    res.status(200).json(new ApiResponse(200, data, 'Stock updated successfully'));
});

export const deleteStock = asyncHandler(async (req, res) => {
    await deleteStockService({ id: req.params.id });
    res.status(200).json(new ApiResponse(200, null, 'Stock and related data deleted successfully'));
});

export const bulkUpdatePrices = asyncHandler(async (req, res) => {
    const data = await bulkUpdatePricesService(req.body);
    res.status(200).json(new ApiResponse(200, data, 'Bulk update completed'));
});

export const generateSampleChartData = asyncHandler(async (req, res) => {
    const data = await generateSampleChartDataService(req.body);
    res.status(200).json(new ApiResponse(200, data, 'Sample chart data generated successfully'));
});

export const generateSampleDailyHistory = asyncHandler(async (req, res) => {
    const data = await generateSampleDailyHistoryService(req.body);
    res.status(201).json(new ApiResponse(201, {
        count: Array.isArray(data) ? data.length : 0,
        histories: data
    }, 'Sample daily history generated successfully'));
});



export const getActiveCategories = asyncHandler(async (req, res) => {
    const data = await getActiveCategoriesService();
    res.status(200).json(new ApiResponse(200, data));
});

export const createCategory = asyncHandler(async (req, res) => {
    const data = await createCategoryService({
        payload: req.body,
        adminId: req.admin.adminId
    });
    res.status(201).json(new ApiResponse(201, data, 'Category created successfully'));
});

export const updateCategory = asyncHandler(async (req, res) => {
    const data = await updateCategoryService({
        id: req.params.id,
        payload: req.body
    });
    res.status(200).json(new ApiResponse(200, data, 'Category updated successfully'));
});

export const deleteCategory = asyncHandler(async (req, res) => {
    await deleteCategoryService({ id: req.params.id });
    res.status(200).json(new ApiResponse(200, null, 'Category deleted successfully'));
});

export const getCategoryStats = asyncHandler(async (req, res) => {
    const data = await getCategoryStatsService();
    res.status(200).json(new ApiResponse(200, data));
});