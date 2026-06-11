import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { ApiResponse } from '../../shared/utils/apiResponse.js';
import {
    approvePaymentService,
    approveWithdrawalService,
    getAllTransactionsAdminService,
    getPendingPaymentsService,
    getPendingWithdrawalsService,
    getWithdrawalStatsAdminService,
    rejectPaymentService,
    rejectWithdrawalService
} from './transaction.service.js';

export const getPendingPayments = asyncHandler(async (req, res) => {
    const data = await getPendingPaymentsService(req.query);
    res.status(200).json(new ApiResponse(200, data, 'Pending payments fetched successfully'));
});

export const getPendingWithdrawals = asyncHandler(async (req, res) => {
    const data = await getPendingWithdrawalsService(req.query);
    res.status(200).json(new ApiResponse(200, data, 'Pending withdrawals fetched successfully'));
});

export const approvePayment = asyncHandler(async (req, res) => {
    const data = await approvePaymentService({
        ...req.body,
        adminId: req.admin.adminId
    });
    res.status(200).json(new ApiResponse(200, data, data.message));
});

export const rejectPayment = asyncHandler(async (req, res) => {
    const data = await rejectPaymentService({
        ...req.body,
        adminId: req.admin.adminId
    });
    res.status(200).json(new ApiResponse(200, data, data.message));
});

export const approveWithdrawal = asyncHandler(async (req, res) => {
    const data = await approveWithdrawalService({
        ...req.body,
        adminId: req.admin.adminId
    });
    res.status(200).json(new ApiResponse(200, data, data.message));
});

export const rejectWithdrawal = asyncHandler(async (req, res) => {
    const data = await rejectWithdrawalService({
        ...req.body,
        adminId: req.admin.adminId
    });
    res.status(200).json(new ApiResponse(200, data, data.message));
});

export const getAllTransactions = asyncHandler(async (req, res) => {
    const data = await getAllTransactionsAdminService(req.query);
    res.status(200).json(new ApiResponse(200, data, 'Transactions fetched successfully'));
});

export const getWithdrawalStats = asyncHandler(async (req, res) => {
    const data = await getWithdrawalStatsAdminService();
    res.status(200).json(new ApiResponse(200, data, 'Withdrawal statistics fetched successfully'));
});