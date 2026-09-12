import { cache } from '../lib/cache.js';
import { prisma } from '../lib/prisma.js';
import { bookingModel } from '../models/booking.model.js';
import { cancellationModel } from '../models/cancellation.model.js';
import { ApiError } from '../utils/ApiError.js';
import { serializeCancellationRequest } from '../utils/serialize.js';

const isStaff = (role) => role === 'ADMIN' || role === 'RECEPTIONIST';

export async function listCancellationRequests({ actor, query }) {
  const filters = {
    status: query.status,
    bookingId: query.bookingId,
    // Guests only ever see the requests they raised themselves.
    requestedById: isStaff(actor.role) ? query.requestedById : actor.id,
    skip: query.skip,
    take: query.take,
  };

  const [requests, total] = await cancellationModel.list(filters);
  return { total, requests: requests.map(serializeCancellationRequest) };
}

export async function getCancellationRequest({ actor, id }) {
  const request = await cancellationModel.findById(id);
  if (!request) throw ApiError.notFound('Cancellation request not found');

  if (!isStaff(actor.role) && request.requestedById !== actor.id) {
    throw ApiError.notFound('Cancellation request not found');
  }
  return serializeCancellationRequest(request);
}

/**
 * Staff decision on a late cancellation request (PDF section 3):
 *   - APPROVED  -> the booking becomes CANCELLED
 *   - REJECTED  -> the booking stays active/confirmed
 *
 * Both sides are written in one transaction so a request can never be marked
 * approved while its booking stays confirmed.
 */
export async function reviewCancellationRequest({ actor, id, decision, reviewNote }) {
  const request = await cancellationModel.findById(id);
  if (!request) throw ApiError.notFound('Cancellation request not found');

  if (request.status !== 'PENDING') {
    throw ApiError.conflict(
      `This request was already ${request.status.toLowerCase()} and cannot be reviewed again`
    );
  }

  const booking = await bookingModel.findById(request.bookingId);
  if (!booking) throw ApiError.notFound('The booking for this request no longer exists');

  if (decision === 'APPROVED' && booking.status === 'CANCELLED') {
    throw ApiError.conflict('This booking has already been cancelled');
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedRequest = await cancellationModel.update(
      id,
      {
        status: decision,
        reviewedById: actor.id,
        reviewNote: reviewNote?.trim() || null,
        reviewedAt: new Date(),
      },
      tx
    );

    if (decision === 'APPROVED') {
      await bookingModel.update(
        request.bookingId,
        {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledById: actor.id,
          cancellationReason: request.reason,
        },
        tx
      );
    }

    return updatedRequest;
  });

  if (decision === 'APPROVED') await cache.invalidateAvailability();

  return {
    decision,
    request: serializeCancellationRequest(result),
    // Re-read so the caller sees the booking's post-decision state.
    booking: await bookingModel.findById(request.bookingId).then((b) => ({
      id: b.id,
      reference: b.reference,
      status: b.status,
    })),
  };
}

export const countPending = () => cancellationModel.countPending();
