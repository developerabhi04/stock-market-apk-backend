import User from './user.model.js';                           
import Transaction from '../transaction/transaction.model.js';       
import { ApiError } from '../../shared/utils/apiError.js';      
import { ApiResponse } from '../../shared/utils/apiResponse.js';   
import { asyncHandler } from '../../shared/utils/asyncHandler.js';  

/**
 * ✅ Get User Profile (Protected Route)
 */
export const getUserProfile = asyncHandler(async (req, res) => {
    console.log('📋 Getting profile for user:', req.user.userId);

    const user = await User.findById(req.user.userId)
        .select('-__v')
        .lean();

    if (!user) {
        throw new ApiError(404, 'User not found');
    }


    const userData = {
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

    console.log('✅ Profile fetched successfully');

    res.status(200).json(new ApiResponse(200, userData));
});

/**
 * ✅ Update User Profile (Protected Route)
 */
export const updateUserProfile = asyncHandler(async (req, res) => {
    const { fullName } = req.body;

    console.log('📝 Updating profile for user:', req.user.userId);

    const user = await User.findById(req.user.userId);

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    if (fullName && fullName.trim().length >= 3) {
        user.fullName = fullName.trim();
    }

    await user.save();

    const userData = {
        id: user._id,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        walletBalance: user.walletBalance,
        bonusBalance: user.bonusBalance,
        totalBalance: user.walletBalance + user.bonusBalance
    };

    console.log('✅ Profile updated successfully');

    res.status(200).json(
        new ApiResponse(200, userData, 'Profile updated successfully')
    );
});

/**
 * ✅ Check if Phone Number Exists
 */
export const checkPhoneExists = asyncHandler(async (req, res) => {
    const { phoneNumber } = req.params;

    console.log('🔍 Checking if phone exists:', phoneNumber);

    const user = await User.findOne({ phoneNumber, isActive: true });

    res.status(200).json(
        new ApiResponse(200, {
            exists: !!user,
            user: user ? {
                id: user._id,
                fullName: user.fullName,
                phoneNumber: user.phoneNumber,
                isVerified: user.isVerified
            } : null
        })
    );
});



/**
 * ✅ Get All Bank Accounts
 */
export const getBankAccounts = asyncHandler(async (req, res) => {
    const userId = req.user.userId;

    console.log('🏦 Fetching bank accounts for user:', userId);

    const user = await User.findById(userId).select('bankAccounts');

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    console.log('✅ Bank accounts fetched:', user.bankAccounts.length);

    res.status(200).json(
        new ApiResponse(200, {
            bankAccounts: user.bankAccounts,
            count: user.bankAccounts.length,
            maxAllowed: 3
        })
    );
});

/**
 * ✅ Add Bank Account
 */
export const addBankAccount = asyncHandler(async (req, res) => {
    const { bankName, accountHolderName, accountNumber, ifscCode, accountType, isPrimary } = req.body;
    const userId = req.user.userId;

    console.log('➕ Adding bank account for user:', userId);

    // Validation
    if (!bankName || !accountHolderName || !accountNumber || !ifscCode) {
        throw new ApiError(400, 'All bank details are required');
    }

    // Validate account number (9-18 digits)
    if (!/^\d{9,18}$/.test(accountNumber)) {
        throw new ApiError(400, 'Invalid account number (9-18 digits required)');
    }

    // Validate IFSC code
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.toUpperCase())) {
        throw new ApiError(400, 'Invalid IFSC code format');
    }

    const user = await User.findById(userId);

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    // Check if user already has 3 accounts
    if (user.bankAccounts.length >= 3) {
        throw new ApiError(400, 'Maximum 3 bank accounts allowed. Please delete an existing account to add new one.');
    }

    // Check if account already exists
    const accountExists = user.bankAccounts.some(
        account => account.accountNumber === accountNumber
    );

    if (accountExists) {
        throw new ApiError(400, 'This bank account is already added');
    }

    // If this is the first account or marked as primary, set it as primary
    const isFirstAccount = user.bankAccounts.length === 0;
    const shouldBePrimary = isPrimary || isFirstAccount;

    // If setting as primary, unset other primary accounts
    if (shouldBePrimary) {
        user.bankAccounts.forEach(account => {
            account.isPrimary = false;
        });
    }

    // Add new bank account
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

    console.log('✅ Bank account added successfully');

    res.status(201).json(
        new ApiResponse(201, {
            bankAccounts: user.bankAccounts,
            message: 'Bank account added successfully'
        })
    );
});

/**
 * ✅ Delete Bank Account
 */
export const deleteBankAccount = asyncHandler(async (req, res) => {
    const { accountId } = req.params;
    const userId = req.user.userId;

    console.log('🗑️ Deleting bank account:', accountId);

    const user = await User.findById(userId);

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    const accountIndex = user.bankAccounts.findIndex(
        account => account._id.toString() === accountId
    );

    if (accountIndex === -1) {
        throw new ApiError(404, 'Bank account not found');
    }

    // Check if account has pending withdrawals
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

    // Remove account
    user.bankAccounts.splice(accountIndex, 1);

    // If removed account was primary and there are remaining accounts, set first as primary
    if (wasPrimary && user.bankAccounts.length > 0) {
        user.bankAccounts[0].isPrimary = true;
    }

    await user.save();

    console.log('✅ Bank account deleted successfully');

    res.status(200).json(
        new ApiResponse(200, {
            bankAccounts: user.bankAccounts,
            message: `${accountName} account deleted successfully`
        })
    );
});

/**
 * ✅ Set Primary Bank Account
 */
export const setPrimaryBankAccount = asyncHandler(async (req, res) => {
    const { accountId } = req.params;
    const userId = req.user.userId;

    console.log('⭐ Setting primary bank account:', accountId);

    const user = await User.findById(userId);

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    const accountExists = user.bankAccounts.some(
        account => account._id.toString() === accountId
    );

    if (!accountExists) {
        throw new ApiError(404, 'Bank account not found');
    }

    // Unset all primary flags
    user.bankAccounts.forEach(account => {
        account.isPrimary = account._id.toString() === accountId;
    });

    await user.save();

    console.log('✅ Primary account updated successfully');

    res.status(200).json(
        new ApiResponse(200, {
            bankAccounts: user.bankAccounts,
            message: 'Primary account updated successfully'
        })
    );
});
