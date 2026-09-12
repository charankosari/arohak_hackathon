import { prisma } from '../lib/prisma.js';
import { bookingModel } from '../models/booking.model.js';
import { cancellationModel } from '../models/cancellation.model.js';
import { userModel } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { formatDateOnly, hotelToday, parseDateOnly, resolveStay } from '../utils/dates.js';
import { hashPassword } from '../utils/password.js';
import { generateBookingReference } from '../utils/reference.js';
import { serializeBooking, serializeCancellationRequest } from '../utils/serialize.js';
import { assertRoomBookable } from './availability.service.js';
import { evaluateCancellation } from './cancellationPolicy.js';
import { cache, cacheKeys } from '../lib/cache.js';

const isStaff = (role) => role === 'ADMIN' || role === 'RECEPTIONIST';

/** Customers may only ever touch their own reservations. */
function assertCanViewBooking(booking, actor) {
  if (isStaff(actor.role)) return;
  if (booking.guestId !== actor.id) {
    // 404 rather than 403, so booking IDs of other guests are not enumerable.
    throw ApiError.notFound('Booking not found');
  }
}

/**
 * Resolve which customer account a booking belongs to.
 * Guests book for themselves; staff may book on behalf of a guest, creating a
 * customer account on the fly for a walk-in.
 */
async function resolveGuestAccount({ actor, payload }) {
  if (!isStaff(actor.role)) {
    const self = await userModel.findById(actor.id);
    return {
      guest: self,
      guestName: payload.guestName?.trim() || self.name,
      guestEmail: self.email,
      guestPhone: payload.guestPhone?.trim() || self.phone || null,
      accountCreated: false,
    };
  }

  if (payload.guestId) {
    const guest = await userModel.findById(payload.guestId);
    if (!guest) throw ApiError.badRequest('guestId does not match any user account');
    return {
      guest,
      guestName: payload.guestName?.trim() || guest.name,
      guestEmail: guest.email,
      guestPhone: payload.guestPhone?.trim() || guest.phone || null,
      accountCreated: false,
    };
  }

  if (!payload.guestEmail || !payload.guestName) {
    throw ApiError.badRequest(
      'Staff bookings require either guestId, or guestName and guestEmail for a new guest'
    );
  }

  const existing = await userModel.findByEmail(payload.guestEmail);
  if (existing) {
    return {
      guest: existing,
      guestName: payload.guestName.trim(),
      guestEmail: existing.email,
      guestPhone: payload.guestPhone?.trim() || existing.phone || null,
      accountCreated: false,
    };
  }

  // Walk-in with no account yet: provision one so the guest can later log in
  // (via a password reset) and see their booking.
  const created = await userModel.create({
    name: payload.guestName.trim(),
    email: payload.guestEmail,
    passwordHash: await hashPassword(generateBookingReference() + generateBookingReference()),
    role: 'CUSTOMER',
    phone: payload.guestPhone?.trim() || null,
  });
  return {
    guest: created,
    guestName: created.name,
    guestEmail: created.email,
    guestPhone: created.phone,
    accountCreated: true,
  };
}

export async function createBooking({ actor, payload }) {
  const { checkIn, checkOut } = resolveStay(payload.checkIn, payload.checkOut);
  const guestInfo = await resolveGuestAccount({ actor, payload });

  // Serializable isolation closes the window where two concurrent requests
  // both pass the conflict check and double-book the same room.
  const booking = await prisma.$transaction(
    async (tx) => {
      const quote = await assertRoomBookable(
        { roomId: payload.roomId, checkIn, checkOut, guests: payload.guests },
        tx
      );

      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          return await bookingModel.create(
            {
              reference: generateBookingReference(),
              hotelId: quote.room.hotelId,
              roomId: quote.room.id,
              guestId: guestInfo.guest.id,
              createdById: actor.id,
              guestName: guestInfo.guestName,
              guestEmail: guestInfo.guestEmail,
              guestPhone: guestInfo.guestPhone,
              checkIn,
              checkOut,
              guests: payload.guests,
              nights: quote.nights,
              nightlyRate: quote.nightlyRate,
              totalAmount: quote.totalAmount,
              specialRequests: payload.specialRequests?.trim() || null,
            },
            tx
          );
        } catch (error) {
          // P2002 = unique violation; only the generated reference can collide.
          if (error?.code !== 'P2002') throw error;
        }
      }
      throw ApiError.conflict('Could not allocate a booking reference, please retry');
    },
    { isolationLevel: 'Serializable' }
  );

  await cache.invalidateAvailability();
  return { booking: serializeBooking(booking), guestAccountCreated: guestInfo.accountCreated };
}

export async function listBookings({ actor, query }) {
  const filters = {
    // A customer's list is pinned to their own account, whatever they ask for.
    guestId: isStaff(actor.role) ? query.guestId : actor.id,
    hotelId: query.hotelId,
    roomId: query.roomId,
    status: query.status,
    reference: query.reference,
    from: query.from ? parseDateOnly(query.from, 'from') : undefined,
    to: query.to ? parseDateOnly(query.to, 'to') : undefined,
    skip: query.skip,
    take: query.take,
  };

  const [bookings, total] = await bookingModel.list(filters);
  return { total, bookings: bookings.map(serializeBooking) };
}

export async function getBooking({ actor, id }) {
  const booking = await bookingModel.findById(id);
  if (!booking) throw ApiError.notFound('Booking not found');
  assertCanViewBooking(booking, actor);

  return {
    booking: serializeBooking(booking),
    cancellationPolicy: evaluateCancellation({ booking, actorRole: actor.role }),
  };
}

/** Read-only preview so the UI can warn the guest before they commit. */
export async function previewCancellation({ actor, id }) {
  const booking = await bookingModel.findById(id);
  if (!booking) throw ApiError.notFound('Booking not found');
  assertCanViewBooking(booking, actor);
  return evaluateCancellation({ booking, actorRole: actor.role });
}

/**
 * Cancel a booking, or raise a review request when the guest is outside the
 * 24-hour window. The return value says which of the two happened.
 */
export async function cancelBooking({ actor, id, reason }) {
  const booking = await bookingModel.findById(id);
  if (!booking) throw ApiError.notFound('Booking not found');
  assertCanViewBooking(booking, actor);

  const policy = evaluateCancellation({ booking, actorRole: actor.role });
  if (!policy.allowed) throw ApiError.conflict(policy.reason);

  if (policy.outcome === 'IMMEDIATE') {
    const updated = await bookingModel.update(id, {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledById: actor.id,
      cancellationReason: reason?.trim() || null,
    });
    await cache.invalidateAvailability();
    return { outcome: 'CANCELLED', policy, booking: serializeBooking(updated) };
  }

  // Outside the window: queue it for staff and leave the booking confirmed.
  const existing = await cancellationModel.findPendingForBooking(id);
  if (existing) {
    throw ApiError.conflict(
      'A cancellation request for this booking is already awaiting staff review'
    );
  }
  if (!reason || !reason.trim()) {
    throw ApiError.badRequest('A reason is required when requesting a late cancellation');
  }

  const request = await cancellationModel.create({
    bookingId: id,
    requestedById: actor.id,
    reason: reason.trim(),
  });

  return {
    outcome: 'REVIEW_REQUESTED',
    policy,
    booking: serializeBooking(booking),
    cancellationRequest: serializeCancellationRequest(request),
  };
}

/**
 * Move a booking's dates. PDF section 3: modifications depend on availability
 * and are not guaranteed until confirmed.
 */
export async function modifyBookingDates({
  actor,
  id,
  checkIn: checkInRaw,
  checkOut: checkOutRaw,
  guests,
}) {
  const existing = await bookingModel.findById(id);
  if (!existing) throw ApiError.notFound('Booking not found');
  assertCanViewBooking(existing, actor);

  if (existing.status !== 'CONFIRMED') {
    throw ApiError.conflict(
      `Only confirmed bookings can be modified; this booking is ${existing.status.toLowerCase()}`
    );
  }

  const { checkIn, checkOut } = resolveStay(checkInRaw, checkOutRaw);
  const partySize = guests ?? existing.guests;

  const updated = await prisma.$transaction(
    async (tx) => {
      const quote = await assertRoomBookable(
        { roomId: existing.roomId, checkIn, checkOut, guests: partySize, excludeBookingId: id },
        tx
      );
      return bookingModel.update(
        id,
        {
          checkIn,
          checkOut,
          guests: partySize,
          nights: quote.nights,
          // Re-price at the room's current rate for the new stay length.
          nightlyRate: quote.nightlyRate,
          totalAmount: quote.totalAmount,
        },
        tx
      );
    },
    { isolationLevel: 'Serializable' }
  );

  await cache.invalidateAvailability();
  return serializeBooking(updated);
}

/** Front-desk status transitions. Staff only - enforced at the route layer. */
const ALLOWED_TRANSITIONS = {
  CONFIRMED: ['CHECKED_IN', 'NO_SHOW'],
  CHECKED_IN: ['CHECKED_OUT'],
};

export async function updateBookingStatus({ actor, id, status }) {
  const booking = await bookingModel.findById(id);
  if (!booking) throw ApiError.notFound('Booking not found');

  const allowed = ALLOWED_TRANSITIONS[booking.status] ?? [];
  if (!allowed.includes(status)) {
    throw ApiError.conflict(
      `Cannot move a ${booking.status} booking to ${status}` +
        (allowed.length ? `. Allowed next states: ${allowed.join(', ')}` : '')
    );
  }

  const updated = await bookingModel.update(id, { status });
  await cache.invalidateAvailability();
  return serializeBooking(updated);
}

/** Today's arrivals, departures and in-house counts for the front desk. */
export async function getFrontDeskSummary() {
  const today = hotelToday();
  const [arrivals, departures, statusCounts, pendingCancellations] = await Promise.all([
    bookingModel.arrivalsOn(today),
    bookingModel.departuresOn(today),
    bookingModel.statusCounts(),
    cancellationModel.countPending(),
  ]);

  return {
    date: formatDateOnly(today),
    arrivals: arrivals.map(serializeBooking),
    departures: departures.map(serializeBooking),
    bookingsByStatus: Object.fromEntries(statusCounts.map((r) => [r.status, r._count._all])),
    pendingCancellationRequests: pendingCancellations,
  };
}

export { cacheKeys };
