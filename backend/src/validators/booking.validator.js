import { z } from 'zod';
import {
  bookingStatusEnum,
  dateString,
  email,
  name,
  pagination,
  phone,
  uuid,
} from './common.validator.js';

export const listBookingsSchema = pagination.extend({
  // Ignored for customers - the service pins the list to their own account.
  guestId: uuid.optional(),
  hotelId: uuid.optional(),
  roomId: uuid.optional(),
  status: z
    .union([bookingStatusEnum, z.array(bookingStatusEnum)])
    .optional()
    .transform((v) => (typeof v === 'string' ? v : v)),
  reference: z.string().trim().min(3).max(20).optional(),
  from: dateString.optional(),
  to: dateString.optional(),
});

export const createBookingSchema = z.object({
  roomId: uuid,
  checkIn: dateString,
  checkOut: dateString,
  guests: z.coerce.number().int().min(1).max(20),
  specialRequests: z.string().trim().max(1000).optional(),

  // Staff-only fields, used when booking on behalf of a guest. Ignored when a
  // customer books for themselves.
  guestId: uuid.optional(),
  guestName: name.optional(),
  guestEmail: email.optional(),
  guestPhone: phone,
});

export const modifyBookingSchema = z.object({
  checkIn: dateString,
  checkOut: dateString,
  guests: z.coerce.number().int().min(1).max(20).optional(),
});

export const cancelBookingSchema = z.object({
  reason: z.string().trim().min(3).max(500).optional(),
});

/** Front-desk transitions only; cancellation goes through its own endpoint. */
export const updateBookingStatusSchema = z.object({
  status: z.enum(['CHECKED_IN', 'CHECKED_OUT', 'NO_SHOW']),
});
