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

const getLatestOtpRecord = async ({ email, purpose }) => {
    return OTP.findOne({
        email,
        purpose,
        isUsed: false
    }).sort({ createdAt: -1 });
};

const createOtpRecord = async ({ email, phoneNumber, purpose }) => {
    const cleanEmail = sanitizeEmail(email);
    const cleanPhoneNumber = phoneNumber ? sanitizePhoneNumber(phoneNumber) : undefined;

    await OTP.deleteMany({ email: cleanEmail, purpose });

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    await OTP.create({
        email: cleanEmail,
        phoneNumber: cleanPhoneNumber,
        otp,
        purpose,
        expiresAt
    });

    await sendOTP(cleanEmail, otp, purpose);

    return { email: cleanEmail, otp, expiresAt };
};

const buildUserResponse = (user) => ({
    id: user._id,
    fullName: user.fullName,
    phoneNumber: user.phoneNumber,
    email: user.email,
    walletBalance: user.walletBalance,
    bonusBalance: user.bonusBalance,
    totalBalance: user.walletBalance + user.bonusBalance,
    kycStatus: user.kycStatus,
    isVerified: user.isVerified
});

const markOtpUsed = async (otpDoc) => {
    otpDoc.isUsed = true;
    otpDoc.attempts += 1;
    await otpDoc.save();
};

export const sendSignupOtpService = async ({ fullName, phoneNumber, email }) => {
    const cleanPhoneNumber = sanitizePhoneNumber(phoneNumber);
    const cleanEmail = sanitizeEmail(email);
    const cleanFullName = String(fullName || '').trim();

    if (!cleanFullName || cleanFullName.length < 3) {
        throw new ApiError(400, 'Full name must be at least 3 characters');
    }

    const existingUser = await User.findOne({
        $or: [{ phoneNumber: cleanPhoneNumber }, { email: cleanEmail }]
    });

    if (existingUser) {
        throw new ApiError(409, 'Phone number or email already registered');
    }

    await createOtpRecord({
        email: cleanEmail,
        phoneNumber: cleanPhoneNumber,
        purpose: 'signup'
    });

    return {
        email: cleanEmail,
        phoneNumber: cleanPhoneNumber,
        fullName: cleanFullName,
        message: 'OTP sent to your email. Please verify to complete registration.'
    };
};

export const sendLoginOtpService = async ({ email }) => {
    const cleanEmail = sanitizeEmail(email);

    const user = await User.findOne({ email: cleanEmail, isActive: true });
    if (!user) {
        throw new ApiError(404, 'User not found. Please signup first.');
    }

    await createOtpRecord({
        email: cleanEmail,
        phoneNumber: user.phoneNumber,
        purpose: 'login'
    });

    return {
        email: cleanEmail,
        message: 'OTP sent to your email'
    };
};

export const verifyLoginOtpService = async ({ email, otp }) => {
    const cleanEmail = sanitizeEmail(email);
    const cleanOtp = sanitizeOTP(otp);

    if (!cleanOtp || !/^\d{6}$/.test(cleanOtp)) {
        throw new ApiError(400, 'OTP must be 6 digits');
    }

    const latestOtpRecord = await getLatestOtpRecord({ email: cleanEmail, purpose: 'login' });
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

    await markOtpUsed(latestOtpRecord);

    const user = await User.findOne({ email: cleanEmail, isActive: true });
    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken({ userId: user._id });

    return {
        user: buildUserResponse(user),
        token
    };
};

export const verifySignupOtpService = async ({ fullName, phoneNumber, email, otp }) => {
    const cleanFullName = String(fullName || '').trim();
    const cleanPhoneNumber = sanitizePhoneNumber(phoneNumber);
    const cleanEmail = sanitizeEmail(email);
    const cleanOtp = sanitizeOTP(otp);

    if (!cleanFullName || cleanFullName.length < 3) {
        throw new ApiError(400, 'Full name must be at least 3 characters');
    }

    if (!cleanOtp || !/^\d{6}$/.test(cleanOtp)) {
        throw new ApiError(400, 'OTP must be 6 digits');
    }

    const latestOtpRecord = await getLatestOtpRecord({ email: cleanEmail, purpose: 'signup' });
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
    try {
        session.startTransaction();

        await markOtpUsed(latestOtpRecord);

        const [user] = await User.create(
            [
                {
                    fullName: cleanFullName,
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

export const resendLoginOtpService = async ({ email }) => {
    const cleanEmail = sanitizeEmail(email);

    const user = await User.findOne({ email: cleanEmail, isActive: true });
    if (!user) {
        throw new ApiError(404, 'User not found. Please signup first.');
    }

    await createOtpRecord({
        email: cleanEmail,
        phoneNumber: user.phoneNumber,
        purpose: 'login'
    });

    return {
        email: cleanEmail,
        message: 'OTP has been resent to your email.'
    };
};

export const resendSignupOtpService = async ({ fullName, phoneNumber, email }) => {
    const cleanFullName = String(fullName || '').trim();
    const cleanPhoneNumber = sanitizePhoneNumber(phoneNumber);
    const cleanEmail = sanitizeEmail(email);

    if (!cleanFullName || cleanFullName.length < 3) {
        throw new ApiError(400, 'Full name must be at least 3 characters');
    }

    const existingUser = await User.findOne({
        $or: [{ phoneNumber: cleanPhoneNumber }, { email: cleanEmail }]
    });

    if (existingUser) {
        throw new ApiError(409, 'Phone number or email already registered. Please login instead.');
    }

    await createOtpRecord({
        email: cleanEmail,
        phoneNumber: cleanPhoneNumber,
        purpose: 'signup'
    });

    return {
        email: cleanEmail,
        phoneNumber: cleanPhoneNumber,
        fullName: cleanFullName,
        message: 'OTP has been resent to your email.'
    };
};