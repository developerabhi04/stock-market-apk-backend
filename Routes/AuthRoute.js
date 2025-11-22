import express from 'express';

import { rateLimiter } from '../Middleware/RateLimiter.js';
import { resendLoginOTP, resendSignupOTP, sendLoginOTP, sendSignupOTP, verifyLoginOTP, verifySignupOTP } from '../Controllers/AuthController.js';

const router = express.Router();

// Login routes
router.post('/login/send-otp', rateLimiter(5, 15), sendLoginOTP);
router.post('/login/verify-otp', rateLimiter(5, 15), verifyLoginOTP);
router.post('/login/resend-otp', rateLimiter(3, 10), resendLoginOTP);

// Signup routes
router.post('/signup/send-otp', rateLimiter(3, 15), sendSignupOTP);
router.post('/signup/verify-otp', rateLimiter(5, 15), verifySignupOTP);
router.post('/signup/resend-otp', rateLimiter(3, 10), resendSignupOTP);


export default router;
