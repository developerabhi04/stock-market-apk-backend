import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Category name is required'],
            trim: true,
            unique: true,
        },
        slug: {
            type: String,
            required: [true, 'Category slug is required'],
            trim: true,
            unique: true,
            lowercase: true,
        },
        description: {
            type: String,
            trim: true,
            default: '',
        },
        displayOrder: {
            type: Number,
            default: 0,
        },
        icon: {
            type: String,
            trim: true,
            default: '',
        },
        color: {
            type: String,
            trim: true,
            default: '',
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
            default: null,
        },
    },
    { timestamps: true }
);

categorySchema.index({ slug: 1 }, { unique: true });
categorySchema.index({ displayOrder: 1, isActive: 1 });
categorySchema.index({ name: 1 });

categorySchema.set('toJSON', { virtuals: true });
categorySchema.set('toObject', { virtuals: true });

const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);


export default Category;