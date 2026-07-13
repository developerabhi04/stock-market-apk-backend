import mongoose from 'mongoose';

const bankAccountSchema = new mongoose.Schema(
    {
        bankName: { type: String, required: true, trim: true },
        accountHolderName: { type: String, required: true, trim: true },
        accountNumber: { type: String, required: true, trim: true },
        ifscCode: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
            match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format']
        },
        accountType: { type: String, enum: ['Savings', 'Current'], default: 'Savings' },
        isPrimary: { type: Boolean, default: false },
        isVerified: { type: Boolean, default: false },
        verifiedAt: { type: Date },
        addedAt: { type: Date, default: Date.now }
    },
    { _id: true }
);

const userSchema = new mongoose.Schema(
    {
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
        countryCode: { type: String, default: '+91' },
        isVerified: { type: Boolean, default: false },
        isActive: { type: Boolean, default: true },

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
        bankAccounts: [bankAccountSchema],
        walletBalance: { type: Number, default: 0, min: 0 },
        lastLogin: Date,
        deviceInfo: {
            deviceId: String,
            platform: String,
            appVersion: String
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

userSchema.index({ isVerified: 1, isActive: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ 'bankAccounts.accountNumber': 1 });

userSchema.pre('save', function (next) {
    if (this.bankAccounts && this.bankAccounts.length > 3) {
        return next(new Error('Maximum 3 bank accounts allowed'));
    }
    next();
});

userSchema.methods.canTrade = function () {
    return this.isVerified && this.walletBalance >= 10;
};

userSchema.methods.deductAmount = function (amount) {
    if (this.walletBalance < amount) {
        throw new Error('Insufficient balance');
    }

    this.walletBalance -= amount;

    return {
        walletUsed: amount,
        newWalletBalance: this.walletBalance
    };
};

userSchema.methods.getPrimaryBankAccount = function () {
    return this.bankAccounts.find((account) => account.isPrimary) || this.bankAccounts[0];
};

userSchema.methods.getMaskedBankAccounts = function () {
    return this.bankAccounts.map((account) => ({
        ...account.toObject(),
        maskedAccountNumber:
            account.accountNumber?.length > 4
                ? `****${account.accountNumber.slice(-4)}`
                : account.accountNumber
    }));
};

userSchema.statics.findByPhone = function (phoneNumber) {
    return this.findOne({ phoneNumber, isActive: true });
};

const User = mongoose.model('User', userSchema);

export default User;