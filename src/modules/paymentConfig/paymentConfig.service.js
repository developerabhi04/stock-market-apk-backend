import PaymentConfig from './paymentConfig.model.js';

// ─── Get current config (creates one if none exists) ─────────────────────────
export const getPaymentConfigService = async () => {
    let config = await PaymentConfig.findOne().lean();

    if (!config) {
        // Auto-seed an empty config so the document always exists
        const created = await PaymentConfig.create({});
        config = created.toObject();
    }

    return config;
};

// ─── Update UPI config ────────────────────────────────────────────────────────
export const updateUpiConfigService = async ({ upiId, payeeName, enabled, adminId }) => {
    const config = await PaymentConfig.findOneAndUpdate(
        {},
        {
            $set: {
                'upi.upiId': upiId?.trim() ?? '',
                'upi.payeeName': payeeName?.trim() ?? '',
                'upi.enabled': enabled ?? false,
                updatedBy: adminId,
            },
        },
        { upsert: true, new: true, runValidators: true }
    );

    return config;
};

// ─── Update Bank config ───────────────────────────────────────────────────────
export const updateBankConfigService = async ({
    accountHolderName,
    accountNumber,
    ifscCode,
    bankName,
    accountType,
    enabled,
    adminId,
}) => {
    const config = await PaymentConfig.findOneAndUpdate(
        {},
        {
            $set: {
                'bank.accountHolderName': accountHolderName?.trim() ?? '',
                'bank.accountNumber': accountNumber?.trim() ?? '',
                'bank.ifscCode': ifscCode?.trim().toUpperCase() ?? '',
                'bank.bankName': bankName?.trim() ?? '',
                'bank.accountType': accountType ?? 'savings',
                'bank.enabled': enabled ?? false,
                updatedBy: adminId,
            },
        },
        { upsert: true, new: true, runValidators: true }
    );

    return config;
};

// ─── Update full config in one call (admin panel "Save All") ──────────────────
export const updateFullPaymentConfigService = async ({ upi, bank, adminId }) => {
    const updatePayload = {
        updatedBy: adminId,
    };

    if (upi !== undefined) {
        updatePayload['upi.upiId'] = upi.upiId?.trim() ?? '';
        updatePayload['upi.payeeName'] = upi.payeeName?.trim() ?? '';
        updatePayload['upi.enabled'] = upi.enabled ?? false;
    }

    if (bank !== undefined) {
        updatePayload['bank.accountHolderName'] = bank.accountHolderName?.trim() ?? '';
        updatePayload['bank.accountNumber'] = bank.accountNumber?.trim() ?? '';
        updatePayload['bank.ifscCode'] = bank.ifscCode?.trim().toUpperCase() ?? '';
        updatePayload['bank.bankName'] = bank.bankName?.trim() ?? '';
        updatePayload['bank.accountType'] = bank.accountType ?? 'savings';
        updatePayload['bank.enabled'] = bank.enabled ?? false;
    }

    const config = await PaymentConfig.findOneAndUpdate(
        {},
        { $set: updatePayload },
        { upsert: true, new: true, runValidators: true }
    );

    return config;
};