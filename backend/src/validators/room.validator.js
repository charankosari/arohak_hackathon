import { z } from 'zod';
import { dateString, pagination, roomStatusEnum, uuid } from './common.validator.js';

export const listRoomsSchema = pagination.extend({
  hotelId: uuid.optional(),
  roomType: z.string().trim().min(1).max(80).optional(),
  status: roomStatusEnum.optional(),
  minGuests: z.coerce.number().int().min(1).max(20).optional(),
  maxPrice: z.coerce.number().positive().max(10_000_000).optional(),
  search: z.string().trim().min(1).max(120).optional(),
});

export const createRoomSchema = z.object({
  hotelId: uuid,
  roomNumber: z.string().trim().min(1).max(20),
  roomType: z.string().trim().min(2).max(80),
  maxGuests: z.coerce.number().int().min(1).max(20),
  pricePerNight: z.coerce.number().positive().max(10_000_000),
  status: roomStatusEnum.default('AVAILABLE'),
  description: z.string().trim().max(2000).optional(),
  amenities: z.array(z.string().trim().min(1).max(80)).max(40).default([]),
});

/**
 * Declared explicitly rather than via createRoomSchema.partial(): `.partial()`
 * keeps `.default()`, so a PATCH of only `status` would also inject
 * `amenities: []` and silently wipe the room's amenity list.
 */
export const updateRoomSchema = z
  .object({
    roomNumber: z.string().trim().min(1).max(20),
    roomType: z.string().trim().min(2).max(80),
    maxGuests: z.coerce.number().int().min(1).max(20),
    pricePerNight: z.coerce.number().positive().max(10_000_000),
    status: roomStatusEnum,
    description: z.string().trim().max(2000),
    amenities: z.array(z.string().trim().min(1).max(80)).max(40),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'Provide at least one field to update');

/** Public availability search. */
export const searchAvailabilitySchema = z.object({
  hotelId: uuid.optional(),
  checkIn: dateString,
  checkOut: dateString,
  guests: z.coerce.number().int().min(1).max(20).default(1),
  roomType: z.string().trim().min(1).max(80).optional(),
  maxPrice: z.coerce.number().positive().max(10_000_000).optional(),
});

/** Availability of one specific room for a stay. */
export const roomAvailabilitySchema = z.object({
  checkIn: dateString,
  checkOut: dateString,
  guests: z.coerce.number().int().min(1).max(20).default(1),
});

export const roomCalendarSchema = z.object({
  from: dateString,
  to: dateString,
});

export const roomTypesSchema = z.object({ hotelId: uuid.optional() });
