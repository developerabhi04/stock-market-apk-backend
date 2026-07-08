import mongoose from 'mongoose';

const INVESTMENT_STATUSES = ['pending', 'active', 'rejected', 'cancelled', 'completed'];

const investmentSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        indexId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Index',
            required: true,
            index: true,
        },
        categoryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Category',
            default: null,
            index: true,
        },

        orderNumber: {
            type: String,
            trim: true,
            unique: true,
            sparse: true,
            index: true,
        },

        amount: {
            type: Number,
            required: true,
            min: 0,
        },

        status: {
            type: String,
            enum: INVESTMENT_STATUSES,
            default: 'pending',
            index: true,
        },

        lockPeriodDays: {
            type: Number,
            default: 30,
            min: 1,
        },

        daysCompleted: {
            type: Number,
            default: 0,
            min: 0,
        },

        daysRemaining: {
            type: Number,
            default: 30,
            min: 0,
        },

        isLockCompleted: {
            type: Boolean,
            default: false,
            index: true,
        },

        orderPlacedAt: {
            type: Date,
            default: Date.now,
            index: true,
        },

        approvedAt: {
            type: Date,
            default: null,
        },

        rejectedAt: {
            type: Date,
            default: null,
        },

        cancelledAt: {
            type: Date,
            default: null,
        },

        completedAt: {
            type: Date,
            default: null,
        },

        principalReturnedAt: {
            type: Date,
            default: null,
        },

        lockEndsAt: {
            type: Date,
            default: null,
            index: true,
        },

        lastInterestCreditedAt: {
            type: Date,
            default: null,
        },

        totalInterestEarned: {
            type: Number,
            default: 0,
            min: 0,
        },

        currentValueSnapshot: {
            type: Number,
            default: 0,
            min: 0,
        },

        slabId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'InterestSlab',
            default: null,
        },

        slabDailyRate: {
            type: Number,
            default: null,
            min: 0,
        },

        customDailyRate: {
            type: Number,
            default: null,
            min: 0,
        },

        effectiveDailyRate: {
            type: Number,
            default: null,
            min: 0,
        },

        dailyInterestAmount: {
            type: Number,
            default: 0,
            min: 0,
        },

        adminRemark: {
            type: String,
            trim: true,
            default: '',
        },

        rejectionReason: {
            type: String,
            trim: true,
            default: '',
        },

        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
            default: null,
        },

        rejectedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
            default: null,
        },

        cancelledBy: {
            type: String,
            enum: ['user', 'admin', null],
            default: null,
        },

        indexSnapshot: {
            name: {
                type: String,
                trim: true,
                default: '',
            },
            symbol: {
                type: String,
                trim: true,
                default: '',
            },
            logoUrl: {
                type: String,
                trim: true,
                default: '',
            },
            currentValue: {
                type: Number,
                default: 0,
                min: 0,
            },
        },

        categorySnapshot: {
            name: {
                type: String,
                trim: true,
                default: '',
            },
            slug: {
                type: String,
                trim: true,
                default: '',
            },
            color: {
                type: String,
                trim: true,
                default: '',
            },
            icon: {
                type: String,
                trim: true,
                default: '',
            },
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

investmentSchema.index({ userId: 1, status: 1, createdAt: -1 });
investmentSchema.index({ status: 1, orderPlacedAt: -1 });
investmentSchema.index({ status: 1, isLockCompleted: 1, lockEndsAt: 1 });
investmentSchema.index({ userId: 1, isLockCompleted: 1, status: 1 });
investmentSchema.index({ indexId: 1, status: 1 });
investmentSchema.index({ approvedAt: 1, status: 1 });

investmentSchema.virtual('progressPercent').get(function () {
    const totalDays = Number(this.lockPeriodDays || 30);
    const completedDays = Number(this.daysCompleted || 0);

    if (totalDays <= 0) return 0;

    return Math.min(Number(((completedDays / totalDays) * 100).toFixed(2)), 100);
});

investmentSchema.virtual('canCancel').get(function () {
    return this.status === 'active' && this.isLockCompleted === true;
});

investmentSchema.virtual('isActiveInvestment').get(function () {
    return this.status === 'active';
});

investmentSchema.pre('validate', function (next) {
    this.amount = Number(this.amount || 0);
    this.lockPeriodDays = Number(this.lockPeriodDays || 30);
    this.daysCompleted = Number(this.daysCompleted || 0);
    this.totalInterestEarned = Number(this.totalInterestEarned || 0);
    this.currentValueSnapshot = Number(this.currentValueSnapshot || 0);
    this.dailyInterestAmount = Number(this.dailyInterestAmount || 0);

    if (this.slabDailyRate !== null && typeof this.slabDailyRate !== 'undefined') {
        this.slabDailyRate = Number(this.slabDailyRate);
    }

    if (this.customDailyRate !== null && typeof this.customDailyRate !== 'undefined') {
        this.customDailyRate = Number(this.customDailyRate);
    }

    if (this.effectiveDailyRate !== null && typeof this.effectiveDailyRate !== 'undefined') {
        this.effectiveDailyRate = Number(this.effectiveDailyRate);
    }

    if (Number.isNaN(this.amount)) {
        return next(new Error('Investment amount must be a valid number'));
    }

    if (Number.isNaN(this.lockPeriodDays)) {
        return next(new Error('Lock period days must be a valid number'));
    }

    if (Number.isNaN(this.daysCompleted)) {
        return next(new Error('Days completed must be a valid number'));
    }

    if (Number.isNaN(this.dailyInterestAmount)) {
        return next(new Error('Daily interest amount must be a valid number'));
    }

    if (this.lockPeriodDays < 1) {
        return next(new Error('Lock period days must be at least 1'));
    }

    if (this.daysCompleted < 0) {
        return next(new Error('Days completed cannot be negative'));
    }

    if (this.daysCompleted > this.lockPeriodDays) {
        this.daysCompleted = this.lockPeriodDays;
    }

    this.daysRemaining = Math.max(this.lockPeriodDays - this.daysCompleted, 0);
    this.isLockCompleted = this.daysCompleted >= this.lockPeriodDays;

    if (this.status === 'active' && !this.approvedAt) {
        this.approvedAt = new Date();
    }

    if (this.status === 'active' && this.approvedAt && !this.lockEndsAt) {
        const lockEndsAt = new Date(this.approvedAt);
        lockEndsAt.setDate(lockEndsAt.getDate() + this.lockPeriodDays);
        this.lockEndsAt = lockEndsAt;
    }

    if (this.status === 'rejected' && !this.rejectedAt) {
        this.rejectedAt = new Date();
    }

    if (this.status === 'cancelled' && !this.cancelledAt) {
        this.cancelledAt = new Date();
    }

    if (this.status === 'completed' && !this.completedAt) {
        this.completedAt = new Date();
    }

    if (
        (this.status === 'active' || this.status === 'completed' || this.status === 'cancelled') &&
        (this.effectiveDailyRate === null || typeof this.effectiveDailyRate === 'undefined')
    ) {
        return next(new Error('Effective daily rate is required for active investments'));
    }

    if (
        (this.status === 'active' || this.status === 'completed' || this.status === 'cancelled') &&
        (this.dailyInterestAmount < 0 || typeof this.dailyInterestAmount === 'undefined')
    ) {
        return next(new Error('Daily interest amount must be set for active investments'));
    }

    next();
});

const Investment = mongoose.models.Investment || mongoose.model('Investment', investmentSchema);

export { INVESTMENT_STATUSES };
export default Investment;