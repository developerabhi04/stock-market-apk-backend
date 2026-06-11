import mongoose from 'mongoose';

const stockSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        ticker: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true
        },
        symbol: {
            type: String,
            required: true,
            uppercase: true,
            trim: true
        },
        price: {
            type: Number,
            required: true,
            min: 0
        },
        openPrice: {
            type: Number,
            required: true,
            min: 0
        },
        highPrice: {
            type: Number,
            required: true,
            min: 0
        },
        lowPrice: {
            type: Number,
            required: true,
            min: 0
        },
        previousClose: {
            type: Number,
            required: true,
            min: 0
        },
        change: {
            type: Number,
            required: true
        },
        changePercent: {
            type: Number,
            required: true
        },
        volume: {
            type: Number,
            default: 0
        },
        marketCap: {
            type: Number
        },
        sector: {
            type: String
        },
        category: {
            type: String,
            enum: ['Stock', 'Index', 'ETF', 'Commodity'],
            default: 'Stock'
        },
        isFeatured: {
            type: Boolean,
            default: false
        },
        isActive: {
            type: Boolean,
            default: true
        },
        icon: {
            type: String,
            default: 'chart-line'
        },
        description: {
            type: String
        },
        lastUpdated: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

stockSchema.index({ isFeatured: 1, isActive: 1 });
stockSchema.index({ category: 1 });

stockSchema.virtual('isPositive').get(function () {
    return this.change >= 0;
});

stockSchema.set('toJSON', { virtuals: true });
stockSchema.set('toObject', { virtuals: true });

stockSchema.methods.updatePrice = function (newPrice) {
    this.price = Number(newPrice);
    this.change = Number(newPrice) - this.previousClose;
    this.changePercent = Number(((this.change / this.previousClose) * 100).toFixed(2));
    this.lastUpdated = new Date();
    return this.save();
};

const Stock = mongoose.models.Stock || mongoose.model('Stock', stockSchema);

export default Stock;