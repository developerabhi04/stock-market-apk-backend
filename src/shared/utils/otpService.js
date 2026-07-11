import nodemailer from 'nodemailer';
import config from '../config/config.js';

const { user: EMAIL_USER, appPassword: EMAIL_PASS, fromName } = config.email;

let transporter = null;

if (config.email.enabled) {
    transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            user: EMAIL_USER,
            pass: EMAIL_PASS
        },
        pool: false,
        maxConnections: 1,
        maxMessages: 10,
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 30000,
        tls: {
            rejectUnauthorized: true,
            servername: 'smtp.gmail.com'
        }
    });

    transporter.verify((error) => {
        if (error) {
            console.error('❌ Email transporter verification failed:', error.message);
        } else {
            console.log('✅ Email transporter is ready to send messages');
        }
    });
}

export const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const sanitizeEmail = (email) => {
    const cleaned = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
        throw new Error('Invalid email address');
    }
    return cleaned;
};

const purposeSubject = {
    login: 'Your TradeHub Login OTP',
    signup: 'Verify Your Email - TradeHub Signup',
    forgot_password: 'Reset Your TradeHub Password',
    wallet_withdrawal: 'Confirm Your Withdrawal Request'
};

export const sendOTP = async (email, otp, purpose = 'login') => {
    try {
        const cleanEmail = sanitizeEmail(email);

        if (config.app.isDev) {
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`📧 Email OTP for ${cleanEmail}: ${otp}`);
            console.log(`Purpose: ${purpose}`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        }

        if (!config.email.enabled) {
            console.warn('⚠️ Email not configured - using dev mode');
            return { success: true, message: 'Dev mode - Check console for OTP' };
        }

        const subject = purposeSubject[purpose] || 'Your TradeHub OTP';

        const mailOptions = {
            from: `"${fromName}" <${EMAIL_USER}>`,
            to: cleanEmail,
            subject,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 24px; max-width: 480px; margin: auto; border: 1px solid #eee; border-radius: 8px;">
                    <h2 style="color: #1a1a1a;">${subject}</h2>
                    <p style="color: #444;">Use the OTP below to continue. This code is valid for 5 minutes.</p>
                    <h1 style="letter-spacing: 6px; color: #0b6efd; text-align: center;">${otp}</h1>
                    <p style="font-size: 12px; color: #888;">If you did not request this, please ignore this email.</p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);

        console.log('✅ Email OTP sent:', info.messageId);

        return {
            success: true,
            messageId: info.messageId,
            message: 'OTP sent successfully to your email'
        };
    } catch (error) {
        console.error('❌ Email OTP Error:', error.message);

        if (config.app.isDev) {
            console.log('⚠️ Email failed but continuing in dev mode');
            console.log(`💡 Use OTP from console: ${otp}`);
            return { success: true, message: 'Dev mode - Use console OTP' };
        }

        throw new Error(error.message || 'Failed to send OTP email. Please try again.');
    }
};

export const resendOTP = async (email, otp, purpose = 'login') => {
    return await sendOTP(email, otp, purpose);
};