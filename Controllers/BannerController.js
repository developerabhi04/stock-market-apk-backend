import Banner from '../Models/BannerModel.js';
import { ApiError } from '../Utils/apiError.js';
import { ApiResponse } from '../Utils/apiResponse.js';
import { asyncHandler } from '../Utils/asyncHandler.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * ✅ Get All Active Banners (Public - for mobile app)
 */
export const getAllBannersPublic = asyncHandler(async (req, res) => {
    const banners = await Banner.find({ isActive: true })
        .sort({ order: 1 })
        .select('imageUrl')
        .lean();

    res.status(200).json(
        new ApiResponse(200, { banners }, 'Banners fetched successfully')
    );
});

/**
 * ✅ Get All Banners (Admin)
 */
export const getAllBannersAdmin = asyncHandler(async (req, res) => {
    console.log('📥 getAllBannersAdmin called');

    const banners = await Banner.find()
        .sort({ order: 1, createdAt: -1 })
        .populate('createdBy', 'username fullName')
        .lean();

    console.log('✅ Found banners:', banners.length);
    console.log('✅ Banners:', banners);

    res.status(200).json(
        new ApiResponse(200, { banners }, 'Banners fetched successfully')
    );
});


/**
 * ✅ Upload Banner Image (Super Admin Only)
 */
export const uploadBanner = asyncHandler(async (req, res) => {
    // Check if file was uploaded
    if (!req.file) {
        throw new ApiError(400, 'Please upload an image file');
    }

    // Get the file URL (accessible from frontend)
    const imageUrl = `/uploads/banners/${req.file.filename}`;

    // Get the current maximum order
    const maxOrderBanner = await Banner.findOne().sort({ order: -1 });
    const newOrder = maxOrderBanner ? maxOrderBanner.order + 1 : 0;

    const banner = await Banner.create({
        imageUrl,
        order: newOrder,
        createdBy: req.admin.adminId
    });

    res.status(201).json(
        new ApiResponse(201, { banner }, 'Banner uploaded successfully')
    );
});

/**
 * ✅ Delete Banner (Super Admin Only)
 */
export const deleteBanner = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const banner = await Banner.findById(id);

    if (!banner) {
        throw new ApiError(404, 'Banner not found');
    }

    // ✅ Delete the image file from server
    if (banner.imageUrl) {
        const imagePath = path.join(__dirname, '..', banner.imageUrl);
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }
    }

    await Banner.findByIdAndDelete(id);

    res.status(200).json(
        new ApiResponse(200, null, 'Banner deleted successfully')
    );
});

/**
 * ✅ Toggle Banner Active Status
 */
export const toggleBannerStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const banner = await Banner.findById(id);

    if (!banner) {
        throw new ApiError(404, 'Banner not found');
    }

    banner.isActive = !banner.isActive;
    await banner.save();

    res.status(200).json(
        new ApiResponse(200, { banner }, `Banner ${banner.isActive ? 'activated' : 'deactivated'}`)
    );
});

/**
 * ✅ Reorder Banners
 */
export const reorderBanners = asyncHandler(async (req, res) => {
    const { banners } = req.body;

    if (!Array.isArray(banners)) {
        throw new ApiError(400, 'Banners array is required');
    }

    const updatePromises = banners.map(({ id, order }) =>
        Banner.findByIdAndUpdate(id, { order })
    );

    await Promise.all(updatePromises);

    res.status(200).json(
        new ApiResponse(200, null, 'Banners reordered successfully')
    );
});
