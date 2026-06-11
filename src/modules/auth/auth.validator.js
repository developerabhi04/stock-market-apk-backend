import { ApiError } from '../../shared/utils/apiError.js';

export const validatePhoneNumber = (phoneNumber) => {
    if (!phoneNumber) {
        throw new ApiError(400, 'Phone number is required');
    }

    if (!/^[6-9]\d{9}$/.test(phoneNumber)) {
        throw new ApiError(400, 'Invalid Indian phone number');
    }
};

export const validateSignupPayload = ({ fullName, phoneNumber, otpRequired = false, otp }) => {
    if (!fullName || !phoneNumber) {
        throw new ApiError(400, 'Full name and phone number are required');
    }

    if (String(fullName).trim().length < 3) {
        throw new ApiError(400, 'Full name must be at least 3 characters');
    }

    validatePhoneNumber(phoneNumber);

    if (otpRequired && !otp) {
        throw new ApiError(400, 'OTP is required');
    }
};

export const validateLoginPayload = ({ phoneNumber, otpRequired = false, otp }) => {
    validatePhoneNumber(phoneNumber);

    if (otpRequired && !otp) {
        throw new ApiError(400, 'Phone number and OTP are required');
    }
};

