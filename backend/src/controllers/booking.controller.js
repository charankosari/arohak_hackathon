import * as bookingService from '../services/booking.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listBookings = asyncHandler(async (req, res) => {
  res.json(await bookingService.listBookings({ actor: req.user, query: req.validatedQuery }));
});

export const getBooking = asyncHandler(async (req, res) => {
  res.json(await bookingService.getBooking({ actor: req.user, id: req.params.id }));
});

export const createBooking = asyncHandler(async (req, res) => {
  const result = await bookingService.createBooking({ actor: req.user, payload: req.body });
  res.status(201).json(result);
});

export const modifyBooking = asyncHandler(async (req, res) => {
  const booking = await bookingService.modifyBookingDates({
    actor: req.user,
    id: req.params.id,
    ...req.body,
  });
  res.json({ booking });
});

/** Preview what cancelling would do, without doing it. */
export const cancellationPolicy = asyncHandler(async (req, res) => {
  res.json(await bookingService.previewCancellation({ actor: req.user, id: req.params.id }));
});

/**
 * Cancels outright, or opens a staff review request when the guest is past the
 * 24-hour window. 202 signals "accepted for review, not yet cancelled".
 */
export const cancelBooking = asyncHandler(async (req, res) => {
  const result = await bookingService.cancelBooking({
    actor: req.user,
    id: req.params.id,
    reason: req.body?.reason,
  });
  res.status(result.outcome === 'CANCELLED' ? 200 : 202).json(result);
});

export const updateStatus = asyncHandler(async (req, res) => {
  const booking = await bookingService.updateBookingStatus({
    actor: req.user,
    id: req.params.id,
    status: req.body.status,
  });
  res.json({ booking });
});

export const frontDesk = asyncHandler(async (_req, res) => {
  res.json(await bookingService.getFrontDeskSummary());
});
