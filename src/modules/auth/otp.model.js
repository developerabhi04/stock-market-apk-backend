import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema(
    {
        phoneNumber: {
            type: String,
            index: true
            // kept for reference/logging only, no longer required for OTP delivery
        },
        otp: {
            type: String,
            required: true
        },
        purpose: {
            type: String,
            enum: ['signup', 'login', 'forgot_password', 'wallet_withdrawal'],
            required: true,
            index: true
        },
        expiresAt: {
            type: Date,
            required: true,
            index: true
        },
        isUsed: {
            type: Boolean,
            default: false
        },
        attempts: {
            type: Number,
            default: 0
        }
    },
    { timestamps: true }
);

otpSchema.index({ email: 1, purpose: 1, createdAt: -1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

otpSchema.methods.isValid = function () {
    return !this.isUsed && this.expiresAt > new Date();
};

const OTP = mongoose.model('OTP', otpSchema);
export default OTP;