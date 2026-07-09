import axios from 'axios';
import config from '../config/config.js';

const { apiKey: API_KEY, templates } = config.twoFactor;
const BASE_URL = 'https://2factor.in/API/V1';

export const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

export const sendOTP = async (phoneNumber, otp, purpose) => {
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

        const cleanNumber = String(phoneNumber).replace(/^\+?91/, '').trim();
        const indianNumber = `91${cleanNumber}`;
        const template = templates[purpose] || 'TradeHubOTP';
        const url = `${BASE_URL}/${API_KEY}/SMS/${indianNumber}/${otp}/${template}`;

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

        throw new Error(apiErrorDetail || 'Failed to send OTP. Please try again.');
    }
};