import { ApiResponse } from '../../shared/utils/apiResponse.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import {
    validateLoginPayload,
    validateSignupPayload
} from './auth.validator.js';
import {
    resendLoginOtpService,
    resendSignupOtpService,
    sendLoginOtpService,
    sendSignupOtpService,
    verifyLoginOtpService,
    verifySignupOtpService
} from './auth.service.js';





export const sendSignupOTP = asyncHandler(async (req, res) => {
    validateSignupPayload(req.body);
    const data = await sendSignupOtpService(req.body);
    res.status(200).json(new ApiResponse(200, data, 'Success'));
});

export const sendLoginOTP = asyncHandler(async (req, res) => {
    validateLoginPayload(req.body);
    const data = await sendLoginOtpService(req.body);
    res.status(200).json(new ApiResponse(200, data, 'Success'));
});

export const verifyLoginOTP = asyncHandler(async (req, res) => {
    validateLoginPayload({ ...req.body, otpRequired: true });
    const data = await verifyLoginOtpService(req.body);
    res.status(200).json(new ApiResponse(200, data, 'Login successful'));
});

export const verifySignupOTP = asyncHandler(async (req, res) => {
    validateSignupPayload({ ...req.body, otpRequired: true });
    const data = await verifySignupOtpService(req.body);
    res.status(201).json(new ApiResponse(201, data, 'Account created successfully'));
});

export const resendLoginOTP = asyncHandler(async (req, res) => {
    validateLoginPayload(req.body);
    const data = await resendLoginOtpService(req.body);
    res.status(200).json(new ApiResponse(200, data, 'Success'));
});

export const resendSignupOTP = asyncHandler(async (req, res) => {
    validateSignupPayload(req.body);
    const data = await resendSignupOtpService(req.body);
    res.status(200).json(new ApiResponse(200, data, 'Success'));
});