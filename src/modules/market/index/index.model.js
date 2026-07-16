import mongoose from 'mongoose';

const indexSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        symbol: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
        },
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Category',
            required: true,
            default: null,
        },
        currentValue: {
            type: Number,
            required: true,
            min: 0,
        },
        highValue: {
            type: Number,
            required: true,
            min: 0,
        },
        lowValue: {
            type: Number,
            required: true,
            min: 0,
        },
        previousClose: {
            type: Number,
            required: true,
            min: 0,
        },
        change: {
            type: Number,
            required: true,
            default: 0,
        },
        changePercent: {
            type: Number,
            required: true,
            default: 0,
        },
        logoUrl: {
            type: String,
            trim: true,
            default: '',
        },
        defaultDailyRate: {
            type: Number,
            default: null,
            min: 0,
        },
        minimumInvestment: {
            type: Number,
            required: true,
            min: 1,
        },
        lockPeriodDays: {
            type: Number,
            required: true,
            min: 1,
        },
        isFeatured: {
            type: Boolean,
            default: false,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        marketCap: {
            type: Number,
            default: 0,
            min: 0,
        },
        volume: {
            type: Number,
            default: 0,
            min: 0,
        },
        description: {
            type: String,
            trim: true,
            default: '',
        },
        lastUpdated: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

indexSchema.index({ category: 1, isActive: 1 });
indexSchema.index({ isFeatured: 1, isActive: 1 });


indexSchema.virtual('isPositive').get(function () {
    return this.change >= 0;
});

indexSchema.set('toJSON', { virtuals: true });
indexSchema.set('toObject', { virtuals: true });

indexSchema.pre('validate', function (next) {
    if (this.name) {
        this.name = String(this.name).trim();
    }

    if (this.symbol) {
        this.symbol = String(this.symbol).trim().toUpperCase();
    }

    if (this.logoUrl) {
        this.logoUrl = String(this.logoUrl).trim();
    }

    if (this.description) {
        this.description = String(this.description).trim();
    }

    this.currentValue = Number(this.currentValue);
    this.highValue = Number(this.highValue);
    this.lowValue = Number(this.lowValue);
    this.previousClose = Number(this.previousClose);
    this.marketCap = Number(this.marketCap || 0);
    this.volume = Number(this.volume || 0);

    if ([this.currentValue, this.highValue, this.lowValue, this.previousClose].some(Number.isNaN)) {
        return next(new Error('Current value, high value, low value, and previous close must be valid numbers'));
    }

    if (Number.isNaN(this.marketCap) || this.marketCap < 0) {
        return next(new Error('Market cap must be a valid non-negative number'));
    }

    if (Number.isNaN(this.volume) || this.volume < 0) {
        return next(new Error('Volume must be a valid non-negative number'));
    }

    if (this.defaultDailyRate === '') {
        this.defaultDailyRate = null;
    }

    if (this.defaultDailyRate !== null && this.defaultDailyRate !== undefined) {
        this.defaultDailyRate = Number(this.defaultDailyRate);

        if (Number.isNaN(this.defaultDailyRate)) {
            return next(new Error('Default daily rate must be a valid number'));
        }

        if (this.defaultDailyRate < 0) {
            return next(new Error('Default daily rate cannot be negative'));
        }
    }

    if (this.minimumInvestment !== null && typeof this.minimumInvestment !== 'undefined') {
        this.minimumInvestment = Number(this.minimumInvestment);

        if (Number.isNaN(this.minimumInvestment)) {
            return next(new Error('Minimum investment must be a valid number'));
        }

        if (this.minimumInvestment <= 0) {
            return next(new Error('Minimum investment must be greater than 0'));
        }
    }

    if (this.lockPeriodDays !== null && typeof this.lockPeriodDays !== 'undefined') {
        this.lockPeriodDays = Number(this.lockPeriodDays);

        if (Number.isNaN(this.lockPeriodDays)) {
            return next(new Error('Lock period days must be a valid number'));
        }

        if (this.lockPeriodDays <= 0) {
            return next(new Error('Lock period days must be greater than 0'));
        }

        if (!Number.isInteger(this.lockPeriodDays)) {
            return next(new Error('Lock period days must be a whole number'));
        }
    }

    this.change = Number((this.currentValue - this.previousClose).toFixed(2));
    this.changePercent =
        this.previousClose > 0
            ? Number((((this.currentValue - this.previousClose) / this.previousClose) * 100).toFixed(2))
            : 0;

    this.lastUpdated = new Date();
    next();
});

const Index = mongoose.models.Index || mongoose.model('Index', indexSchema);

export default Index;