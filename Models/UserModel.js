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
    // ✅ DEPRECATED: Keep for backward compatibility
    bankDetails: {
        accountNumber: String,
        ifscCode: String,
        accountHolderName: String,
        bankName: String,
        verifiedAt: Date
    },
    // ✅ NEW: Multiple bank accounts (max 3)
    bankAccounts: [{
        bankName: {
            type: String,
            required: true,
            trim: true
        },
        accountHolderName: {
            type: String,
            required: true,
            trim: true
        },
        accountNumber: {
            type: String,
            required: true,
            trim: true
        },
        ifscCode: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
            match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format']
        },
        accountType: {
            type: String,
            enum: ['Savings', 'Current'],
            default: 'Savings'
        },
        isPrimary: {
            type: Boolean,
            default: false
        },
        isVerified: {
            type: Boolean,
            default: false
        },
        verifiedAt: {
            type: Date
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],
    // Wallet balances
    walletBalance: {
        type: Number,
        default: 0,
        min: 0
    },
    bonusBalance: {
        type: Number,
        default: 0,
        min: 0
    },
    signupBonusReceived: {
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
userSchema.index({ 'bankAccounts.accountNumber': 1 });

// ✅ Validation: Max 3 bank accounts
userSchema.pre('save', function(next) {
    if (this.bankAccounts && this.bankAccounts.length > 3) {
        next(new Error('Maximum 3 bank accounts allowed'));
    }
    next();
});

// Virtual for total available balance
userSchema.virtual('totalBalance').get(function() {
    return this.walletBalance + this.bonusBalance;
});

// Virtual for withdrawable balance (only main wallet)
userSchema.virtual('withdrawableBalance').get(function() {
    return this.walletBalance;
});

// Method to check if user can trade
userSchema.methods.canTrade = function() {
    return this.isVerified && this.totalBalance >= 10;
};

// Method to deduct money (uses bonus first, then main wallet)
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

// ✅ Method to get primary bank account
userSchema.methods.getPrimaryBankAccount = function() {
    return this.bankAccounts.find(account => account.isPrimary) || this.bankAccounts[0];
};

// Static method to find user by phone
userSchema.statics.findByPhone = function(phoneNumber) {
    return this.findOne({ phoneNumber, isActive: true });
};

const User = mongoose.model('User', userSchema);

export default User;
