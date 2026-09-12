import { hotelRules } from '../config/env.js';
import { ApiError } from './ApiError.js';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Parse a "YYYY-MM-DD" string into a UTC-midnight Date, which is how Postgres
 * `date` columns round-trip through Prisma. Rejects impossible calendar dates
 * such as 2026-02-31, which the Date constructor would silently roll over.
 */
export function parseDateOnly(value, field = 'date') {
  if (typeof value !== 'string' || !DATE_ONLY.test(value)) {
    throw ApiError.badRequest(`${field} must be a calendar date in YYYY-MM-DD format`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || formatDateOnly(date) !== value) {
    throw ApiError.badRequest(`${field} is not a valid calendar date`);
  }
  return date;
}

/** Render a Date as "YYYY-MM-DD" in UTC. */
export function formatDateOnly(date) {
  return new Date(date).toISOString().slice(0, 10);
}

/** Whole nights between two date-only values. */
export function nightsBetween(checkIn, checkOut) {
  return Math.round((checkOut.getTime() - checkIn.getTime()) / MS_PER_DAY);
}

/** Today's date in the hotel's local timezone, as a UTC-midnight Date. */
export function hotelToday(now = new Date()) {
  const shifted = new Date(now.getTime() + hotelRules.timezoneOffsetMinutes * 60 * 1000);
  return new Date(`${shifted.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

/**
 * The exact instant check-in opens for a stay: the check-in date at 2:00 PM
 * hotel local time, expressed as a real UTC timestamp.
 */
export function checkInInstant(checkInDate) {
  const utcMidnight = new Date(checkInDate).getTime();
  const localOffsetMs = hotelRules.timezoneOffsetMinutes * 60 * 1000;
  const checkInOffsetMs = hotelRules.checkInHour * 60 * 60 * 1000;
  return new Date(utcMidnight + checkInOffsetMs - localOffsetMs);
}

/**
 * Deadline for a guest to cancel without staff review: 24 hours before
 * check-in opens. For a 20 September stay this lands on 19 September, 2:00 PM
 * IST, matching the worked example in PDF section 3.
 */
export function directCancellationDeadline(checkInDate) {
  return new Date(
    checkInInstant(checkInDate).getTime() -
      hotelRules.directCancellationWindowHours * 60 * 60 * 1000
  );
}

/**
 * Validate a requested stay and return the parsed range plus night count.
 * Enforces: valid dates, check-out after check-in, no stays in the past, and a
 * sane upper bound on length.
 */
export function resolveStay(checkInRaw, checkOutRaw, { allowPast = false, now = new Date() } = {}) {
  const checkIn = parseDateOnly(checkInRaw, 'checkIn');
  const checkOut = parseDateOnly(checkOutRaw, 'checkOut');

  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1) {
    throw ApiError.badRequest('checkOut must be at least one night after checkIn');
  }
  if (nights > hotelRules.maxStayNights) {
    throw ApiError.badRequest(
      `Stays are limited to ${hotelRules.maxStayNights} nights; contact reservations for longer stays`
    );
  }
  if (!allowPast && checkIn < hotelToday(now)) {
    throw ApiError.badRequest('checkIn cannot be in the past');
  }

  return { checkIn, checkOut, nights };
}
