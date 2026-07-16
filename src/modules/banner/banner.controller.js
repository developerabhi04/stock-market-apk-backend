// banner.controller.js
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { ApiResponse } from '../../shared/utils/apiResponse.js';
import {
  deleteBannerService,
  getAllBannersAdminService,
  getAllBannersPublicService,
  toggleBannerStatusService,
  uploadBannerService
} from './banner.service.js';

export const getAllBannersPublic = asyncHandler(async (req, res) => {
  const banners = await getAllBannersPublicService();
  res.status(200).json(new ApiResponse(200, { banners }, 'Banners fetched successfully'));
});

export const getAllBannersAdmin = asyncHandler(async (req, res) => {
  const banners = await getAllBannersAdminService();
  res.status(200).json(new ApiResponse(200, { banners }, 'Banners fetched successfully'));
});

export const uploadBanner = asyncHandler(async (req, res) => {
  const banner = await uploadBannerService({
    imageUrl: req.body.imageUrl,
    linkUrl: req.body.linkUrl,
    adminId: req.admin.adminId
  });
  res.status(201).json(new ApiResponse(201, { banner }, 'Banner added successfully'));
});

export const deleteBanner = asyncHandler(async (req, res) => {
  await deleteBannerService({ id: req.params.id });
  res.status(200).json(new ApiResponse(200, null, 'Banner deleted successfully'));
});

export const toggleBannerStatus = asyncHandler(async (req, res) => {
  const banner = await toggleBannerStatusService({ id: req.params.id });
  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { banner },
        `Banner ${banner.isActive ? 'activated' : 'deactivated'}`
      )
    );
});