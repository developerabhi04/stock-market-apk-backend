import { ApiResponse } from '../../shared/utils/apiResponse.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import {
    getPaymentConfigService,
    updateBankConfigService,
    updateFullPaymentConfigService,
    updateUpiConfigService,
} from './paymentConfig.service.js';

// ─── PUBLIC ───────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/payment-config/public
 * No auth required — React Native app calls this
 * Returns only enabled payment methods and hides sensitive data
 */
export const getPublicPaymentConfig = asyncHandler(async (_req, res) => {
    const config = await getPaymentConfigService();

    // Only expose enabled methods to the client app
    const publicData = {
        upi: config.upi?.enabled
            ? {
                enabled: true,
                upiId: config.upi.upiId,
                payeeName: config.upi.payeeName,
            }
            : { enabled: false },

        bank: config.bank?.enabled
            ? {
                enabled: true,
                accountHolderName: config.bank.accountHolderName,
                accountNumber: config.bank.accountNumber,
                ifscCode: config.bank.ifscCode,
                bankName: config.bank.bankName,
                accountType: config.bank.accountType,
            }
            : { enabled: false },
    };

    return res
        .status(200)
        .json(new ApiResponse(200, publicData, 'Payment config fetched successfully'));
});

// ─── ADMIN ────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/admin/payment-config
 * Admin — returns full config including disabled fields
 */
export const getAdminPaymentConfig = asyncHandler(async (_req, res) => {
    const config = await getPaymentConfigService();

    return res
        .status(200)
        .json(new ApiResponse(200, config, 'Payment config fetched successfully'));
});

/**
 * PUT /api/v1/admin/payment-config/upi
 * Admin — update UPI details only
 */
export const updateUpiConfig = asyncHandler(async (req, res) => {
    const adminId = req.admin?.adminId;
    const { upiId, payeeName, enabled } = req.body;

    if (enabled && !upiId?.trim()) {
        return res
            .status(400)
            .json(new ApiResponse(400, null, 'UPI ID is required when UPI is enabled'));
    }

    const config = await updateUpiConfigService({ upiId, payeeName, enabled, adminId });

    return res
        .status(200)
        .json(new ApiResponse(200, config, 'UPI config updated successfully'));
});

/**
 * PUT /api/v1/admin/payment-config/bank
 * Admin — update Bank details only
 */
export const updateBankConfig = asyncHandler(async (req, res) => {
    const adminId = req.admin?.adminId;
    const { accountHolderName, accountNumber, ifscCode, bankName, accountType, enabled } =
        req.body;

    if (enabled) {
        if (!accountNumber?.trim()) {
            return res
                .status(400)
                .json(new ApiResponse(400, null, 'Account number is required when bank is enabled'));
        }
        if (!ifscCode?.trim()) {
            return res
                .status(400)
                .json(new ApiResponse(400, null, 'IFSC code is required when bank is enabled'));
        }
        if (!accountHolderName?.trim()) {
            return res
                .status(400)
                .json(
                    new ApiResponse(
                        400,
                        null,
                        'Account holder name is required when bank is enabled'
                    )
                );
        }
    }

    const config = await updateBankConfigService({
        accountHolderName,
        accountNumber,
        ifscCode,
        bankName,
        accountType,
        enabled,
        adminId,
    });

    return res
        .status(200)
        .json(new ApiResponse(200, config, 'Bank config updated successfully'));
});

/**
 * PUT /api/v1/admin/payment-config
 * Admin — update full config (UPI + Bank) in one call
 */
export const updateFullPaymentConfig = asyncHandler(async (req, res) => {
    const adminId = req.admin?.adminId;
    const { upi, bank } = req.body;

    const config = await updateFullPaymentConfigService({ upi, bank, adminId });

    return res
        .status(200)
        .json(new ApiResponse(200, config, 'Payment config updated successfully'));
});