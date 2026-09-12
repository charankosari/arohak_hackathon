import { z } from 'zod';
import { email, hotelStatusEnum, pagination } from './common.validator.js';

const hotelCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{3,20}$/, 'must be 3-20 characters: letters, digits or hyphens');

export const listHotelsSchema = pagination.extend({
  status: hotelStatusEnum.optional(),
  city: z.string().trim().min(1).max(80).optional(),
  search: z.string().trim().min(1).max(120).optional(),
});

export const createHotelSchema = z.object({
  code: hotelCode,
  name: z.string().trim().min(2).max(160),
  address: z.string().trim().min(5).max(300),
  city: z.string().trim().min(2).max(80),
  description: z.string().trim().max(2000).optional(),
  contactNumber: z
    .string()
    .trim()
    .regex(/^[+0-9][0-9\s\-()]{5,19}$/, 'must be a valid contact number'),
  email,
  status: hotelStatusEnum.default('ACTIVE'),
});

/**
 * Declared explicitly rather than via createHotelSchema.partial(): `.partial()`
 * keeps `.default('ACTIVE')`, so renaming an INACTIVE hotel would silently put
 * it back on sale.
 */
export const updateHotelSchema = z
  .object({
    code: hotelCode,
    name: z.string().trim().min(2).max(160),
    address: z.string().trim().min(5).max(300),
    city: z.string().trim().min(2).max(80),
    description: z.string().trim().max(2000),
    contactNumber: z
      .string()
      .trim()
      .regex(/^[+0-9][0-9\s\-()]{5,19}$/, 'must be a valid contact number'),
    email,
    status: hotelStatusEnum,
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'Provide at least one field to update');
