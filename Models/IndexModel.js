import mongoose from 'mongoose';

const indexSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    symbol: {
        type: String,
        required: true,
        unique: true,  // ✅ This already creates an index
        uppercase: true,
        trim: true
    },
    category: {
        type: String,
        required: true,
        enum: ['Indian', 'Global', 'Crypto'],
        default: 'Indian'
    },
    currentValue: {
        type: Number,
        required: true,
        min: 0
    },
    openValue: {
        type: Number,
        required: true,
        min: 0
    },
    highValue: {
        type: Number,
        required: true,
        min: 0
    },
    lowValue: {
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
    icon: {
        type: String,
        default: 'chart-line'
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    marketCap: {
        type: Number
    },
    volume: {
        type: Number
    },
    description: {
        type: String
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// ✅ Compound indexes only (removed duplicate single-field indexes)
indexSchema.index({ category: 1, isActive: 1 });
indexSchema.index({ isFeatured: 1 });
// ❌ REMOVED: indexSchema.index({ symbol: 1 }); // Already indexed by unique: true

// Virtual for isPositive
indexSchema.virtual('isPositive').get(function() {
    return this.change >= 0;
});

// Method to update price
indexSchema.methods.updatePrice = function(newValue) {
    this.currentValue = newValue;
    this.change = newValue - this.previousClose;
    this.changePercent = ((this.change / this.previousClose) * 100).toFixed(2);
    this.lastUpdated = new Date();
    return this.save();
};

const Index = mongoose.model('Index', indexSchema);

export default Index;
