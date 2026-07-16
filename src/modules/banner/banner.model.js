// banner.model.js
import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema(
    {
        imageUrl: {
            type: String,
            required: [true, 'Image URL is required']
        },
        linkUrl: {
            type: String,
            default: ''
        },
        isActive: {
            type: Boolean,
            default: true
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin'
        }
    },
    { timestamps: true }
);

bannerSchema.index({ isActive: 1 });

const Banner = mongoose.model('Banner', bannerSchema);
export default Banner;