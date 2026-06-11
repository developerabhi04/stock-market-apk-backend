import mongoose from 'mongoose';

const pricePointSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      required: true
    },
    value: {
      type: Number,
      required: true,
      min: 0
    },
    volume: {
      type: Number,
      default: 0
    },
    label: {
      type: String
    }
  },
  { _id: false }
);

const priceHistorySchema = new mongoose.Schema(
  {
    ticker: {
      type: String,
      required: true,
      uppercase: true,
      index: true
    },
    type: {
      type: String,
      required: true,
      enum: ['Stock', 'Index'],
      default: 'Stock'
    },
    period: {
      type: String,
      required: true,
      enum: ['1D', '1W', '1M', '3M', '6M', '1Y', '5Y', 'All'],
      default: '1D'
    },
    data: [pricePointSchema],
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

priceHistorySchema.index({ ticker: 1, period: 1 }, { unique: true });
priceHistorySchema.index({ type: 1, ticker: 1 });

const PriceHistory =
  mongoose.models.PriceHistory ||
  mongoose.model('PriceHistory', priceHistorySchema);

export default PriceHistory;