import { z } from 'zod';

export const uuid = z.string().uuid('must be a valid id');

export const idParam = z.object({ id: uuid });

/** "YYYY-MM-DD". Calendar validity is re-checked in utils/dates.js. */
export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date in YYYY-MM-DD format');

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .email('must be a valid email address')
  .max(254);

export const password = z
  .string()
  .min(8, 'must be at least 8 characters')
  .max(128, 'must be at most 128 characters');

export const name = z.string().trim().min(2, 'must be at least 2 characters').max(120);

export const phone = z
  .string()
  .trim()
  .regex(/^[+0-9][0-9\s\-()]{5,19}$/, 'must be a valid phone number')
  .optional();

/** Query strings arrive as text, so numeric params are coerced. */
export const pagination = z.object({
  skip: z.coerce.number().int().min(0).default(0),
  take: z.coerce.number().int().min(1).max(100).default(50),
});

export const roleEnum = z.enum(['ADMIN', 'RECEPTIONIST', 'CUSTOMER']);
export const hotelStatusEnum = z.enum(['ACTIVE', 'INACTIVE']);
export const roomStatusEnum = z.enum(['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'OUT_OF_SERVICE']);
export const bookingStatusEnum = z.enum([
  'CONFIRMED',
  'CHECKED_IN',
  'CHECKED_OUT',
  'CANCELLED',
  'NO_SHOW',
]);
export const cancellationStatusEnum = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
