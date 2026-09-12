import { cache, cacheKeys, fingerprint, TTL } from '../lib/cache.js';
import { hotelModel } from '../models/hotel.model.js';
import { roomModel } from '../models/room.model.js';
import { ApiError } from '../utils/ApiError.js';
import { serializeRoom } from '../utils/serialize.js';

const isStaff = (role) => role === 'ADMIN' || role === 'RECEPTIONIST';

export async function listRooms({ actor, query }) {
  const filters = {
    hotelId: query.hotelId,
    roomType: query.roomType,
    // Guests browse the catalogue; only staff can filter by operational status.
    status: isStaff(actor?.role) ? query.status : undefined,
    minGuests: query.minGuests,
    maxPrice: query.maxPrice,
    search: query.search,
    skip: query.skip,
    take: query.take,
  };

  const key = cacheKeys.roomList(fingerprint({ ...filters, staff: isStaff(actor?.role) }));
  return cache.wrap(key, TTL.rooms, async () => {
    const [rooms, total] = await roomModel.list(filters);
    return { total, rooms: rooms.map(serializeRoom) };
  });
}

export async function getRoom(id) {
  const room = await roomModel.findByIdWithHotel(id);
  if (!room) throw ApiError.notFound('Room not found');
  return serializeRoom(room);
}

/** Distinct room types with price/capacity ranges - powers the browse filters. */
export async function getRoomTypes(hotelId) {
  const key = cacheKeys.roomTypes(hotelId);
  return cache.wrap(key, TTL.roomTypes, async () => {
    const rows = await roomModel.typeSummary(hotelId);
    return {
      types: rows
        .map((r) => ({
          roomType: r.roomType,
          rooms: r._count._all,
          minPrice: Number(r._min.pricePerNight),
          maxPrice: Number(r._max.pricePerNight),
          minGuests: r._min.maxGuests,
          maxGuests: r._max.maxGuests,
        }))
        .sort((a, b) => a.minPrice - b.minPrice),
    };
  });
}

export async function createRoom(payload) {
  const hotel = await hotelModel.findById(payload.hotelId);
  if (!hotel) throw ApiError.badRequest('hotelId does not match any hotel');

  const clash = await roomModel.findByNumber(payload.hotelId, payload.roomNumber);
  if (clash) {
    throw ApiError.conflict(`Room ${payload.roomNumber} already exists at ${hotel.name}`);
  }

  const room = await roomModel.create(payload);
  await cache.invalidateRooms();
  return serializeRoom(room);
}

export async function updateRoom(id, payload) {
  const existing = await roomModel.findById(id);
  if (!existing) throw ApiError.notFound('Room not found');

  if (payload.roomNumber && payload.roomNumber !== existing.roomNumber) {
    const clash = await roomModel.findByNumber(existing.hotelId, payload.roomNumber);
    if (clash) throw ApiError.conflict(`Room ${payload.roomNumber} already exists at this hotel`);
  }

  const room = await roomModel.update(id, payload);
  await cache.invalidateRooms();
  return serializeRoom(room);
}

/**
 * A receptionist runs the floor but is not an administrator: they may change a
 * room's operational status (and its description), not its commercial terms.
 */
const RECEPTIONIST_EDITABLE = new Set(['status', 'description']);

export function assertRoomUpdateAllowed(role, payload) {
  if (role === 'ADMIN') return;

  const attempted = Object.keys(payload).filter((k) => payload[k] !== undefined);
  const forbidden = attempted.filter((k) => !RECEPTIONIST_EDITABLE.has(k));
  if (forbidden.length) {
    throw ApiError.forbidden(
      `Receptionists may only update: ${[...RECEPTIONIST_EDITABLE].join(', ')}. ` +
        `Requires an administrator: ${forbidden.join(', ')}.`
    );
  }
}

export async function deleteRoom(id) {
  const existing = await roomModel.findById(id);
  if (!existing) throw ApiError.notFound('Room not found');

  // Bookings reference rooms with ON DELETE RESTRICT, and cancelled bookings
  // are kept for history - so any booking at all blocks deletion, not just
  // live ones. Checking here turns a database error into a clear 409.
  const [activeBookings, allBookings] = await Promise.all([
    roomModel.countActiveBookings(id),
    roomModel.countAllBookings(id),
  ]);
  if (activeBookings > 0) {
    throw ApiError.conflict(
      `Room ${existing.roomNumber} has ${activeBookings} active booking(s). ` +
        'Set its status to OUT_OF_SERVICE instead of deleting it.'
    );
  }
  if (allBookings > 0) {
    throw ApiError.conflict(
      `Room ${existing.roomNumber} has ${allBookings} booking(s) in its history, which must be ` +
        'preserved. Set its status to OUT_OF_SERVICE instead of deleting it.'
    );
  }

  await roomModel.delete(id);
  await cache.invalidateRooms();
  return { message: `Room ${existing.roomNumber} deleted` };
}
