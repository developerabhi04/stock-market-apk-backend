import mongoose from 'mongoose';
import User from '../user/user.model.js';
import OTP from './otp.model.js';
import Transaction from '../transaction/transaction.model.js';
import { generateOTP, sendOTP } from '../../shared/utils/otpService.js';
import { generateToken } from '../../shared/utils/jwtService.js';
import { ApiError } from '../../shared/utils/apiError.js';

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const SIGNUP_BONUS = 500;

const createOtpRecord = async ({ phoneNumber, purpose }) => {
    await OTP.deleteMany({ phoneNumber, purpose });

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    await OTP.create({
        phoneNumber,
        otp,
        purpose,
        expiresAt
    });

    await sendOTP(phoneNumber, otp, purpose);

    return { phoneNumber, otp, expiresAt };
};

export const sendSignupOtpService = async ({ fullName, phoneNumber }) => {
    const existingUser = await User.findOne({ phoneNumber });
    if (existingUser) {
        throw new ApiError(409, 'Phone number already registered');
    }

    await createOtpRecord({ phoneNumber, purpose: 'signup' });

    return {
        phoneNumber,
        fullName,
        message: 'OTP sent successfully. Please verify to complete registration.'
    };
};

export const sendLoginOtpService = async ({ phoneNumber }) => {
    const user = await User.findOne({ phoneNumber });
    if (!user) {
        throw new ApiError(404, 'User not found. Please signup first.');
    }

    await createOtpRecord({ phoneNumber, purpose: 'login' });

    return {
        phoneNumber,
        message: 'OTP sent successfully'
    };
};

export const verifyLoginOtpService = async ({ phoneNumber, otp }) => {
    const otpRecord = await OTP.findOne({
        phoneNumber,
        otp,
        purpose: 'login',
        isUsed: false
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
        throw new ApiError(400, 'Invalid OTP. Please try again.');
    }

    if (!otpRecord.isValid()) {
        throw new ApiError(400, 'OTP has expired. Please request a new one.');
    }

    otpRecord.isUsed = true;
    otpRecord.attempts += 1;
    await otpRecord.save();

    const user = await User.findByPhone(phoneNumber);
    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken({ userId: user._id });

    return {
        user: {
            id: user._id,
            fullName: user.fullName,
            phoneNumber: user.phoneNumber,
            walletBalance: user.walletBalance,
            bonusBalance: user.bonusBalance,
            totalBalance: user.totalBalance,
            kycStatus: user.kycStatus,
            isVerified: user.isVerified
        },
        token
    };
};

export const verifySignupOtpService = async ({ fullName, phoneNumber, otp }) => {
    const otpRecord = await OTP.findOne({
        phoneNumber,
        otp,
        purpose: 'signup',
        isUsed: false
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
        throw new ApiError(400, 'Invalid OTP. Please try again.');
    }

    if (otpRecord.expiresAt < new Date()) {
        throw new ApiError(400, 'OTP has expired. Please request a new one.');
    }

    const session = await mongoose.startSession();
    session.startTransaction({
        readPreference: 'primary',
        readConcern: { level: 'majority' },
        writeConcern: { w: 'majority' }
    });

    try {
        otpRecord.isUsed = true;
        await otpRecord.save({ session });

        const user = await User.create(
            [
                {
                    fullName: fullName.trim(),
                    phoneNumber,
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
                    userId: user[0]._id,
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

        const token = generateToken({ userId: user[0]._id });

        return {
            user: {
                id: user[0]._id,
                fullName: user[0].fullName,
                phoneNumber: user[0].phoneNumber,
                walletBalance: user[0].walletBalance,
                bonusBalance: user[0].bonusBalance,
                totalBalance: user[0].walletBalance + user[0].bonusBalance,
                kycStatus: user[0].kycStatus,
                isVerified: user[0].isVerified
            },
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

export const resendLoginOtpService = async ({ phoneNumber }) => {
    const user = await User.findOne({ phoneNumber });
    if (!user) {
        throw new ApiError(404, 'User not found. Please signup first.');
    }

    await createOtpRecord({ phoneNumber, purpose: 'login' });

    return {
        phoneNumber,
        message: 'OTP has been resent successfully. Please verify to login.'
    };
};

export const resendSignupOtpService = async ({ fullName, phoneNumber }) => {
    const existingUser = await User.findOne({ phoneNumber });
    if (existingUser) {
        throw new ApiError(409, 'Phone number already registered. Please login instead.');
    }

    await createOtpRecord({ phoneNumber, purpose: 'signup' });

    return {
        phoneNumber,
        fullName,
        message: 'OTP has been resent successfully. Please verify to complete registration.'
    };
};