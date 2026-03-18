import User from './user.model.js';
import Transaction from '../transaction/transaction.model.js';
import { ApiError } from '../../shared/utils/apiError.js';

// ─── Profile ──────────────────────────────────────────────────

export const getUserById = async (userId) => {
    const user = await User.findById(userId).select('-__v').lean();
    if (!user) throw new ApiError(404, 'User not found');

    return {
        id: user._id,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        countryCode: user.countryCode,
        walletBalance: user.walletBalance,
        bonusBalance: user.bonusBalance,
        totalBalance: user.walletBalance + user.bonusBalance,
        isVerified: user.isVerified,
        kycStatus: user.kycStatus,
        panCard: user.panCard,
        bankDetails: user.bankDetails,
        signupBonusReceived: user.signupBonusReceived,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
    };
};

export const updateProfile = async (userId, { fullName }) => {
    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, 'User not found');

    if (fullName && fullName.trim().length >= 3) {
        user.fullName = fullName.trim();
    }

    await user.save();

    return {
        id: user._id,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        walletBalance: user.walletBalance,
        bonusBalance: user.bonusBalance,
        totalBalance: user.walletBalance + user.bonusBalance
    };
};

export const checkPhoneExists = async (phoneNumber) => {
    const user = await User.findOne({ phoneNumber, isActive: true });
    return {
        exists: !!user,
        user: user ? {
            id: user._id,
            fullName: user.fullName,
            phoneNumber: user.phoneNumber,
            isVerified: user.isVerified
        } : null
    };
};

// ─── Bank Accounts ────────────────────────────────────────────

export const getBankAccounts = async (userId) => {
    const user = await User.findById(userId).select('bankAccounts');
    if (!user) throw new ApiError(404, 'User not found');

    return {
        bankAccounts: user.bankAccounts,
        count: user.bankAccounts.length,
        maxAllowed: 3
    };
};

export const addBankAccount = async (userId, { bankName, accountHolderName, accountNumber, ifscCode, accountType, isPrimary }) => {
    if (!bankName || !accountHolderName || !accountNumber || !ifscCode) {
        throw new ApiError(400, 'All bank details are required');
    }

    if (!/^\d{9,18}$/.test(accountNumber)) {
        throw new ApiError(400, 'Invalid account number (9-18 digits required)');
    }

    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.toUpperCase())) {
        throw new ApiError(400, 'Invalid IFSC code format');
    }

    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, 'User not found');

    if (user.bankAccounts.length >= 3) {
        throw new ApiError(400, 'Maximum 3 bank accounts allowed. Please delete an existing account to add new one.');
    }

    const accountExists = user.bankAccounts.some(a => a.accountNumber === accountNumber);
    if (accountExists) throw new ApiError(400, 'This bank account is already added');

    const isFirstAccount = user.bankAccounts.length === 0;
    const shouldBePrimary = isPrimary || isFirstAccount;

    if (shouldBePrimary) {
        user.bankAccounts.forEach(a => { a.isPrimary = false; });
    }

    user.bankAccounts.push({
        bankName: bankName.trim(),
        accountHolderName: accountHolderName.trim(),
        accountNumber: accountNumber.trim(),
        ifscCode: ifscCode.toUpperCase().trim(),
        accountType: accountType || 'Savings',
        isPrimary: shouldBePrimary,
        isVerified: false,
        addedAt: new Date()
    });

    await user.save();
    return { bankAccounts: user.bankAccounts };
};

export const deleteBankAccount = async (userId, accountId) => {
    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, 'User not found');

    const accountIndex = user.bankAccounts.findIndex(a => a._id.toString() === accountId);
    if (accountIndex === -1) throw new ApiError(404, 'Bank account not found');

    const hasPendingWithdrawal = await Transaction.findOne({
        userId,
        category: 'withdrawal',
        status: 'pending',
        'withdrawalDetails.accountNumber': user.bankAccounts[accountIndex].accountNumber
    });

    if (hasPendingWithdrawal) {
        throw new ApiError(400, 'Cannot delete account with pending withdrawal request. Please wait for admin approval or cancel the withdrawal.');
    }

    const wasPrimary = user.bankAccounts[accountIndex].isPrimary;
    const accountName = user.bankAccounts[accountIndex].bankName;

    user.bankAccounts.splice(accountIndex, 1);

    if (wasPrimary && user.bankAccounts.length > 0) {
        user.bankAccounts[0].isPrimary = true;
    }

    await user.save();
    return { bankAccounts: user.bankAccounts, accountName };
};

export const setPrimaryBankAccount = async (userId, accountId) => {
    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, 'User not found');

    const accountExists = user.bankAccounts.some(a => a._id.toString() === accountId);
    if (!accountExists) throw new ApiError(404, 'Bank account not found');

    user.bankAccounts.forEach(a => {
        a.isPrimary = a._id.toString() === accountId;
    });

    await user.save();
    return { bankAccounts: user.bankAccounts };
};
