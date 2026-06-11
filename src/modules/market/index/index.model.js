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
      unique: true,
      uppercase: true,
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId, // ✅ FIXED: was String with enum
      ref: 'Category',                       // ✅ FIXED: reference to Category model
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
    },
    volume: {
      type: Number,
      default: 0,
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
indexSchema.index({ name: 1, symbol: 1 });

indexSchema.virtual('isPositive').get(function () {
  return this.change >= 0;
});

indexSchema.set('toJSON', { virtuals: true });
indexSchema.set('toObject', { virtuals: true });

indexSchema.pre('validate', function (next) {
  const currentValue = Number(this.currentValue);
  const previousClose = Number(this.previousClose);

  this.change = Number((currentValue - previousClose).toFixed(2));
  this.changePercent =
    previousClose > 0
      ? Number((((currentValue - previousClose) / previousClose) * 100).toFixed(2))
      : 0;

  this.lastUpdated = new Date();
  next();
});

const Index = mongoose.models.Index || mongoose.model('Index', indexSchema);

export default Index;