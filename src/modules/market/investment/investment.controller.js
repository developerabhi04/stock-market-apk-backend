import { ApiResponse } from '../../../shared/utils/apiResponse.js';
import { asyncHandler } from '../../../shared/utils/asyncHandler.js';
import {
    approveInvestmentOrderAdminService,
    cancelInvestmentService,
    createInvestmentOrderService,
    getAllInvestmentOrdersAdminService,
    getInvestmentByIdService,
    getMyInvestmentOrdersService,
    getMyPortfolioService,
    overrideInvestmentRateAdminService,
    rejectInvestmentOrderAdminService,
    resolveInvestmentPreviewService,
} from './investment.service.js';

// ─── User Controllers ────────────────────────────────────────────────────────

export const placeInvestmentOrder = asyncHandler(async (req, res) => {
    const userId = req.user?.userId || req.user?._id || req.user?.id;

    const investment = await createInvestmentOrderService({
        userId,
        payload: req.body,
    });

    return res
        .status(201)
        .json(
            new ApiResponse(
                201,
                investment,
                'Investment placed successfully. Wallet debited and investment is now active.'
            )
        );
});

export const getMyOrders = asyncHandler(async (req, res) => {
    const userId = req.user?.userId || req.user?._id || req.user?.id;

    const result = await getMyInvestmentOrdersService({
        userId,
        query: req.query,
    });

    return res
        .status(200)
        .json(new ApiResponse(200, result, 'Investment orders fetched successfully'));
});

export const getMyPortfolio = asyncHandler(async (req, res) => {
    const userId = req.user?.userId || req.user?._id || req.user?.id;

    const result = await getMyPortfolioService({
        userId,
        query: req.query,
    });

    return res
        .status(200)
        .json(new ApiResponse(200, result, 'Portfolio fetched successfully'));
});

export const getMyInvestmentById = asyncHandler(async (req, res) => {
    const userId = req.user?.userId || req.user?._id || req.user?.id;

    const investment = await getInvestmentByIdService({
        investmentId: req.params.investmentId,
        userId,
        adminView: false,
    });

    return res
        .status(200)
        .json(new ApiResponse(200, investment, 'Investment fetched successfully'));
});

export const cancelInvestment = asyncHandler(async (req, res) => {
    const userId = req.user?.userId || req.user?._id || req.user?.id;

    const investment = await cancelInvestmentService({
        investmentId: req.params.investmentId,
        userId,
    });

    return res
        .status(200)
        .json(new ApiResponse(200, investment, 'Investment cancelled and principal returned to wallet'));
});

export const resolveInvestmentPreview = asyncHandler(async (req, res) => {
    const userId = req.user?.userId || req.user?._id || req.user?.id;

    const preview = await resolveInvestmentPreviewService({
        userId,
        indexId: req.body.indexId,
        amount: req.body.amount,
    });

    return res
        .status(200)
        .json(new ApiResponse(200, preview, 'Investment preview resolved successfully'));
});

// ─── Admin Controllers ────────────────────────────────────────────────────────

export const getAllInvestmentOrdersAdmin = asyncHandler(async (req, res) => {
    const result = await getAllInvestmentOrdersAdminService({ query: req.query });

    return res
        .status(200)
        .json(new ApiResponse(200, result, 'Investment orders fetched successfully'));
});

export const getInvestmentByIdAdmin = asyncHandler(async (req, res) => {
    const investment = await getInvestmentByIdService({
        investmentId: req.params.investmentId,
        adminView: true,
    });

    return res
        .status(200)
        .json(new ApiResponse(200, investment, 'Investment fetched successfully'));
});

export const approveInvestmentOrder = asyncHandler(async (req, res) => {
    const adminId = req.admin?.adminId;

    const investment = await approveInvestmentOrderAdminService({
        investmentId: req.params.investmentId,
        adminId,
        adminRemark: req.body.adminRemark || '',
    });

    return res
        .status(200)
        .json(new ApiResponse(200, investment, 'Investment order approved successfully'));
});

export const rejectInvestmentOrder = asyncHandler(async (req, res) => {
    const adminId = req.admin?.adminId;

    const investment = await rejectInvestmentOrderAdminService({
        investmentId: req.params.investmentId,
        adminId,
        reason: req.body.reason || '',
    });

    return res
        .status(200)
        .json(new ApiResponse(200, investment, 'Investment order rejected successfully'));
});

export const overrideInvestmentRate = asyncHandler(async (req, res) => {
    const investment = await overrideInvestmentRateAdminService({
        investmentId: req.params.investmentId,
        customDailyRate: req.body.customDailyRate,
        adminRemark: req.body.adminRemark || '',
    });

    return res
        .status(200)
        .json(new ApiResponse(200, investment, 'Investment daily rate overridden successfully'));
});