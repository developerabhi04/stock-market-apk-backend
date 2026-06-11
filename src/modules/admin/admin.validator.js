import { ApiError } from '../../shared/utils/apiError.js';

const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,})+$/;

export const validateAdminLogin = ({ username, password }) => {
    if (!username || !password) {
        throw new ApiError(400, 'Username and password are required');
    }
};

export const validateCreateAdmin = ({ username, email, password, fullName, allowedRoutes }) => {
    if (!username || !email || !password || !fullName) {
        throw new ApiError(400, 'Username, email, password, and full name are required');
    }

    if (String(username).trim().length < 3) {
        throw new ApiError(400, 'Username must be at least 3 characters');
    }

    if (String(password).length < 6) {
        throw new ApiError(400, 'Password must be at least 6 characters');
    }

    if (!emailRegex.test(String(email).toLowerCase())) {
        throw new ApiError(400, 'Please enter a valid email');
    }

    if (!Array.isArray(allowedRoutes) || allowedRoutes.length === 0) {
        throw new ApiError(400, 'Please select at least one navigation item');
    }
};

export const validateCreateFirstAdmin = ({ username, email, password, fullName }) => {
    if (!username || !email || !password || !fullName) {
        throw new ApiError(400, 'All fields are required');
    }

    if (!emailRegex.test(String(email).toLowerCase())) {
        throw new ApiError(400, 'Please enter a valid email');
    }
};

export const validateBalanceUpdate = ({ userId, amount, type, reason }) => {
    if (!userId || !amount || !type || !reason) {
        throw new ApiError(400, 'All fields are required');
    }

    if (Number(amount) <= 0) {
        throw new ApiError(400, 'Amount must be greater than 0');
    }

    if (!['add', 'deduct'].includes(type)) {
        throw new ApiError(400, 'Type must be add or deduct');
    }
};