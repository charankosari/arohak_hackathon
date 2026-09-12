import { cache, cacheKeys, fingerprint, TTL } from '../lib/cache.js';
import { hotelModel } from '../models/hotel.model.js';
import { ApiError } from '../utils/ApiError.js';
import { serializeHotel } from '../utils/serialize.js';

const isStaff = (role) => role === 'ADMIN' || role === 'RECEPTIONIST';

export async function listHotels({ actor, query }) {
  // Guests only ever see hotels that are open for business.
  const status = isStaff(actor?.role) ? query.status : 'ACTIVE';
  const filters = {
    status,
    city: query.city,
    search: query.search,
    skip: query.skip,
    take: query.take,
  };

  const key = cacheKeys.hotelList(fingerprint(filters));
  return cache.wrap(key, TTL.hotels, async () => {
    const [hotels, total] = await hotelModel.list(filters);
    return { total, hotels: hotels.map(serializeHotel) };
  });
}

export async function getHotel({ actor, id }) {
  const hotel = await hotelModel.findByIdWithRooms(id);
  if (!hotel) throw ApiError.notFound('Hotel not found');

  if (!isStaff(actor?.role) && hotel.status !== 'ACTIVE') {
    throw ApiError.notFound('Hotel not found');
  }
  return serializeHotel(hotel);
}

export async function createHotel(payload) {
  const existing = await hotelModel.findByCode(payload.code);
  if (existing) {
    throw ApiError.conflict(`Hotel code ${payload.code.toUpperCase()} is already in use`);
  }

  const hotel = await hotelModel.create(payload);
  await cache.invalidateHotels();
  return serializeHotel(hotel);
}

export async function updateHotel(id, payload) {
  const existing = await hotelModel.findById(id);
  if (!existing) throw ApiError.notFound('Hotel not found');

  if (payload.code) {
    const clash = await hotelModel.findByCode(payload.code);
    if (clash && clash.id !== id) {
      throw ApiError.conflict(`Hotel code ${payload.code.toUpperCase()} is already in use`);
    }
  }

  const hotel = await hotelModel.update(id, payload);
  await cache.invalidateHotels();
  return serializeHotel(hotel);
}

/**
 * Deleting a hotel would orphan its booking history, so it is refused while
 * live reservations exist. Deactivating is the normal way to take a property
 * off sale.
 */
export async function deleteHotel(id) {
  const existing = await hotelModel.findById(id);
  if (!existing) throw ApiError.notFound('Hotel not found');

  const [activeBookings, allBookings] = await Promise.all([
    hotelModel.countActiveBookings(id),
    hotelModel.countAllBookings(id),
  ]);
  if (activeBookings > 0) {
    throw ApiError.conflict(
      `${existing.name} has ${activeBookings} active booking(s). ` +
        'Set its status to INACTIVE instead of deleting it.'
    );
  }
  if (allBookings > 0) {
    throw ApiError.conflict(
      `${existing.name} has ${allBookings} booking(s) in its history, which must be preserved. ` +
        'Set its status to INACTIVE instead of deleting it.'
    );
  }

  await hotelModel.delete(id);
  await cache.invalidateHotels();
  return { message: `${existing.name} deleted` };
}
