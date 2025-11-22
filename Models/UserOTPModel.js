import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: [true, 'Phone number is required'],
        match: [/^[6-9]\d{9}$/, 'Please provide valid Indian phone number']
    },
    otp: {
        type: String,
        required: [true, 'OTP is required'],
        minLength: 6,
        maxLength: 6
    },
    purpose: {
        type: String,
        enum: ['signup', 'login', 'forgot_password', 'wallet_withdrawal'],
        required: true
    },
    expiresAt: {
        type: Date,
        required: true,
        default: () => new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
    },
    isUsed: {  // ✅ Changed from isVerified to isUsed (matches controller)
        type: Boolean,
        default: false
    },
    attempts: {
        type: Number,
        default: 0,
        max: 5
    }
}, {
    timestamps: true
});

// Indexes for faster queries
otpSchema.index({ phoneNumber: 1, purpose: 1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 300 }); // Auto-delete after 5 mins

// ✅ Instance method to check if OTP is valid (not expired)
otpSchema.methods.isValid = function() {
    return this.expiresAt > new Date();
};

// ✅ Static method to verify OTP (updated to use isUsed)
otpSchema.statics.verifyOTP = async function(phoneNumber, otp, purpose) {
    const otpDoc = await this.findOne({
        phoneNumber,
        otp,
        purpose,
        isUsed: false,  // ✅ Changed from isVerified
        expiresAt: { $gt: new Date() }
    });

    if (!otpDoc) {
        return { success: false, message: 'Invalid or expired OTP' };
    }

    if (otpDoc.attempts >= 5) {
        return { success: false, message: 'Maximum attempts exceeded. Please request new OTP' };
    }

    // ✅ Mark as used
    otpDoc.isUsed = true;
    otpDoc.attempts += 1;
    await otpDoc.save();

    return { success: true, message: 'OTP verified successfully' };
};

const OTP = mongoose.model('OTP', otpSchema);
export default OTP;
