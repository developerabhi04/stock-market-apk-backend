import mongoose from 'mongoose';
import User from '../user/user.model.js';
import OTP from './otp.model.js';
import { generateOTP, sendOTP } from '../../shared/utils/otpService.js';
import { generateToken } from '../../shared/utils/jwtService.js';
import { ApiError } from '../../shared/utils/apiError.js';
import { sanitizePhoneNumber, sanitizeOTP } from './auth.validator.js';

const OTP_EXPIRY_MS = 5 * 60 * 1000;

const createOtpRecord = async ({ phoneNumber, purpose }) => {
    const cleanPhoneNumber = sanitizePhoneNumber(phoneNumber);

    await OTP.deleteMany({ phoneNumber: cleanPhoneNumber, purpose });

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    await OTP.create({
        phoneNumber: cleanPhoneNumber,
        otp,
        purpose,
        expiresAt
    });

    await sendOTP(cleanPhoneNumber, otp, purpose);

    return { phoneNumber: cleanPhoneNumber, otp, expiresAt };
};

export const sendSignupOtpService = async ({ fullName, phoneNumber }) => {
    const cleanPhoneNumber = sanitizePhoneNumber(phoneNumber);

    const existingUser = await User.findOne({ phoneNumber: cleanPhoneNumber });
    if (existingUser) {
        throw new ApiError(409, 'Phone number already registered');
    }

    await createOtpRecord({ phoneNumber: cleanPhoneNumber, purpose: 'signup' });

    return {
        phoneNumber: cleanPhoneNumber,
        fullName: fullName.trim(),
        message: 'OTP sent successfully. Please verify to complete registration.'
    };
};

export const sendLoginOtpService = async ({ phoneNumber }) => {
    const cleanPhoneNumber = sanitizePhoneNumber(phoneNumber);

    const user = await User.findOne({ phoneNumber: cleanPhoneNumber });
    if (!user) {
        throw new ApiError(404, 'User not found. Please signup first.');
    }

    await createOtpRecord({ phoneNumber: cleanPhoneNumber, purpose: 'login' });

    return {
        phoneNumber: cleanPhoneNumber,
        message: 'OTP sent successfully'
    };
};

export const verifyLoginOtpService = async ({ phoneNumber, otp }) => {
    const cleanPhoneNumber = sanitizePhoneNumber(phoneNumber);
    const cleanOtp = sanitizeOTP(otp);

    const latestOtpRecord = await OTP.findOne({
        phoneNumber: cleanPhoneNumber,
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

    const user = await User.findOne({ phoneNumber: cleanPhoneNumber });
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
            kycStatus: user.kycStatus,
            isVerified: user.isVerified
        },
        token
    };
};

export const verifySignupOtpService = async ({ fullName, phoneNumber, otp }) => {
    const cleanPhoneNumber = sanitizePhoneNumber(phoneNumber);
    const cleanOtp = sanitizeOTP(otp);

    const latestOtpRecord = await OTP.findOne({
        phoneNumber: cleanPhoneNumber,
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
                    isVerified: true,
                    walletBalance: 0,
                    lastLogin: new Date()
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
                kycStatus: user[0].kycStatus,
                isVerified: user[0].isVerified
            },
            token,
            message: 'Signup successful!'
        };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

export const resendLoginOtpService = async ({ phoneNumber }) => {
    const cleanPhoneNumber = sanitizePhoneNumber(phoneNumber);

    const user = await User.findOne({ phoneNumber: cleanPhoneNumber });
    if (!user) {
        throw new ApiError(404, 'User not found. Please signup first.');
    }

    await createOtpRecord({ phoneNumber: cleanPhoneNumber, purpose: 'login' });

    return {
        phoneNumber: cleanPhoneNumber,
        message: 'OTP has been resent successfully. Please verify to login.'
    };
};

export const resendSignupOtpService = async ({ fullName, phoneNumber }) => {
    const cleanPhoneNumber = sanitizePhoneNumber(phoneNumber);

    const existingUser = await User.findOne({ phoneNumber: cleanPhoneNumber });
    if (existingUser) {
        throw new ApiError(409, 'Phone number already registered. Please login instead.');
    }

    await createOtpRecord({ phoneNumber: cleanPhoneNumber, purpose: 'signup' });

    return {
        phoneNumber: cleanPhoneNumber,
        fullName: fullName.trim(),
        message: 'OTP has been resent successfully. Please verify to complete registration.'
    };
};