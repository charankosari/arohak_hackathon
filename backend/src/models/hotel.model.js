import { prisma } from '../lib/prisma.js';

export const hotelModel = {
  findById: (id) => prisma.hotel.findUnique({ where: { id } }),

  findByIdWithRooms: (id) =>
    prisma.hotel.findUnique({ where: { id }, include: { rooms: { orderBy: { roomNumber: 'asc' } } } }),

  findByCode: (code) => prisma.hotel.findUnique({ where: { code: code.toUpperCase() } }),

  create: (data) => prisma.hotel.create({ data: { ...data, code: data.code.toUpperCase() } }),

  update: (id, data) =>
    prisma.hotel.update({
      where: { id },
      data: data.code ? { ...data, code: data.code.toUpperCase() } : data,
    }),

  delete: (id) => prisma.hotel.delete({ where: { id } }),

  list: ({ status, city, search, skip = 0, take = 50 } = {}) => {
    const where = {
      ...(status ? { status } : {}),
      ...(city ? { city: { equals: city, mode: 'insensitive' } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
              { city: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return prisma.$transaction([
      prisma.hotel.findMany({
        where,
        include: { _count: { select: { rooms: true } } },
        orderBy: { name: 'asc' },
        skip,
        take,
      }),
      prisma.hotel.count({ where }),
    ]);
  },

  countActiveBookings: (hotelId) =>
    prisma.booking.count({
      where: { hotelId, status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
    }),

  /** Any booking at all, including cancelled ones still held for history. */
  countAllBookings: (hotelId) => prisma.booking.count({ where: { hotelId } }),
};
