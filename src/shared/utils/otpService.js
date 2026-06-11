import twilio from 'twilio';

export const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

export const sendOTP = async (phoneNumber, otp, purpose) => {
    try {
        if (process.env.NODE_ENV === 'development') {
            console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`📱 SMS OTP for ${phoneNumber}: ${otp}`);
            console.log(`Purpose: ${purpose}`);
            console.log(`Provider: Twilio (India)`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        }

        if (
            !process.env.TWILIO_ACCOUNT_SID ||
            !process.env.TWILIO_AUTH_TOKEN ||
            !process.env.TWILIO_PHONE_NUMBER
        ) {
            console.warn('⚠️ Twilio not configured - using dev mode');
            return { success: true, message: 'Dev mode - Check console for OTP' };
        }

        const cleanNumber = phoneNumber.replace(/^\+?91/, '').trim();
        const indianNumber = `+91${cleanNumber}`;

        const client = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
        );

        const messages = {
            signup: `Welcome to TradeHub! Your OTP for registration is ${otp}. Valid for 5 minutes. Do not share this code.`,
            login: `Your TradeHub login OTP is ${otp}. Valid for 5 minutes. Keep it confidential.`,
            forgot_password: `Your password reset OTP is ${otp}. Valid for 5 minutes.`,
            wallet_withdrawal: `Your withdrawal verification OTP is ${otp}. Valid for 5 minutes.`
        };

        const messageBody =
            messages[purpose] ||
            `Your TradeHub OTP is ${otp}. Valid for 5 minutes. Do not share.`;

        const response = await client.messages.create({
            body: messageBody,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: indianNumber
        });

        return {
            success: true,
            messageId: response.sid,
            status: response.status,
            message: 'OTP sent successfully'
        };
    } catch (error) {
        console.error('❌ Twilio Error:', error.message);

        if (process.env.NODE_ENV === 'development') {
            console.log('⚠️ SMS failed but continuing in dev mode');
            console.log(`💡 Use OTP from console: ${otp}`);
            return {
                success: true,
                message: 'Dev mode - Use console OTP'
            };
        }

        throw new Error('Failed to send OTP. Please try again.');
    }
};

export const resendOTP = async (phoneNumber, otp, purpose = 'login') => {
    return await sendOTP(phoneNumber, otp, purpose);
};