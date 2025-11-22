import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: [true, 'Full name is required'],
        trim: true,
        minlength: [3, 'Name must be at least 3 characters'],
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    phoneNumber: {
        type: String,
        required: [true, 'Phone number is required'],
        unique: true,
        match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number']
    },
    countryCode: {
        type: String,
        default: '+91'
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    kycStatus: {
        type: String,
        enum: ['pending', 'submitted', 'verified', 'rejected'],
        default: 'pending'
    },
    panCard: {
        number: String,
        documentUrl: String,
        verifiedAt: Date
    },
    bankDetails: {
        accountNumber: String,
        ifscCode: String,
        accountHolderName: String,
        bankName: String,
        verifiedAt: Date
    },
    // ✅ NEW: Separate wallet balances
    walletBalance: {
        type: Number,
        default: 0,
        min: 0
    },
    bonusBalance: {  // ✅ NEW: Signup bonus (non-withdrawable)
        type: Number,
        default: 0,
        min: 0
    },
    signupBonusReceived: {  // ✅ NEW: Track if bonus already given
        type: Boolean,
        default: false
    },
    lastLogin: Date,
    deviceInfo: {
        deviceId: String,
        platform: String,
        appVersion: String
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
userSchema.index({ isVerified: 1, isActive: 1 });
userSchema.index({ createdAt: -1 });

// ✅ Virtual for total available balance
userSchema.virtual('totalBalance').get(function() {
    return this.walletBalance + this.bonusBalance;
});

// ✅ Virtual for withdrawable balance (only main wallet)
userSchema.virtual('withdrawableBalance').get(function() {
    return this.walletBalance;
});

// ✅ Method to check if user can trade
userSchema.methods.canTrade = function() {
    return this.isVerified && this.totalBalance >= 10; // Minimum ₹10 to trade
};

// ✅ Method to deduct money (uses bonus first, then main wallet)
userSchema.methods.deductAmount = function(amount) {
    if (this.totalBalance < amount) {
        throw new Error('Insufficient balance');
    }

    let remaining = amount;

    // Deduct from bonus first
    if (this.bonusBalance > 0) {
        const bonusUsed = Math.min(this.bonusBalance, remaining);
        this.bonusBalance -= bonusUsed;
        remaining -= bonusUsed;
    }

    // Then deduct from main wallet if needed
    if (remaining > 0) {
        this.walletBalance -= remaining;
    }

    return {
        bonusUsed: amount - remaining,
        walletUsed: remaining,
        newBonusBalance: this.bonusBalance,
        newWalletBalance: this.walletBalance
    };
};

// Static method to find user by phone
userSchema.statics.findByPhone = function(phoneNumber) {
    return this.findOne({ phoneNumber, isActive: true });
};

const User = mongoose.model('User', userSchema);

export default User;
