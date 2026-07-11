import mongoose from 'mongoose';
import User from '../user/user.model.js';
import Transaction from '../transaction/transaction.model.js';
import { verifyFirebaseIdToken } from '../../shared/utils/firebaseTokenService.js';
import { generateToken } from '../../shared/utils/jwtService.js';
import { ApiError } from '../../shared/utils/apiError.js';
import { sanitizePhoneNumber } from './auth.validator.js';

const SIGNUP_BONUS = 500;

const buildUserResponse = (user) => ({
    id: user._id,
    fullName: user.fullName,
    phoneNumber: user.phoneNumber,
    walletBalance: user.walletBalance,
    bonusBalance: user.bonusBalance,
    totalBalance: user.walletBalance + user.bonusBalance,
    kycStatus: user.kycStatus,
    isVerified: user.isVerified
});

export const signupWithFirebaseService = async ({ fullName, idToken }) => {
    const cleanFullName = String(fullName || '').trim();
    if (!cleanFullName || cleanFullName.length < 3) {
        throw new ApiError(400, 'Full name must be at least 3 characters');
    }

    const { phoneNumber, firebaseUid } = await verifyFirebaseIdToken(idToken);
    const cleanPhoneNumber = sanitizePhoneNumber(phoneNumber);

    const existingUser = await User.findOne({ phoneNumber: cleanPhoneNumber });
    if (existingUser) {
        throw new ApiError(409, 'Phone number already registered. Please login instead.');
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const [user] = await User.create(
            [
                {
                    fullName: cleanFullName,
                    phoneNumber: cleanPhoneNumber,
                    firebaseUid,
                    isVerified: true,
                    walletBalance: 0,
                    bonusBalance: SIGNUP_BONUS,
                    signupBonusReceived: true,
                    lastLogin: new Date()
                }
            ],
            { session }
        );

        await Transaction.create(
            [
                {
                    userId: user._id,
                    type: 'credit',
                    category: 'signup_bonus',
                    amount: SIGNUP_BONUS,
                    balanceBefore: 0,
                    balanceAfter: 0,
                    bonusBalanceBefore: 0,
                    bonusBalanceAfter: SIGNUP_BONUS,
                    status: 'completed',
                    description: `Welcome bonus - ₹${SIGNUP_BONUS} credited to your account`
                }
            ],
            { session }
        );

        await session.commitTransaction();

        const token = generateToken({ userId: user._id });

        return {
            user: buildUserResponse(user),
            token,
            message: `🎉 Welcome! You've received ₹${SIGNUP_BONUS} signup bonus!`
        };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

export const loginWithFirebaseService = async ({ idToken }) => {
    const { phoneNumber, firebaseUid } = await verifyFirebaseIdToken(idToken);
    const cleanPhoneNumber = sanitizePhoneNumber(phoneNumber);

    const user = await User.findOne({ phoneNumber: cleanPhoneNumber, isActive: true });
    if (!user) {
        throw new ApiError(404, 'User not found. Please signup first.');
    }

    if (!user.firebaseUid) {
        user.firebaseUid = firebaseUid;
    }
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken({ userId: user._id });

    return {
        user: buildUserResponse(user),
        token
    };
};