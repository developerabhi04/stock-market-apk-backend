import mongoose from 'mongoose';
import User from '../user/user.model.js';
import OTP from './otp.model.js';
import Transaction from '../transaction/transaction.model.js';
import { generateOTP, sendOTP } from '../../shared/utils/otpService.js';
import { generateToken } from '../../shared/utils/jwtService.js';
import { ApiError } from '../../shared/utils/apiError.js';
import { sanitizePhoneNumber, sanitizeEmail, sanitizeOTP } from './auth.validator.js';

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const SIGNUP_BONUS = 500;

const createOtpRecord = async ({ email, phoneNumber, purpose }) => {
    const cleanEmail = sanitizeEmail(email);

    await OTP.deleteMany({ email: cleanEmail, purpose });

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    await OTP.create({
        email: cleanEmail,
        phoneNumber: phoneNumber ? sanitizePhoneNumber(phoneNumber) : undefined,
        otp,
        purpose,
        expiresAt
    });

    await sendOTP(cleanEmail, otp, purpose);

    return { email: cleanEmail, otp, expiresAt };
};

export const sendSignupOtpService = async ({ fullName, phoneNumber, email }) => {
    const cleanPhoneNumber = sanitizePhoneNumber(phoneNumber);
    const cleanEmail = sanitizeEmail(email);

    const existingUser = await User.findOne({
        $or: [{ phoneNumber: cleanPhoneNumber }, { email: cleanEmail }]
    });
    if (existingUser) {
        throw new ApiError(409, 'Phone number or email already registered');
    }

    await createOtpRecord({ email: cleanEmail, phoneNumber: cleanPhoneNumber, purpose: 'signup' });

    return {
        email: cleanEmail,
        phoneNumber: cleanPhoneNumber,
        fullName: fullName.trim(),
        message: 'OTP sent to your email. Please verify to complete registration.'
    };
};

export const sendLoginOtpService = async ({ email }) => {
    const cleanEmail = sanitizeEmail(email);

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
        throw new ApiError(404, 'User not found. Please signup first.');
    }

    await createOtpRecord({ email: cleanEmail, phoneNumber: user.phoneNumber, purpose: 'login' });

    return { email: cleanEmail, message: 'OTP sent to your email' };
};

export const verifyLoginOtpService = async ({ email, otp }) => {
    const cleanEmail = sanitizeEmail(email);
    const cleanOtp = sanitizeOTP(otp);

    const latestOtpRecord = await OTP.findOne({
        email: cleanEmail,
        purpose: 'login',
        isUsed: false
    }).sort({ createdAt: -1 });

    if (!latestOtpRecord) {
        throw new ApiError(400, 'Invalid OTP. Please try again.');
    }

    if (!latestOtpRecord.isValid()) {
        throw new ApiError(400, 'OTP has expired. Please request a new one.');
    }

    if (latestOtpRecord.otp !== cleanOtp) {
        latestOtpRecord.attempts += 1;
        await latestOtpRecord.save();
        throw new ApiError(400, 'Invalid OTP. Please try again.');
    }

    latestOtpRecord.isUsed = true;
    latestOtpRecord.attempts += 1;
    await latestOtpRecord.save();

    const user = await User.findOne({ email: cleanEmail });
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
            email: user.email,
            walletBalance: user.walletBalance,
            bonusBalance: user.bonusBalance,
            totalBalance: user.totalBalance,
            kycStatus: user.kycStatus,
            isVerified: user.isVerified
        },
        token
    };
};

export const verifySignupOtpService = async ({ fullName, phoneNumber, email, otp }) => {
    const cleanPhoneNumber = sanitizePhoneNumber(phoneNumber);
    const cleanEmail = sanitizeEmail(email);
    const cleanOtp = sanitizeOTP(otp);

    const latestOtpRecord = await OTP.findOne({
        email: cleanEmail,
        purpose: 'signup',
        isUsed: false
    }).sort({ createdAt: -1 });

    if (!latestOtpRecord) {
        throw new ApiError(400, 'Invalid OTP. Please try again.');
    }

    if (!latestOtpRecord.isValid()) {
        throw new ApiError(400, 'OTP has expired. Please request a new one.');
    }

    if (latestOtpRecord.otp !== cleanOtp) {
        latestOtpRecord.attempts += 1;
        await latestOtpRecord.save();
        throw new ApiError(400, 'Invalid OTP. Please try again.');
    }

    const session = await mongoose.startSession();
    session.startTransaction({
        readPreference: 'primary',
        readConcern: { level: 'majority' },
        writeConcern: { w: 'majority' }
    });

    try {
        latestOtpRecord.isUsed = true;
        latestOtpRecord.attempts += 1;
        await latestOtpRecord.save({ session });

        const user = await User.create(
            [
                {
                    fullName: fullName.trim(),
                    phoneNumber: cleanPhoneNumber,
                    email: cleanEmail,
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
                email: user[0].email,
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

export const resendLoginOtpService = async ({ email }) => {
    const cleanEmail = sanitizeEmail(email);

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
        throw new ApiError(404, 'User not found. Please signup first.');
    }

    await createOtpRecord({ email: cleanEmail, phoneNumber: user.phoneNumber, purpose: 'login' });

    return { email: cleanEmail, message: 'OTP has been resent to your email.' };
};

export const resendSignupOtpService = async ({ fullName, phoneNumber, email }) => {
    const cleanPhoneNumber = sanitizePhoneNumber(phoneNumber);
    const cleanEmail = sanitizeEmail(email);

    const existingUser = await User.findOne({
        $or: [{ phoneNumber: cleanPhoneNumber }, { email: cleanEmail }]
    });
    if (existingUser) {
        throw new ApiError(409, 'Phone number or email already registered. Please login instead.');
    }

    await createOtpRecord({ email: cleanEmail, phoneNumber: cleanPhoneNumber, purpose: 'signup' });

    return {
        email: cleanEmail,
        phoneNumber: cleanPhoneNumber,
        fullName: fullName.trim(),
        message: 'OTP has been resent to your email.'
    };
};