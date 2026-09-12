import { hotelRules } from '../config/env.js';
import { directCancellationDeadline, formatDateOnly } from '../utils/dates.js';

/** Statuses from which no cancellation is possible at all. */
const TERMINAL_STATUSES = {
  CANCELLED: 'This booking has already been cancelled.',
  CHECKED_OUT: 'This stay has already been completed and cannot be cancelled.',
  NO_SHOW: 'This booking is closed as a no-show and cannot be cancelled.',
};

/**
 * Decide what cancelling a booking means right now.
 *
 * Encodes PDF section 3:
 *   - a guest may cancel directly until 24 hours before check-in;
 *   - after that deadline the request goes to staff for review;
 *   - an already-cancelled booking cannot be cancelled again;
 *   - staff may cancel at any time, bypassing the deadline.
 *
 * Returns a plain object so it can be reused by the API, the UI preview
 * endpoint, and later by the chatbot.
 */
export function evaluateCancellation({ booking, actorRole, now = new Date() }) {
  const deadline = directCancellationDeadline(booking.checkIn);
  const isStaff = actorRole === 'ADMIN' || actorRole === 'RECEPTIONIST';

  const base = {
    bookingReference: booking.reference,
    bookingStatus: booking.status,
    checkIn: formatDateOnly(booking.checkIn),
    directCancellationDeadline: deadline.toISOString(),
    windowHours: hotelRules.directCancellationWindowHours,
    withinFreeWindow: now <= deadline,
  };

  const terminalReason = TERMINAL_STATUSES[booking.status];
  if (terminalReason) {
    return { ...base, outcome: 'BLOCKED', allowed: false, reason: terminalReason };
  }

  if (booking.status === 'CHECKED_IN' && !isStaff) {
    return {
      ...base,
      outcome: 'BLOCKED',
      allowed: false,
      reason: 'You have already checked in. Please speak to reception about ending your stay early.',
    };
  }

  if (isStaff) {
    return {
      ...base,
      outcome: 'IMMEDIATE',
      allowed: true,
      reason: now <= deadline
        ? 'Within the 24-hour direct-cancellation window.'
        : 'Staff override: cancelled outside the guest self-service window.',
    };
  }

  if (now <= deadline) {
    return {
      ...base,
      outcome: 'IMMEDIATE',
      allowed: true,
      reason: `You can cancel this booking directly until ${deadline.toISOString()} (24 hours before check-in).`,
    };
  }

  return {
    ...base,
    outcome: 'REVIEW_REQUIRED',
    allowed: true,
    reason:
      'The 24-hour direct-cancellation window has closed, so this request will be submitted to hotel staff for review. ' +
      'Your booking stays confirmed until a decision is made.',
  };
}
