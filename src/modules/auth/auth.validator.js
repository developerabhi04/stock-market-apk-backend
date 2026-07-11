import { ApiError } from '../../shared/utils/apiError.js';

export const sanitizePhoneNumber = (phoneNumber) => {
    return String(phoneNumber || '').replace(/\D/g, '').replace(/^91/, '').slice(0, 10);
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

export const validateSignupPayload = ({ fullName, idToken }) => {
    if (!fullName || String(fullName).trim().length < 3) {
        throw new ApiError(400, 'Full name must be at least 3 characters');
    }
    if (!idToken) {
        throw new ApiError(400, 'Firebase ID token is required');
    }
};

export const validateLoginPayload = ({ idToken }) => {
    if (!idToken) {
        throw new ApiError(400, 'Firebase ID token is required');
    }
};