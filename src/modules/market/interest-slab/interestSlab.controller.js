import { ApiResponse } from '../../../shared/utils/apiResponse.js';
import { asyncHandler } from '../../../shared/utils/asyncHandler.js';
import {
    createInterestSlabService,
    deleteInterestSlabService,
    getActiveInterestSlabsService,
    getAllInterestSlabsService,
    getInterestSlabByAmountService,
    getInterestSlabByIdService,
    updateInterestSlabService,
} from './interestSlab.service.js';

export const createInterestSlab = asyncHandler(async (req, res) => {
    const slab = await createInterestSlabService(req.body);

    return res
        .status(201)
        .json(new ApiResponse(201, slab, 'Interest slab created successfully'));
});

export const getAllInterestSlabs = asyncHandler(async (req, res) => {
    const result = await getAllInterestSlabsService(req.query);

    return res
        .status(200)
        .json(new ApiResponse(200, result, 'Interest slabs fetched successfully'));
});

export const getActiveInterestSlabs = asyncHandler(async (req, res) => {
    const slabs = await getActiveInterestSlabsService();

    return res
        .status(200)
        .json(new ApiResponse(200, slabs, 'Active interest slabs fetched successfully'));
});

export const getInterestSlabById = asyncHandler(async (req, res) => {
    const slab = await getInterestSlabByIdService({ slabId: req.params.slabId });

    return res
        .status(200)
        .json(new ApiResponse(200, slab, 'Interest slab fetched successfully'));
});

export const getInterestSlabByAmount = asyncHandler(async (req, res) => {
    const slab = await getInterestSlabByAmountService({ amount: req.query.amount });

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                slab,
                slab
                    ? 'Interest slab fetched successfully'
                    : 'No active interest slab found for this amount'
            )
        );
});

export const updateInterestSlab = asyncHandler(async (req, res) => {
    const slab = await updateInterestSlabService({
        slabId: req.params.slabId,
        payload: req.body,
    });

    return res
        .status(200)
        .json(new ApiResponse(200, slab, 'Interest slab updated successfully'));
});

export const deleteInterestSlab = asyncHandler(async (req, res) => {
    await deleteInterestSlabService({ slabId: req.params.slabId });

    return res
        .status(200)
        .json(new ApiResponse(200, null, 'Interest slab deleted successfully'));
});