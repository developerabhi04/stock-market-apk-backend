import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { ApiResponse } from '../../shared/utils/apiResponse.js';
import { ApiError } from '../../shared/utils/apiError.js';
import {
    getUserProfileService,
    updateUserProfileService,
    checkPhoneExistsService,
    getBankAccountsService,
    addBankAccountService,
    updateBankAccountService,
    deleteBankAccountService,
    setPrimaryBankAccountService
} from './user.service.js';

const getAuthenticatedUserId = (req) => {
    const userId = req.user?._id || req.user?.id || req.user?.userId;

    if (!userId) {
        throw new ApiError(401, 'Authenticated user id not found in token');
    }

    return userId;
};

export const getUserProfile = asyncHandler(async (req, res) => {
    const data = await getUserProfileService({ userId: getAuthenticatedUserId(req) });

    res.status(200).json(new ApiResponse(200, data, 'User profile fetched successfully'));
});

export const updateUserProfile = asyncHandler(async (req, res) => {
    const data = await updateUserProfileService({
        userId: getAuthenticatedUserId(req),
        fullName: req.body.fullName
    });

    res.status(200).json(new ApiResponse(200, data, 'Profile updated successfully'));
});

export const checkPhoneExists = asyncHandler(async (req, res) => {
    const data = await checkPhoneExistsService({
        phoneNumber: req.params.phoneNumber
    });

    res.status(200).json(new ApiResponse(200, data, 'Phone check completed'));
});

export const getBankAccounts = asyncHandler(async (req, res) => {
    const data = await getBankAccountsService({ userId: getAuthenticatedUserId(req) });

    res.status(200).json(new ApiResponse(200, data, 'Bank accounts fetched successfully'));
});

export const addBankAccount = asyncHandler(async (req, res) => {
    const data = await addBankAccountService({
        userId: getAuthenticatedUserId(req),
        bankName: req.body.bankName,
        accountHolderName: req.body.accountHolderName,
        accountNumber: req.body.accountNumber,
        ifscCode: req.body.ifscCode,
        accountType: req.body.accountType,
        isPrimary: req.body.isPrimary
    });

    res.status(201).json(new ApiResponse(201, data, 'Bank account added successfully'));
});

export const updateBankAccount = asyncHandler(async (req, res) => {
    const data = await updateBankAccountService({
        userId: getAuthenticatedUserId(req),
        accountId: req.params.accountId,
        bankName: req.body.bankName,
        accountHolderName: req.body.accountHolderName,
        accountNumber: req.body.accountNumber,
        ifscCode: req.body.ifscCode,
        accountType: req.body.accountType,
        isPrimary: req.body.isPrimary
    });

    res.status(200).json(new ApiResponse(200, data, 'Bank account updated successfully'));
});

export const deleteBankAccount = asyncHandler(async (req, res) => {
    const data = await deleteBankAccountService({
        userId: getAuthenticatedUserId(req),
        accountId: req.params.accountId
    });

    res.status(200).json(new ApiResponse(200, data, 'Bank account deleted successfully'));
});

export const setPrimaryBankAccount = asyncHandler(async (req, res) => {
    const data = await setPrimaryBankAccountService({
        userId: getAuthenticatedUserId(req),
        accountId: req.params.accountId
    });

    res.status(200).json(new ApiResponse(200, data, 'Primary bank account updated successfully'));
});