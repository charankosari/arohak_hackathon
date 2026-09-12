import { prisma } from '../lib/prisma.js';

export const roomModel = {
  findById: (id) => prisma.room.findUnique({ where: { id } }),

  findByIdWithHotel: (id) => prisma.room.findUnique({ where: { id }, include: { hotel: true } }),

  findByNumber: (hotelId, roomNumber) =>
    prisma.room.findUnique({ where: { hotelId_roomNumber: { hotelId, roomNumber } } }),

  create: (data) => prisma.room.create({ data, include: { hotel: true } }),

  update: (id, data) => prisma.room.update({ where: { id }, data, include: { hotel: true } }),

  delete: (id) => prisma.room.delete({ where: { id } }),

  list: ({ hotelId, roomType, status, minGuests, maxPrice, search, skip = 0, take = 100 } = {}) => {
    const where = {
      ...(hotelId ? { hotelId } : {}),
      ...(roomType ? { roomType: { equals: roomType, mode: 'insensitive' } } : {}),
      ...(status ? { status } : {}),
      ...(minGuests ? { maxGuests: { gte: minGuests } } : {}),
      ...(maxPrice ? { pricePerNight: { lte: maxPrice } } : {}),
      ...(search
        ? {
            OR: [
              { roomNumber: { contains: search, mode: 'insensitive' } },
              { roomType: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return prisma.$transaction([
      prisma.room.findMany({
        where,
        include: { hotel: true },
        orderBy: [{ pricePerNight: 'asc' }, { roomNumber: 'asc' }],
        skip,
        take,
      }),
      prisma.room.count({ where }),
    ]);
  },

  /** Distinct room types with their price range - powers frontend filters. */
  typeSummary: (hotelId) =>
    prisma.room.groupBy({
      by: ['roomType'],
      where: hotelId ? { hotelId } : undefined,
      _min: { pricePerNight: true, maxGuests: true },
      _max: { pricePerNight: true, maxGuests: true },
      _count: { _all: true },
    }),

  countActiveBookings: (roomId) =>
    prisma.booking.count({ where: { roomId, status: { in: ['CONFIRMED', 'CHECKED_IN'] } } }),

  /** Any booking at all, including cancelled ones still held for history. */
  countAllBookings: (roomId) => prisma.booking.count({ where: { roomId } }),
};
