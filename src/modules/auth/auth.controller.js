import { ApiResponse } from '../../shared/utils/apiResponse.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { validateLoginPayload, validateSignupPayload } from './auth.validator.js';
import { loginWithFirebaseService, signupWithFirebaseService } from './auth.service.js';

export const signupWithFirebase = asyncHandler(async (req, res) => {
    validateSignupPayload(req.body);
    const data = await signupWithFirebaseService(req.body);
    res.status(201).json(new ApiResponse(201, data, 'Account created successfully'));
});

export const loginWithFirebase = asyncHandler(async (req, res) => {
    validateLoginPayload(req.body);
    const data = await loginWithFirebaseService(req.body);
    res.status(200).json(new ApiResponse(200, data, 'Login successful'));
});