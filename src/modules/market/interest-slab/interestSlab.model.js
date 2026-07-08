import mongoose from 'mongoose';

const interestSlabSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120,
        },
        minAmount: {
            type: Number,
            required: true,
            min: 0,
        },
        maxAmount: {
            type: Number,
            required: true,
            min: 0,
        },
        dailyRate: {
            type: Number,
            required: true,
            min: 0,
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },
        sortOrder: {
            type: Number,
            default: 0,
        },
        description: {
            type: String,
            trim: true,
            default: '',
        },
    },
    {
        timestamps: true,
    }
);

interestSlabSchema.index({ isActive: 1, minAmount: 1, maxAmount: 1 });
interestSlabSchema.index({ minAmount: 1, maxAmount: 1 });
interestSlabSchema.index({ sortOrder: 1, createdAt: -1 });

interestSlabSchema.pre('validate', function (next) {
    if (typeof this.title === 'string') {
        this.title = this.title.trim();
    }

    this.minAmount = Number(this.minAmount);
    this.maxAmount = Number(this.maxAmount);
    this.dailyRate = Number(this.dailyRate);

    if (Number.isNaN(this.minAmount)) {
        return next(new Error('Minimum amount must be a valid number'));
    }

    if (Number.isNaN(this.maxAmount)) {
        return next(new Error('Maximum amount must be a valid number'));
    }

    if (Number.isNaN(this.dailyRate)) {
        return next(new Error('Daily rate must be a valid number'));
    }

    if (this.maxAmount < this.minAmount) {
        return next(new Error('Maximum amount must be greater than or equal to minimum amount'));
    }

    this.dailyRate = Number(this.dailyRate.toFixed(2));
    next();
});

interestSlabSchema.virtual('rangeLabel').get(function () {
    return `₹${this.minAmount} - ₹${this.maxAmount}`;
});

interestSlabSchema.set('toJSON', { virtuals: true });
interestSlabSchema.set('toObject', { virtuals: true });

const InterestSlab =
    mongoose.models.InterestSlab || mongoose.model('InterestSlab', interestSlabSchema);

export default InterestSlab;