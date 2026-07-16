import { ApiResponse } from '../../../shared/utils/apiResponse.js';
import { asyncHandler } from '../../../shared/utils/asyncHandler.js';
import {
  getAllIndicesService,
  getPublicIndicesService,
  getFeaturedIndicesService,
  getIndexBySymbolService,
  createIndexService,
  updateIndexService,
  deleteIndexService,
} from './index.service.js';

export const getAllIndices = asyncHandler(async (req, res) => {
  const data = await getPublicIndicesService(req.query);

  res.status(200).json(
    new ApiResponse(200, data, 'Indices fetched successfully')
  );
});

export const getAdminIndices = asyncHandler(async (req, res) => {
  const data = await getAllIndicesService(req.query);

  res.status(200).json(
    new ApiResponse(200, data, 'Admin indices fetched successfully')
  );
});

export const getFeaturedIndices = asyncHandler(async (req, res) => {
  const indices = await getFeaturedIndicesService();

  res.status(200).json(
    new ApiResponse(
      200,
      { indices },
      'Featured indices fetched successfully'
    )
  );
});

export const getIndexBySymbol = asyncHandler(async (req, res) => {
  const data = await getIndexBySymbolService({ symbol: req.params.symbol });

  res.status(200).json(
    new ApiResponse(200, data, 'Index fetched successfully')
  );
});

export const createIndex = asyncHandler(async (req, res) => {
  const data = await createIndexService(req.body);

  res.status(201).json(
    new ApiResponse(201, data, 'Index created successfully')
  );
});

export const updateIndex = asyncHandler(async (req, res) => {
  const data = await updateIndexService({
    indexId: req.params.id,
    payload: req.body,
  });

  res.status(200).json(
    new ApiResponse(200, data, 'Index updated successfully')
  );
});

export const deleteIndex = asyncHandler(async (req, res) => {
  await deleteIndexService({ indexId: req.params.id });

  res.status(200).json(
    new ApiResponse(200, null, 'Index deleted successfully')
  );
});