import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        maxlength: [50, 'Title cannot exceed 50 characters']
    },
    message: {
        type: String,
        required: [true, 'Message is required'],
        trim: true,
        maxlength: [200, 'Message cannot exceed 200 characters']
    },
    type: {
        type: String,
        enum: ['general', 'payment', 'withdrawal', 'promotion'],
        default: 'general'
    },
    recipients: {
        type: String,
        enum: ['all', 'individual'],
        default: 'all'
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        // Only required if recipients is 'individual'
        required: function () {
            return this.recipients === 'individual';
        }
    },
    sentBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'sent', 'failed'],
        default: 'sent'
    },
    readBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    clickedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
}, {
    timestamps: true
});

// Index for faster queries
notificationSchema.index({ recipients: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
