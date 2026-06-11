import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        type: {
            type: String,
            enum: ['credit', 'debit'],
            required: true
        },
        category: {
            type: String,
            enum: [
                'add_money',
                'withdrawal',
                'trade_buy',
                'trade_sell',
                'profit',
                'loss',
                'refund',
                'signup_bonus'
            ],
            required: true,
            index: true
        },
        amount: {
            type: Number,
            required: true,
            min: 0
        },
        balanceBefore: {
            type: Number,
            required: true
        },
        balanceAfter: {
            type: Number,
            required: true
        },
        bonusBalanceBefore: {
            type: Number,
            default: 0
        },
        bonusBalanceAfter: {
            type: Number,
            default: 0
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed', 'cancelled', 'rejected'],
            default: 'pending',
            index: true
        },
        paymentDetails: {
            method: String,
            utrNumber: String,
            gateway: String,
            gatewayTransactionId: String,
            gatewayResponse: mongoose.Schema.Types.Mixed,
            verifiedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Admin'
            },
            verifiedAt: Date,
            verificationNote: String,
            paymentScreenshot: String
        },
        withdrawalDetails: {
            accountNumber: String,
            ifscCode: String,
            accountHolderName: String,
            bankName: String,
            utrNumber: String,
            processedAt: Date,
            processedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Admin'
            },
            rejectionReason: String
        },
        tradeDetails: {
            orderId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Order'
            },
            stockSymbol: String,
            quantity: Number,
            price: Number,
            bonusUsed: Number,
            walletUsed: Number
        },
        description: String,
        metadata: mongoose.Schema.Types.Mixed,
        adminAction: {
            actionType: {
                type: String,
                enum: ['approved', 'rejected', 'pending']
            },
            actionBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Admin'
            },
            actionAt: Date,
            reason: String
        }
    },
    {
        timestamps: true
    }
);

transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ userId: 1, category: 1, status: 1 });
transactionSchema.index({ 'paymentDetails.utrNumber': 1 }, { sparse: true });
transactionSchema.index({ status: 1, category: 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;