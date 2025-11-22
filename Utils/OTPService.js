import twilio from 'twilio';

/**
 * Generate 6-digit OTP
 */
export const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send OTP via Twilio (India Only - Signup/Login)
 * No Company/GST Required
 */
export const sendOTP = async (phoneNumber, otp, purpose) => {
    try {
        // Dev mode logging
        if (process.env.NODE_ENV === 'development') {
            console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`📱 SMS OTP for ${phoneNumber}: ${otp}`);
            console.log(`Purpose: ${purpose}`);
            console.log(`Provider: Twilio (India)`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        }

        // Check Twilio configuration
        if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
            console.warn('⚠️ Twilio not configured - using dev mode');
            return { success: true, message: 'Dev mode - Check console for OTP' };
        }

        console.log('🔄 Sending SMS via Twilio (India)...');

        // Clean number and format for India
        const cleanNumber = phoneNumber.replace(/^\+?91/, '').trim();
        const indianNumber = `+91${cleanNumber}`;

        console.log(`📞 Formatted Number: ${indianNumber}`);

        // Initialize Twilio client
        const client = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
        );

        // Message content based on purpose
        const messages = {
            signup: `Welcome to TradeHub! Your OTP for registration is ${otp}. Valid for 5 minutes. Do not share this code.`,
            login: `Your TradeHub login OTP is ${otp}. Valid for 5 minutes. Keep it confidential.`,
            forgot_password: `Your password reset OTP is ${otp}. Valid for 5 minutes.`,
            wallet_withdrawal: `Your withdrawal verification OTP is ${otp}. Valid for 5 minutes.`
        };

        const messageBody = messages[purpose] || `Your TradeHub OTP is ${otp}. Valid for 5 minutes. Do not share.`;

        // Send SMS via Twilio
        const response = await client.messages.create({
            body: messageBody,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: indianNumber
        });

        console.log('📡 Twilio Response:');
        console.log(`   Message SID: ${response.sid}`);
        console.log(`   Status: ${response.status}`);
        console.log(`   To: ${response.to}`);
        console.log('✅ SMS sent successfully via Twilio!');

        return {
            success: true,
            messageId: response.sid,
            status: response.status,
            message: 'OTP sent successfully'
        };

    } catch (error) {
        console.error('❌ Twilio Error:', error.message);

        // In development, don't fail - just log
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

/**
 * Verify OTP (Your existing database verification logic)
 * Note: Twilio doesn't have built-in OTP verification API
 * You verify against your database (existing logic in controller)
 */
export const verifyOTPWithTwilio = async (phoneNumber, otp) => {
    // Note: This function is not needed with Twilio
    // Your existing verification logic in the controller handles this
    // by checking OTP against your MongoDB OTP collection
    console.log('ℹ️ OTP verification handled by database (existing logic)');
    return true;
};

/**
 * Resend OTP via Twilio
 */
export const resendOTP = async (phoneNumber, otp, purpose = 'login') => {
    try {
        // Simply call sendOTP again with the same or new OTP
        return await sendOTP(phoneNumber, otp, purpose);
    } catch (error) {
        console.error('❌ Resend Error:', error.message);
        throw new Error('Failed to resend OTP');
    }
};
