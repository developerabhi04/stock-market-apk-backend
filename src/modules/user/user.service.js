import User from './user.model.js';
import Transaction from '../transaction/transaction.model.js';
import { ApiError } from '../../shared/utils/apiError.js';

const maskAccountNumber = (accountNumber = '') => {
    if (accountNumber.length <= 4) return accountNumber;
    return `****${accountNumber.slice(-4)}`;
};

const normalizeBankAccount = (account) => ({
    ...account.toObject(),
    maskedAccountNumber: maskAccountNumber(account.accountNumber)
});

const syncPrimaryBankDetails = (user) => {
    const primaryAccount = user.getPrimaryBankAccount();

    if (!primaryAccount) {
        user.bankDetails = {
            accountNumber: '',
            ifscCode: '',
            accountHolderName: '',
            bankName: '',
            verifiedAt: null
        };
        return;
    }

    user.bankDetails = {
        accountNumber: primaryAccount.accountNumber,
        ifscCode: primaryAccount.ifscCode,
        accountHolderName: primaryAccount.accountHolderName,
        bankName: primaryAccount.bankName,
        verifiedAt: primaryAccount.verifiedAt || null
    };
};

export const getUserProfileService = async ({ userId }) => {
    const user = await User.findById(userId).select('-__v').lean();

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    return {
        user: {
            id: user._id,
            fullName: user.fullName,
            phoneNumber: user.phoneNumber,
            countryCode: user.countryCode,
            walletBalance: user.walletBalance,
            isVerified: user.isVerified,
            kycStatus: user.kycStatus,
            panCard: user.panCard,
            bankDetails: user.bankDetails,
            bankAccounts: (user.bankAccounts || []).map((account) => ({
                ...account,
                maskedAccountNumber: maskAccountNumber(account.accountNumber)
            })),
            lastLogin: user.lastLogin,
            createdAt: user.createdAt
        }
    };
};

export const updateUserProfileService = async ({ userId, fullName }) => {
    const user = await User.findById(userId);

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    if (fullName && fullName.trim().length >= 3) {
        user.fullName = fullName.trim();
    }

    await user.save();

    return {
        user: {
            id: user._id,
            fullName: user.fullName,
            phoneNumber: user.phoneNumber,
            walletBalance: user.walletBalance
        }
    };
};

export const checkPhoneExistsService = async ({ phoneNumber }) => {
    const user = await User.findOne({ phoneNumber, isActive: true });

    return {
        exists: !!user,
        user: user
            ? {
                id: user._id,
                fullName: user.fullName,
                phoneNumber: user.phoneNumber,
                isVerified: user.isVerified
            }
            : null
    };
};

export const getBankAccountsService = async ({ userId }) => {
    const user = await User.findById(userId).select('bankAccounts bankDetails');

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    return {
        bankAccounts: user.bankAccounts.map(normalizeBankAccount),
        primaryBankAccount: user.getPrimaryBankAccount()
            ? normalizeBankAccount(user.getPrimaryBankAccount())
            : null,
        count: user.bankAccounts.length,
        maxAllowed: 3
    };
};

export const addBankAccountService = async ({
    userId,
    bankName,
    accountHolderName,
    accountNumber,
    ifscCode,
    accountType,
    isPrimary
}) => {
    if (!bankName || !accountHolderName || !accountNumber || !ifscCode) {
        throw new ApiError(400, 'All bank details are required');
    }

    const normalizedAccountNumber = String(accountNumber).trim();
    const normalizedIfscCode = String(ifscCode).trim().toUpperCase();
    const normalizedBankName = String(bankName).trim();
    const normalizedAccountHolderName = String(accountHolderName).trim();

    if (!/^\d{9,18}$/.test(normalizedAccountNumber)) {
        throw new ApiError(400, 'Invalid account number (9-18 digits required)');
    }

    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(normalizedIfscCode)) {
        throw new ApiError(400, 'Invalid IFSC code format');
    }

    const user = await User.findById(userId);

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    if (user.bankAccounts.length >= 3) {
        throw new ApiError(
            400,
            'Maximum 3 bank accounts allowed. Please delete an existing account to add new one.'
        );
    }

    const duplicateAccount = user.bankAccounts.some(
        (account) =>
            account.accountNumber === normalizedAccountNumber &&
            account.ifscCode === normalizedIfscCode
    );

    if (duplicateAccount) {
        throw new ApiError(400, 'This bank account is already added');
    }

    const isFirstAccount = user.bankAccounts.length === 0;
    const shouldBePrimary = Boolean(isPrimary) || isFirstAccount;

    if (shouldBePrimary) {
        user.bankAccounts.forEach((account) => {
            account.isPrimary = false;
        });
    }

    user.bankAccounts.push({
        bankName: normalizedBankName,
        accountHolderName: normalizedAccountHolderName,
        accountNumber: normalizedAccountNumber,
        ifscCode: normalizedIfscCode,
        accountType: accountType || 'Savings',
        isPrimary: shouldBePrimary,
        isVerified: false,
        addedAt: new Date()
    });

    syncPrimaryBankDetails(user);

    await user.save();

    return {
        bankAccounts: user.bankAccounts.map(normalizeBankAccount),
        primaryBankAccount: user.getPrimaryBankAccount()
            ? normalizeBankAccount(user.getPrimaryBankAccount())
            : null
    };
};

export const updateBankAccountService = async ({
    userId,
    accountId,
    bankName,
    accountHolderName,
    accountNumber,
    ifscCode,
    accountType,
    isPrimary
}) => {
    const user = await User.findById(userId);

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    const account = user.bankAccounts.id(accountId);

    if (!account) {
        throw new ApiError(404, 'Bank account not found');
    }

    const normalizedAccountNumber =
        accountNumber !== undefined ? String(accountNumber).trim() : account.accountNumber;

    const normalizedIfscCode =
        ifscCode !== undefined ? String(ifscCode).trim().toUpperCase() : account.ifscCode;

    if (!/^\d{9,18}$/.test(normalizedAccountNumber)) {
        throw new ApiError(400, 'Invalid account number (9-18 digits required)');
    }

    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(normalizedIfscCode)) {
        throw new ApiError(400, 'Invalid IFSC code format');
    }

    const duplicateAccount = user.bankAccounts.some(
        (item) =>
            item._id.toString() !== accountId &&
            item.accountNumber === normalizedAccountNumber &&
            item.ifscCode === normalizedIfscCode
    );

    if (duplicateAccount) {
        throw new ApiError(400, 'Another bank account with same details already exists');
    }

    if (bankName !== undefined) account.bankName = bankName.trim();
    if (accountHolderName !== undefined) account.accountHolderName = accountHolderName.trim();
    if (accountNumber !== undefined) account.accountNumber = normalizedAccountNumber;
    if (ifscCode !== undefined) account.ifscCode = normalizedIfscCode;
    if (accountType !== undefined) account.accountType = accountType;

    if (isPrimary === true) {
        user.bankAccounts.forEach((item) => {
            item.isPrimary = item._id.toString() === accountId;
        });
    }

    syncPrimaryBankDetails(user);

    await user.save();

    return {
        bankAccounts: user.bankAccounts.map(normalizeBankAccount),
        primaryBankAccount: user.getPrimaryBankAccount()
            ? normalizeBankAccount(user.getPrimaryBankAccount())
            : null
    };
};

export const deleteBankAccountService = async ({ userId, accountId }) => {
    const user = await User.findById(userId);

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    const account = user.bankAccounts.id(accountId);

    if (!account) {
        throw new ApiError(404, 'Bank account not found');
    }

    const hasPendingWithdrawal = await Transaction.findOne({
        userId,
        category: 'withdrawal',
        status: 'pending',
        'withdrawalDetails.accountNumber': account.accountNumber
    });

    if (hasPendingWithdrawal) {
        throw new ApiError(
            400,
            'Cannot delete account with pending withdrawal request. Please wait for admin approval or cancel the withdrawal.'
        );
    }

    const wasPrimary = account.isPrimary;
    const accountName = account.bankName;

    user.bankAccounts.pull(accountId);

    if (wasPrimary && user.bankAccounts.length > 0) {
        user.bankAccounts[0].isPrimary = true;
    }

    syncPrimaryBankDetails(user);

    await user.save();

    return {
        bankAccounts: user.bankAccounts.map(normalizeBankAccount),
        primaryBankAccount: user.getPrimaryBankAccount()
            ? normalizeBankAccount(user.getPrimaryBankAccount())
            : null,
        message: `${accountName} account deleted successfully`
    };
};

export const setPrimaryBankAccountService = async ({ userId, accountId }) => {
    const user = await User.findById(userId);

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    const account = user.bankAccounts.id(accountId);

    if (!account) {
        throw new ApiError(404, 'Bank account not found');
    }

    user.bankAccounts.forEach((item) => {
        item.isPrimary = item._id.toString() === accountId;
    });

    syncPrimaryBankDetails(user);

    await user.save();

    return {
        bankAccounts: user.bankAccounts.map(normalizeBankAccount),
        primaryBankAccount: normalizeBankAccount(account),
        message: 'Primary account updated successfully'
    };
};