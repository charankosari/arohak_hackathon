import * as cancellationService from '../services/cancellation.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listRequests = asyncHandler(async (req, res) => {
  res.json(
    await cancellationService.listCancellationRequests({
      actor: req.user,
      query: req.validatedQuery,
    })
  );
});

export const getRequest = asyncHandler(async (req, res) => {
  const request = await cancellationService.getCancellationRequest({
    actor: req.user,
    id: req.params.id,
  });
  res.json({ request });
});

/** Staff approve or reject. Approval is what actually cancels the booking. */
export const reviewRequest = asyncHandler(async (req, res) => {
  const result = await cancellationService.reviewCancellationRequest({
    actor: req.user,
    id: req.params.id,
    decision: req.body.decision,
    reviewNote: req.body.reviewNote,
  });
  res.json(result);
});
