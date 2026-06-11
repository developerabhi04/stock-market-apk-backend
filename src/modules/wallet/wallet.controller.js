import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { ApiResponse } from '../../shared/utils/apiResponse.js';
import {
    addMoneyService,
    getTransactionsService,
    getWalletBalanceService,
    withdrawMoneyService
} from './wallet.service.js';

export const getWalletBalance = asyncHandler(async (req, res) => {
    const data = await getWalletBalanceService({ userId: req.user.userId });
    res.status(200).json(new ApiResponse(200, data, 'Wallet balance fetched successfully'));
});

export const addMoney = asyncHandler(async (req, res) => {
    const data = await addMoneyService({
        userId: req.user.userId,
        ...req.body
    });
    res.status(200).json(new ApiResponse(200, data, data.message));
});

export const withdrawMoney = asyncHandler(async (req, res) => {
    const data = await withdrawMoneyService({
        userId: req.user.userId,
        ...req.body
    });
    res.status(200).json(new ApiResponse(200, data, data.message));
});

export const getTransactions = asyncHandler(async (req, res) => {
    const data = await getTransactionsService({
        userId: req.user.userId,
        ...req.query
    });
    res.status(200).json(new ApiResponse(200, data, 'Transactions fetched successfully'));
});