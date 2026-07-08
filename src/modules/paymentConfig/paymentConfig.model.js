import mongoose from 'mongoose';

const paymentConfigSchema = new mongoose.Schema(
    {
        // ─── UPI ──────────────────────────────────────────────────────────────
        upi: {
            enabled: {
                type: Boolean,
                default: false,
            },
            upiId: {
                type: String,
                default: '',
                trim: true,
            },
            payeeName: {
                type: String,
                default: '',
                trim: true,
            },
        },

        // ─── Bank Account ─────────────────────────────────────────────────────
        bank: {
            enabled: {
                type: Boolean,
                default: false,
            },
            accountHolderName: {
                type: String,
                default: '',
                trim: true,
            },
            accountNumber: {
                type: String,
                default: '',
                trim: true,
            },
            ifscCode: {
                type: String,
                default: '',
                trim: true,
                uppercase: true,
            },
            bankName: {
                type: String,
                default: '',
                trim: true,
            },
            accountType: {
                type: String,
                enum: ['savings', 'current'],
                default: 'savings',
            },
        },

        // ─── Meta ─────────────────────────────────────────────────────────────
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

const PaymentConfig = mongoose.model('PaymentConfig', paymentConfigSchema);
export default PaymentConfig;