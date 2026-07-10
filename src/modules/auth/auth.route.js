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


router.post('/login/send-otp', rateLimiter(10, 30), sendLoginOTP);
router.post('/login/verify-otp', rateLimiter(10, 30), verifyLoginOTP);
router.post('/login/resend-otp', rateLimiter(6, 20), resendLoginOTP);

router.post('/signup/send-otp', rateLimiter(6, 30), sendSignupOTP);
router.post('/signup/verify-otp', rateLimiter(10, 30), verifySignupOTP);
router.post('/signup/resend-otp', rateLimiter(6, 20), resendSignupOTP);

export default router;