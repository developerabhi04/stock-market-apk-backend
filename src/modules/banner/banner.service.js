import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Banner from './banner.model.js';
import { ApiError } from '../../shared/utils/apiError.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const getAllBannersPublicService = async () => {
  return Banner.find({ isActive: true })
    .sort({ order: 1 })
    .select('imageUrl')
    .lean();
};

export const getAllBannersAdminService = async () => {
  return Banner.find()
    .sort({ order: 1, createdAt: -1 })
    .populate('createdBy', 'username fullName')
    .lean();
};

export const uploadBannerService = async ({ file, adminId }) => {
  if (!file) {
    throw new ApiError(400, 'Please upload an image file');
  }

  const imageUrl = `/uploads/banners/${file.filename}`;

  const maxOrderBanner = await Banner.findOne().sort({ order: -1 });
  const newOrder = maxOrderBanner ? maxOrderBanner.order + 1 : 0;

  const banner = await Banner.create({
    imageUrl,
    order: newOrder,
    createdBy: adminId
  });

  return banner;
};

export const deleteBannerService = async ({ id }) => {
  const banner = await Banner.findById(id);

  if (!banner) {
    throw new ApiError(404, 'Banner not found');
  }

  if (banner.imageUrl) {
    // Resolve from project root: src/modules/banner/ → go up 3 levels to reach root
    const imagePath = path.join(__dirname, '../../..', banner.imageUrl);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
  }

  await Banner.findByIdAndDelete(id);
  return null;
};

export const toggleBannerStatusService = async ({ id }) => {
  const banner = await Banner.findById(id);

  if (!banner) {
    throw new ApiError(404, 'Banner not found');
  }

  banner.isActive = !banner.isActive;
  await banner.save();

  return banner;
};

export const reorderBannersService = async ({ banners }) => {
  if (!Array.isArray(banners) || banners.length === 0) {
    throw new ApiError(400, 'Banners array is required');
  }

  const updatePromises = banners.map(({ id, order }) =>
    Banner.findByIdAndUpdate(id, { order }, { new: true })
  );

  await Promise.all(updatePromises);
  return null;
};