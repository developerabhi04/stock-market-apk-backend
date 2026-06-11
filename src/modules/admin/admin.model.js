import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const adminSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: [true, 'Username is required'],
            unique: true,
            trim: true,
            lowercase: true,
            minlength: [3, 'Username must be at least 3 characters']
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,})+$/, 'Please enter a valid email']
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [6, 'Password must be at least 6 characters'],
            select: false
        },
        fullName: {
            type: String,
            required: [true, 'Full name is required'],
            trim: true
        },
        role: {
            type: String,
            enum: ['super_admin', 'admin'],
            default: 'admin'
        },
        isActive: {
            type: Boolean,
            default: true
        },
        permissions: {
            canApprovePayments: {
                type: Boolean,
                default: true
            },
            canRejectPayments: {
                type: Boolean,
                default: true
            },
            canViewUsers: {
                type: Boolean,
                default: true
            },
            canManageAdmins: {
                type: Boolean,
                default: false
            }
        },
        allowedRoutes: {
            type: [String],
            default: []
        },
        lastLogin: Date,
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin'
        }
    },
    {
        timestamps: true
    }
);

adminSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

adminSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

adminSchema.statics.findByUsername = function (username) {
    return this.findOne({ username: username.toLowerCase(), isActive: true });
};

const Admin = mongoose.model('Admin', adminSchema);

export default Admin;