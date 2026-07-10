import { ApiError } from '../../shared/utils/apiError.js';

export const sanitizePhoneNumber = (phoneNumber) => {
    return String(phoneNumber || '').replace(/\D/g, '').replace(/^91/, '').slice(0, 10);
};

export const sanitizeEmail = (email) => {
    return String(email || '').trim().toLowerCase();
};

export const sanitizeOTP = (otp) => {
    return String(otp || '').replace(/\D/g, '').slice(0, 6);
};

export const validatePhoneNumber = (phoneNumber) => {
    const cleaned = sanitizePhoneNumber(phoneNumber);
    if (!cleaned) {
        throw new ApiError(400, 'Phone number is required');
    }
    if (!/^[6-9]\d{9}$/.test(cleaned)) {
        throw new ApiError(400, 'Invalid Indian phone number');
    }
    return cleaned;
};

export const validateEmail = (email) => {
    const cleaned = sanitizeEmail(email);
    if (!cleaned) {
        throw new ApiError(400, 'Email is required');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
        throw new ApiError(400, 'Invalid email address');
    }
    return cleaned;
};

export const validateSignupPayload = ({ fullName, phoneNumber, email, otpRequired = false, otp }) => {
    if (!fullName || !phoneNumber || !email) {
        throw new ApiError(400, 'Full name, phone number and email are required');
    }

    if (String(fullName).trim().length < 3) {
        throw new ApiError(400, 'Full name must be at least 3 characters');
    }

    validatePhoneNumber(phoneNumber);
    validateEmail(email);

    if (otpRequired) {
        const cleanOtp = sanitizeOTP(otp);
        if (!cleanOtp) {
            throw new ApiError(400, 'OTP is required');
        }
        if (!/^\d{6}$/.test(cleanOtp)) {
            throw new ApiError(400, 'OTP must be 6 digits');
        }
    }
};

export const validateLoginPayload = ({ email, otpRequired = false, otp }) => {
    validateEmail(email);

    if (otpRequired) {
        const cleanOtp = sanitizeOTP(otp);
        if (!cleanOtp) {
            throw new ApiError(400, 'Email and OTP are required');
        }
        if (!/^\d{6}$/.test(cleanOtp)) {
            throw new ApiError(400, 'OTP must be 6 digits');
        }
    }
};