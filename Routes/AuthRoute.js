import express from 'express';
import { rateLimiter } from '../Middleware/RateLimiter.js';
import { getUserProfile, resendLoginOTP, resendSignupOTP, sendLoginOTP, sendSignupOTP, updateUserProfile, verifyLoginOTP, verifySignupOTP } from '../Controllers/AuthController.js';
import { authenticate } from '../Middleware/Auth.js';

const router = express.Router();

// Login routes
router.post('/login/send-otp', rateLimiter(5, 15), sendLoginOTP);
router.post('/login/verify-otp', rateLimiter(5, 15), verifyLoginOTP);
router.post('/login/resend-otp', rateLimiter(3, 10), resendLoginOTP);

// Signup routes
router.post('/signup/send-otp', rateLimiter(3, 15), sendSignupOTP);
router.post('/signup/verify-otp', rateLimiter(5, 15), verifySignupOTP);
router.post('/signup/resend-otp', rateLimiter(3, 10), resendSignupOTP);

router.use(authenticate);

// Profile routes
router.get('/profile', getUserProfile);
router.put('/profile', updateUserProfile);


export default router;
