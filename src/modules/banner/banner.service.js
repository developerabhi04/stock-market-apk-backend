import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Banner from './banner.model.js';
import { ApiError } from '../../shared/utils/apiError.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');

const toAbsoluteUrl = (filePath) => {
  if (!filePath) return '';
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
  return `${PUBLIC_BASE_URL}${filePath.startsWith('/') ? '' : '/'}${filePath}`;
};

export const getAllBannersPublicService = async () => {
  const banners = await Banner.find({ isActive: true })
    .sort({ order: 1 })
    .select('imageUrl order isActive createdAt updatedAt')
    .lean();

  return banners.map((banner) => ({
    ...banner,
    imageUrl: toAbsoluteUrl(banner.imageUrl),
  }));
};

export const getAllBannersAdminService = async () => {
  const banners = await Banner.find()
    .sort({ order: 1, createdAt: -1 })
    .populate('createdBy', 'username fullName')
    .lean();

  return banners.map((banner) => ({
    ...banner,
    imageUrl: toAbsoluteUrl(banner.imageUrl),
  }));
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
    createdBy: adminId,
  });

  return {
    ...banner.toObject(),
    imageUrl: toAbsoluteUrl(imageUrl),
  };
};

export const deleteBannerService = async ({ id }) => {
  const banner = await Banner.findById(id);

  if (!banner) {
    throw new ApiError(404, 'Banner not found');
  }

  if (banner.imageUrl) {
    const relativePath = banner.imageUrl.replace(PUBLIC_BASE_URL, '');
    const imagePath = path.join(__dirname, '../../..', relativePath);

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

  return {
    ...banner.toObject(),
    imageUrl: toAbsoluteUrl(banner.imageUrl),
  };
};

export const reorderBannersService = async ({ banners }) => {
  if (!Array.isArray(banners) || banners.length === 0) {
    throw new ApiError(400, 'Banners array is required');
  }

  await Promise.all(
    banners.map(({ id, order }) => Banner.findByIdAndUpdate(id, { order }, { new: true }))
  );

  return null;
};