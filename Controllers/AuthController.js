import User from '../Models/UserModel.js';
import OTP from '../Models/UserOTPModel.js';
import { generateOTP, sendOTP } from '../Utils/OTPService.js';
import { generateToken } from '../Utils/JwtService.js';
import { ApiError } from '../Utils/apiError.js';
import { ApiResponse } from '../Utils/apiResponse.js';
import { asyncHandler } from '../Utils/asyncHandler.js';
import mongoose from 'mongoose';
import Transaction from '../Models/TransactionModel.js';




/**
 * Send Signup OTP
 */
export const sendSignupOTP = asyncHandler(async (req, res) => {
    const { fullName, phoneNumber } = req.body;

    if (!fullName || !phoneNumber) {
        throw new ApiError(400, 'Full name and phone number are required');
    }

    if (!/^[6-9]\d{9}$/.test(phoneNumber)) {
        throw new ApiError(400, 'Invalid Indian phone number');
    }

    const existingUser = await User.findOne({ phoneNumber });
    if (existingUser) {
        throw new ApiError(409, 'Phone number already registered');
    }

    await OTP.deleteMany({ phoneNumber, purpose: 'signup' });

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // ✅ Add this

    await OTP.create({
        phoneNumber,
        otp,
        purpose: 'signup',
        expiresAt: expiresAt  // ✅ Add this
    });

    await sendOTP(phoneNumber, otp, 'signup');

    res.status(200).json(
        new ApiResponse(200, {
            phoneNumber,
            fullName,
            message: 'OTP sent successfully. Please verify to complete registration.'
        }, 'Success')
    );
});

/**
 * Send Login OTP
 */
export const sendLoginOTP = asyncHandler(async (req, res) => {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
        throw new ApiError(400, 'Phone number is required');
    }

    if (!/^[6-9]\d{9}$/.test(phoneNumber)) {
        throw new ApiError(400, 'Invalid Indian phone number');
    }

    const user = await User.findOne({ phoneNumber });
    if (!user) {
        throw new ApiError(404, 'User not found. Please signup first.');
    }

    await OTP.deleteMany({ phoneNumber, purpose: 'login' });

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // ✅ Add this

    await OTP.create({
        phoneNumber,
        otp,
        purpose: 'login',
        expiresAt: expiresAt  // ✅ Add this
    });

    await sendOTP(phoneNumber, otp, 'login');

    res.status(200).json(
        new ApiResponse(200, {
            phoneNumber,
            message: 'OTP sent successfully'
        }, 'Success')
    );
});



// @desc    Verify OTP and Login
// @route   POST /api/auth/login/verify-otp
// @access  Public
export const verifyLoginOTP = asyncHandler(async (req, res) => {
    const { phoneNumber, otp } = req.body;

    // Validate inputs
    if (!phoneNumber || !otp) {
        throw new ApiError(400, 'Phone number and OTP are required');
    }

    // Find OTP record
    const otpRecord = await OTP.findOne({
        phoneNumber,
        otp,
        purpose: 'login',
        isUsed: false
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
        throw new ApiError(400, 'Invalid OTP. Please try again.');
    }

    // Check if OTP is expired
    if (!otpRecord.isValid()) {
        throw new ApiError(400, 'OTP has expired. Please request a new one.');
    }

    // Mark OTP as used
    otpRecord.isUsed = true;
    otpRecord.attempts += 1;
    await otpRecord.save();

    // Find user
    const user = await User.findByPhone(phoneNumber);
    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = generateToken({ userId: user._id });

    res.status(200).json(
        new ApiResponse(200, {
            user: {
                id: user._id,
                fullName: user.fullName,
                phoneNumber: user.phoneNumber,
                walletBalance: user.walletBalance,
                kycStatus: user.kycStatus,
                isVerified: user.isVerified
            },
            token
        }, 'Login successful')
    );
});


// @desc    Verify OTP and Complete Signup
// @route   POST /api/auth/signup/verify-otp
// @access  Public
/**
 * ✅ UPDATED: Verify Signup OTP and Give ₹500 Bonus
 */
/**
 * ✅ FIXED: Verify Signup OTP and Give ₹500 Bonus
 */
/**
 * ✅ FIXED: Verify Signup OTP and Give ₹500 Bonus
 */
export const verifySignupOTP = asyncHandler(async (req, res) => {
    const { fullName, phoneNumber, otp } = req.body;

    if (!fullName || !phoneNumber || !otp) {
        throw new ApiError(400, 'All fields are required');
    }

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

    // ✅ FIXED: Start session with transaction options
    const session = await mongoose.startSession();
    session.startTransaction({
        readPreference: 'primary',
        readConcern: { level: 'majority' },
        writeConcern: { w: 'majority' }
    });

    try {
        otpRecord.isUsed = true;
        await otpRecord.save({ session });

        const SIGNUP_BONUS = 500;

        const user = await User.create([{
            fullName: fullName.trim(),
            phoneNumber,
            isVerified: true,
            walletBalance: 0,
            bonusBalance: SIGNUP_BONUS,
            signupBonusReceived: true,
            lastLogin: new Date()
        }], { session });

        await Transaction.create([{
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
        }], { session });

        await session.commitTransaction();

        const token = generateToken({ userId: user[0]._id });
        const totalWalletBalance = user[0].walletBalance + user[0].bonusBalance;

        res.status(201).json(
            new ApiResponse(201, {
                user: {
                    id: user[0]._id,
                    fullName: user[0].fullName,
                    phoneNumber: user[0].phoneNumber,
                    walletBalance: totalWalletBalance,
                    kycStatus: user[0].kycStatus,
                    isVerified: user[0].isVerified
                },
                token,
                message: `🎉 Welcome! You've received ₹${SIGNUP_BONUS} signup bonus!`
            }, 'Account created successfully')
        );

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
});



/**
 * Resend Login OTP
 */
export const resendLoginOTP = asyncHandler(async (req, res) => {
    const { phoneNumber } = req.body;

    // Validate input
    if (!phoneNumber) {
        throw new ApiError(400, 'Phone number is required');
    }

    if (!/^[6-9]\d{9}$/.test(phoneNumber)) {
        throw new ApiError(400, 'Invalid Indian phone number');
    }

    // Check if user exists
    const user = await User.findOne({ phoneNumber });
    if (!user) {
        throw new ApiError(404, 'User not found. Please signup first.');
    }

    // Delete old OTPs for this number and purpose
    await OTP.deleteMany({ phoneNumber, purpose: 'login' });

    // Generate new OTP
    const otp = generateOTP();

    // ✅ FIX: Explicitly set expiresAt
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

    // Save to database with expiresAt
    await OTP.create({
        phoneNumber,
        otp,
        purpose: 'login',
        expiresAt: expiresAt  // ✅ Add this explicitly
    });

    // Send SMS
    await sendOTP(phoneNumber, otp, 'login');

    res.status(200).json(
        new ApiResponse(200, {
            phoneNumber,
            message: 'OTP has been resent successfully. Please verify to login.'
        }, 'Success')
    );
});



/**
 * Resend Signup OTP
 */
export const resendSignupOTP = asyncHandler(async (req, res) => {
    const { fullName, phoneNumber } = req.body;

    // Validate inputs
    if (!fullName || !phoneNumber) {
        throw new ApiError(400, 'Full name and phone number are required');
    }

    if (!/^[6-9]\d{9}$/.test(phoneNumber)) {
        throw new ApiError(400, 'Invalid Indian phone number');
    }

    // Check if user already exists
    const existingUser = await User.findOne({ phoneNumber });
    if (existingUser) {
        throw new ApiError(409, 'Phone number already registered. Please login instead.');
    }

    // Delete old OTPs for this number and purpose
    await OTP.deleteMany({ phoneNumber, purpose: 'signup' });

    // Generate new OTP
    const otp = generateOTP();

    // ✅ FIX: Explicitly set expiresAt
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

    // Save to database with expiresAt
    await OTP.create({
        phoneNumber,
        otp,
        purpose: 'signup',
        expiresAt: expiresAt  // ✅ Add this explicitly
    });

    // Send SMS
    await sendOTP(phoneNumber, otp, 'signup');

    res.status(200).json(
        new ApiResponse(200, {
            phoneNumber,
            fullName,
            message: 'OTP has been resent successfully. Please verify to complete registration.'
        }, 'Success')
    );
});






