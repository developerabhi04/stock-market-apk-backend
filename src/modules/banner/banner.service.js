// banner.service.js
import Banner from './banner.model.js';
import { ApiError } from '../../shared/utils/apiError.js';

const isValidUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export const getAllBannersPublicService = async () => {
  const banners = await Banner.find({ isActive: true })
    .sort({ createdAt: -1 })
    .select('imageUrl linkUrl isActive createdAt updatedAt')
    .lean();

  return banners;
};

export const getAllBannersAdminService = async () => {
  const banners = await Banner.find()
    .sort({ createdAt: -1 })
    .populate('createdBy', 'username fullName')
    .lean();

  return banners;
};

export const uploadBannerService = async ({ imageUrl, linkUrl, adminId }) => {
  if (!imageUrl || !imageUrl.trim()) {
    throw new ApiError(400, 'Please provide an image URL');
  }

  const trimmedImageUrl = imageUrl.trim();

  if (!isValidUrl(trimmedImageUrl)) {
    throw new ApiError(400, 'Please provide a valid image URL (must start with http:// or https://)');
  }

  if (linkUrl && linkUrl.trim() && !isValidUrl(linkUrl.trim())) {
    throw new ApiError(400, 'Please provide a valid link URL (must start with http:// or https://)');
  }

  const banner = await Banner.create({
    imageUrl: trimmedImageUrl,
    linkUrl: linkUrl ? linkUrl.trim() : '',
    createdBy: adminId,
  });

  return banner.toObject();
};

export const deleteBannerService = async ({ id }) => {
  const banner = await Banner.findById(id);

  if (!banner) {
    throw new ApiError(404, 'Banner not found');
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

  return banner.toObject();
};