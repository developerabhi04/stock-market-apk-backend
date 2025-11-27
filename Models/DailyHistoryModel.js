import mongoose from 'mongoose';

const dailyHistorySchema = new mongoose.Schema({
    ticker: {
        type: String,
        required: true,
        uppercase: true,
        index: true
    },
    date: {
        type: Date,
        required: true
    },
    day: {
        type: String,
        required: true
    },
    open: {
        type: Number,
        required: true,
        min: 0
    },
    close: {
        type: Number,
        required: true,
        min: 0
    },
    high: {
        type: Number,
        required: true,
        min: 0
    },
    low: {
        type: Number,
        required: true,
        min: 0
    },
    volume: {
        type: Number,
        default: 0
    },
    change: {
        type: Number,
        required: true
    },
    changePercent: {
        type: Number,
        required: true
    }
}, {
    timestamps: true
});

// Compound index
dailyHistorySchema.index({ ticker: 1, date: 1 }, { unique: true });
dailyHistorySchema.index({ date: -1 });

// Virtual for isPositive
dailyHistorySchema.virtual('isPositive').get(function () {
    return this.change >= 0;
});

const DailyHistory = mongoose.model('DailyHistory', dailyHistorySchema);


export default DailyHistory;
