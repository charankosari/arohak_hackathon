import { bookingModel } from '../models/booking.model.js';
import { roomModel } from '../models/room.model.js';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { formatDateOnly, nightsBetween, resolveStay } from '../utils/dates.js';
import { serializeRoom } from '../utils/serialize.js';

/**
 * Rooms a guest can actually book for a stay.
 *
 * A room qualifies when all of the following hold:
 *   - its hotel is ACTIVE
 *   - the room's operational status is AVAILABLE (not under maintenance etc.)
 *   - it seats the requested party
 *   - no CONFIRMED / CHECKED_IN booking overlaps the requested dates
 */
export async function searchAvailableRooms({
  hotelId,
  checkIn: checkInRaw,
  checkOut: checkOutRaw,
  guests = 1,
  roomType,
  maxPrice,
}) {
  const { checkIn, checkOut, nights } = resolveStay(checkInRaw, checkOutRaw);

  const blockedRoomIds = await bookingModel.findBlockedRoomIds({ hotelId, checkIn, checkOut });

  const rooms = await prisma.room.findMany({
    where: {
      status: 'AVAILABLE',
      hotel: { status: 'ACTIVE', ...(hotelId ? { id: hotelId } : {}) },
      maxGuests: { gte: guests },
      ...(roomType ? { roomType: { equals: roomType, mode: 'insensitive' } } : {}),
      ...(maxPrice ? { pricePerNight: { lte: maxPrice } } : {}),
      ...(blockedRoomIds.length ? { id: { notIn: blockedRoomIds } } : {}),
    },
    include: { hotel: true, images: { orderBy: { position: 'asc' } } },
    orderBy: [{ pricePerNight: 'asc' }, { roomNumber: 'asc' }],
  });

  return {
    stay: { checkIn: formatDateOnly(checkIn), checkOut: formatDateOnly(checkOut), nights, guests },
    count: rooms.length,
    rooms: rooms.map((room) => {
      const nightlyRate = Number(room.pricePerNight);
      return {
        ...serializeRoom(room),
        quote: {
          nights,
          nightlyRate,
          totalAmount: Number((nightlyRate * nights).toFixed(2)),
        },
      };
    }),
  };
}

/**
 * Assert that a specific room can take a stay, and return the pricing snapshot.
 * Runs inside the caller's transaction so the conflict check and the insert are
 * atomic.
 */
export async function assertRoomBookable({ roomId, checkIn, checkOut, guests, excludeBookingId }, tx = prisma) {
  const room = await tx.room.findUnique({ where: { id: roomId }, include: { hotel: true } });
  if (!room) throw ApiError.notFound('Room not found');

  if (room.hotel.status !== 'ACTIVE') {
    throw ApiError.conflict(`${room.hotel.name} is not currently accepting bookings`);
  }
  if (room.status !== 'AVAILABLE') {
    throw ApiError.conflict(
      `Room ${room.roomNumber} is marked ${room.status.toLowerCase().replace(/_/g, ' ')} and cannot be booked`
    );
  }
  if (guests > room.maxGuests) {
    throw ApiError.conflict(
      `Room ${room.roomNumber} (${room.roomType}) has a maximum capacity of ${room.maxGuests} guests`
    );
  }

  const conflicts = await bookingModel.findConflicts(
    { roomId, checkIn, checkOut, excludeBookingId },
    tx
  );
  if (conflicts.length) {
    const clash = conflicts[0];
    throw ApiError.conflict(
      `Room ${room.roomNumber} is already booked from ${formatDateOnly(clash.checkIn)} to ${formatDateOnly(clash.checkOut)}`
    );
  }

  const nights = nightsBetween(checkIn, checkOut);
  const nightlyRate = Number(room.pricePerNight);

  return {
    room,
    nights,
    nightlyRate,
    totalAmount: Number((nightlyRate * nights).toFixed(2)),
  };
}

/**
 * Non-throwing availability check for a single room and stay.
 *
 * `assertRoomBookable` throws on the first problem, which is right for the
 * booking path but wrong for a UI that wants to show the guest every reason
 * up front and offer an alternative date. This reports all of them.
 */
export async function checkRoomAvailability({ roomId, checkIn: checkInRaw, checkOut: checkOutRaw, guests = 1 }) {
  const { checkIn, checkOut, nights } = resolveStay(checkInRaw, checkOutRaw);

  const room = await roomModel.findByIdWithHotel(roomId);
  if (!room) throw ApiError.notFound('Room not found');

  const reasons = [];

  if (room.hotel.status !== 'ACTIVE') {
    reasons.push({
      code: 'HOTEL_INACTIVE',
      message: `${room.hotel.name} is not currently accepting bookings`,
    });
  }
  if (room.status !== 'AVAILABLE') {
    reasons.push({
      code: 'ROOM_STATUS',
      message: `This room is marked ${room.status.toLowerCase().replace(/_/g, ' ')} and cannot be booked`,
    });
  }
  if (guests > room.maxGuests) {
    reasons.push({
      code: 'OVER_CAPACITY',
      message: `This room sleeps at most ${room.maxGuests} ${room.maxGuests === 1 ? 'guest' : 'guests'}`,
    });
  }

  const conflicts = await bookingModel.findConflicts({ roomId, checkIn, checkOut });
  if (conflicts.length) {
    reasons.push({
      code: 'ALREADY_BOOKED',
      message: `This room is already booked from ${formatDateOnly(conflicts[0].checkIn)} to ${formatDateOnly(conflicts[0].checkOut)}`,
    });
  }

  // The latest checkout among the clashing bookings is the earliest date the
  // room frees up, so the UI can offer it as an alternative.
  const nextAvailableFrom = conflicts.length
    ? formatDateOnly(
        conflicts.reduce((latest, b) => (b.checkOut > latest ? b.checkOut : latest), conflicts[0].checkOut)
      )
    : null;

  const nightlyRate = Number(room.pricePerNight);

  return {
    roomId: room.id,
    checkIn: formatDateOnly(checkIn),
    checkOut: formatDateOnly(checkOut),
    guests,
    nights,
    available: reasons.length === 0,
    reasons,
    nextAvailableFrom,
    conflicts: conflicts.map((c) => ({
      checkIn: formatDateOnly(c.checkIn),
      checkOut: formatDateOnly(c.checkOut),
    })),
    quote: {
      nights,
      nightlyRate,
      totalAmount: Number((nightlyRate * nights).toFixed(2)),
    },
  };
}

/**
 * Day-by-day occupancy for one room across a window - drives the staff
 * availability calendar.
 */
export async function getRoomCalendar({ roomId, from, to }) {
  const room = await roomModel.findByIdWithHotel(roomId);
  if (!room) throw ApiError.notFound('Room not found');

  const { checkIn: start, checkOut: end } = resolveStay(from, to, { allowPast: true });

  const bookings = await prisma.booking.findMany({
    where: {
      roomId,
      status: { in: ['CONFIRMED', 'CHECKED_IN'] },
      checkIn: { lt: end },
      checkOut: { gt: start },
    },
    select: { id: true, reference: true, checkIn: true, checkOut: true, guestName: true, status: true },
    orderBy: { checkIn: 'asc' },
  });

  const days = [];
  for (let d = new Date(start); d < end; d = new Date(d.getTime() + 86400000)) {
    const occupying = bookings.find((b) => b.checkIn <= d && b.checkOut > d);
    days.push({
      date: formatDateOnly(d),
      available: room.status === 'AVAILABLE' && !occupying,
      // A room out of service is blocked regardless of bookings.
      blockedBy: occupying ? 'BOOKING' : room.status !== 'AVAILABLE' ? room.status : null,
      booking: occupying
        ? { id: occupying.id, reference: occupying.reference, guestName: occupying.guestName }
        : null,
    });
  }

  return {
    room: serializeRoom(room),
    from: formatDateOnly(start),
    to: formatDateOnly(end),
    days,
  };
}
