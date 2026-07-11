import axios from 'axios';
import config from '../config/config.js';

const { apiKey: API_KEY, templates } = config.twoFactor;
const BASE_URL = 'https://2factor.in/API/V1';

export const generateOTP = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
};

const sanitizePhoneNumber = (phoneNumber) => {
    const cleaned = String(phoneNumber || '')
        .replace(/\D/g, '')
        .replace(/^91/, '')
        .slice(0, 10);

    if (!/^[6-9]\d{9}$/.test(cleaned)) {
        throw new Error('Invalid Indian mobile number');
    }

    return cleaned;
};

export const sendOTP = async (phoneNumber, otp, purpose = 'login') => {
    try {
        if (config.app.isDev) {
            console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`📱 SMS OTP for ${phoneNumber}: ${otp}`);
            console.log(`Purpose: ${purpose}`);
            console.log(`Provider: 2Factor.in (India)`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        }

        if (!config.twoFactor.enabled) {
            console.warn('⚠️ 2Factor not configured - using dev mode');
            return { success: true, message: 'Dev mode - Check console for OTP' };
        }

        const cleanNumber = sanitizePhoneNumber(phoneNumber);
        const indianNumber = `91${cleanNumber}`;
        const template = templates[purpose] || 'TradeHubOTP';
        const url = `${BASE_URL}/${API_KEY}/SMS/${indianNumber}/${otp}/${template}`;

        console.log('📤 2Factor URL:', url.replace(API_KEY, 'API_KEY_HIDDEN'));

        const response = await axios.get(url, { timeout: 10000 });

        console.log('✅ 2Factor raw response:', response.data);

        if (response.data.Status !== 'Success') {
            throw new Error(response.data.Details || 'Failed to send OTP via 2Factor');
        }

        return {
            success: true,
            messageId: response.data.Details,
            status: response.data.Status,
            providerResponse: response.data,
            message: 'OTP sent successfully'
        };
    } catch (error) {
        const apiErrorDetail = error.response?.data?.Details;
        console.error('❌ 2Factor Error:', error.response?.data || error.message);

        if (config.app.isDev) {
            console.log('⚠️ SMS failed but continuing in dev mode');
            console.log(`💡 Use OTP from console: ${otp}`);
            return {
                success: true,
                message: 'Dev mode - Use console OTP'
            };
        }

        throw new Error(apiErrorDetail || error.message || 'Failed to send OTP. Please try again.');
    }
};

export const resendOTP = async (phoneNumber, otp, purpose = 'login') => {
    return await sendOTP(phoneNumber, otp, purpose);
};