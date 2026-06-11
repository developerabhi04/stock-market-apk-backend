import express from 'express';
import { rateLimiter } from '../../shared/middleware/rateLimiter.middleware.js';
import {
    resendLoginOTP,
    resendSignupOTP,
    sendLoginOTP,
    sendSignupOTP,
    verifyLoginOTP,
    verifySignupOTP
} from './auth.controller.js';

const router = express.Router();

router.post('/login/send-otp', rateLimiter(5, 15), sendLoginOTP);
router.post('/login/verify-otp', rateLimiter(5, 15), verifyLoginOTP);
router.post('/login/resend-otp', rateLimiter(3, 10), resendLoginOTP);

router.post('/signup/send-otp', rateLimiter(3, 15), sendSignupOTP);
router.post('/signup/verify-otp', rateLimiter(5, 15), verifySignupOTP);
router.post('/signup/resend-otp', rateLimiter(3, 10), resendSignupOTP);

export default router;