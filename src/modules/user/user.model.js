import mongoose from 'mongoose';

const bankAccountSchema = new mongoose.Schema(
    {
        bankName: {
            type: String,
            required: true,
            trim: true,
        },

        accountHolderName: {
            type: String,
            required: true,
            trim: true,
        },

        accountNumber: {
            type: String,
            required: true,
            trim: true,
        },

        ifscCode: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
            match: [
                /^[A-Z]{4}0[A-Z0-9]{6}$/,
                'Invalid IFSC code format',
            ],
        },

        accountType: {
            type: String,
            enum: ['Savings', 'Current'],
            default: 'Savings',
        },

        isPrimary: {
            type: Boolean,
            default: false,
        },

        isVerified: {
            type: Boolean,
            default: false,
        },

        verifiedAt: {
            type: Date,
            default: null,
        },

        addedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        _id: true,
    }
);

const userSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: [true, 'Full name is required'],
            trim: true,
            minlength: [3, 'Name must be at least 3 characters'],
            maxlength: [100, 'Name cannot exceed 100 characters'],
        },

        phoneNumber: {
            type: String,
            required: [true, 'Phone number is required'],
            unique: true,
            trim: true,
            match: [
                /^[0-9]{10}$/,
                'Please enter a valid 10-digit phone number',
            ],
        },

        countryCode: {
            type: String,
            default: '+91',
            trim: true,
        },

        isVerified: {
            type: Boolean,
            default: false,
        },

        isActive: {
            type: Boolean,
            default: true,
        },

        kycStatus: {
            type: String,
            enum: [
                'pending',
                'submitted',
                'verified',
                'rejected',
            ],
            default: 'pending',
        },

        fcmToken: {
            type: String,
            default: null,
        },

        panCard: {
            number: String,
            documentUrl: String,
            verifiedAt: Date,
        },

        bankDetails: {
            accountNumber: String,
            ifscCode: String,
            accountHolderName: String,
            bankName: String,
            verifiedAt: Date,
        },

        bankAccounts: {
            type: [bankAccountSchema],
            default: [],
        },

        walletBalance: {
            type: Number,
            default: 0,
            min: 0,
        },

        /*
         * Every user receives a referral code.
         * It is generated in the pre-validate hook below.
         */
        referralCode: {
            type: String,
            unique: true,
            sparse: true,
            uppercase: true,
            trim: true,
        },

        /*
         * User who invited this user.
         */
        referredBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        /*
         * Prevents the referral reward from being paid twice.
         */
        referralRewardGiven: {
            type: Boolean,
            default: false,
        },

        lastLogin: {
            type: Date,
            default: null,
        },

        deviceInfo: {
            deviceId: String,
            platform: String,
            appVersion: String,
        },
    },
    {
        timestamps: true,

        toJSON: {
            virtuals: true,
        },

        toObject: {
            virtuals: true,
        },
    }
);

/*
 * Generate the referral code before the original user document
 * is saved. This works correctly inside signup transactions.
 *
 * Example:
 * TH65A1B2C3
 */
userSchema.pre('validate', function (next) {
    if (!this.referralCode && this._id) {
        this.referralCode = `TH${this._id
            .toString()
            .slice(-8)
            .toUpperCase()}`;
    }

    next();
});

/*
 * Validate the maximum number of bank accounts.
 */
userSchema.pre('save', function (next) {
    if (this.bankAccounts && this.bankAccounts.length > 3) {
        return next(
            new Error('Maximum 3 bank accounts allowed')
        );
    }

    next();
});

/*
 * Indexes.
 *
 * referralCode already creates a unique sparse index because
 * unique: true and sparse: true are set on the field.
 */
userSchema.index({
    isVerified: 1,
    isActive: 1,
});

userSchema.index({
    createdAt: -1,
});

userSchema.index({
    'bankAccounts.accountNumber': 1,
});

userSchema.index({
    referredBy: 1,
});

/*
 * User methods.
 */
userSchema.methods.canTrade = function () {
    return (
        this.isVerified &&
        Number(this.walletBalance || 0) >= 10
    );
};

userSchema.methods.deductAmount = function (amount) {
    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
        throw new Error('Invalid amount');
    }

    if (this.walletBalance < numericAmount) {
        throw new Error('Insufficient balance');
    }

    this.walletBalance -= numericAmount;

    return {
        walletUsed: numericAmount,
        newWalletBalance: this.walletBalance,
    };
};

userSchema.methods.getPrimaryBankAccount = function () {
    return (
        this.bankAccounts.find(
            (account) => account.isPrimary
        ) || this.bankAccounts[0]
    );
};

userSchema.methods.getMaskedBankAccounts = function () {
    return this.bankAccounts.map((account) => {
        const accountObject = account.toObject();

        return {
            ...accountObject,

            maskedAccountNumber:
                account.accountNumber?.length > 4
                    ? `****${account.accountNumber.slice(-4)}`
                    : account.accountNumber,
        };
    });
};

/*
 * Static helper.
 */
userSchema.statics.findByPhone = function (phoneNumber) {
    return this.findOne({
        phoneNumber,
        isActive: true,
    });
};

const User = mongoose.model('User', userSchema);

export default User;