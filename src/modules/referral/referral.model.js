import mongoose from 'mongoose';

const referralSchema = new mongoose.Schema(
    {
        referrer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        referee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true, // one referee can only be referred once
        },
        referralCodeUsed: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'rewarded', 'expired'],
            default: 'pending',
            index: true,
        },
        rewardAmount: {
            type: Number,
            default: 0,
        },
        triggerRechargeAmount: {
            type: Number,
            default: null,
        },
        rewardedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

referralSchema.index({ referrer: 1, status: 1 });

const Referral = mongoose.model('Referral', referralSchema);

export default Referral;