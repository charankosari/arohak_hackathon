import { prisma } from '../lib/prisma.js';

/** Statuses that still hold a room and therefore block other bookings. */
export const BLOCKING_STATUSES = ['CONFIRMED', 'CHECKED_IN'];

const fullInclude = {
  room: { include: { hotel: true, images: { orderBy: { position: 'asc' } } } },
  hotel: true,
  guest: true,
  cancellationRequests: {
    orderBy: { createdAt: 'desc' },
    include: { requestedBy: true, reviewedBy: true },
  },
};

/**
 * Two half-open date ranges [inA, outA) and [inB, outB) overlap when
 * inA < outB AND outA > inB. Same-day turnover (one guest out, next in) is
 * therefore allowed.
 */
const overlaps = (checkIn, checkOut) => ({
  checkIn: { lt: checkOut },
  checkOut: { gt: checkIn },
});

export const bookingModel = {
  findById: (id) => prisma.booking.findUnique({ where: { id }, include: fullInclude }),

  findByReference: (reference) =>
    prisma.booking.findUnique({ where: { reference: reference.toUpperCase() }, include: fullInclude }),

  create: (data, tx = prisma) => tx.booking.create({ data, include: fullInclude }),

  update: (id, data, tx = prisma) => tx.booking.update({ where: { id }, data, include: fullInclude }),

  list: ({ guestId, hotelId, roomId, status, reference, from, to, skip = 0, take = 50 } = {}) => {
    const where = {
      ...(guestId ? { guestId } : {}),
      ...(hotelId ? { hotelId } : {}),
      ...(roomId ? { roomId } : {}),
      ...(status ? { status: Array.isArray(status) ? { in: status } : status } : {}),
      ...(reference ? { reference: { contains: reference.toUpperCase() } } : {}),
      ...(from || to
        ? { checkIn: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    };
    return prisma.$transaction([
      prisma.booking.findMany({
        where,
        include: fullInclude,
        orderBy: [{ checkIn: 'desc' }, { createdAt: 'desc' }],
        skip,
        take,
      }),
      prisma.booking.count({ where }),
    ]);
  },

  /**
   * Bookings that would clash with the given stay on a specific room.
   * `excludeBookingId` lets a date modification ignore its own reservation.
   */
  findConflicts: ({ roomId, checkIn, checkOut, excludeBookingId }, tx = prisma) =>
    tx.booking.findMany({
      where: {
        roomId,
        status: { in: BLOCKING_STATUSES },
        ...overlaps(checkIn, checkOut),
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      },
      select: { id: true, reference: true, checkIn: true, checkOut: true },
    }),

  /** Room IDs already taken for a stay - used to filter the search results. */
  findBlockedRoomIds: async ({ hotelId, checkIn, checkOut }) => {
    const rows = await prisma.booking.findMany({
      where: {
        status: { in: BLOCKING_STATUSES },
        ...(hotelId ? { hotelId } : {}),
        ...overlaps(checkIn, checkOut),
      },
      select: { roomId: true },
      distinct: ['roomId'],
    });
    return rows.map((r) => r.roomId);
  },

  /** Dashboard counters. */
  statusCounts: (where = {}) =>
    prisma.booking.groupBy({ by: ['status'], where, _count: { _all: true } }),

  revenueSum: (where = {}) =>
    prisma.booking.aggregate({
      where: { ...where, status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] } },
      _sum: { totalAmount: true },
    }),

  arrivalsOn: (date) =>
    prisma.booking.findMany({
      where: { checkIn: date, status: { in: BLOCKING_STATUSES } },
      include: fullInclude,
      orderBy: { createdAt: 'asc' },
    }),

  departuresOn: (date) =>
    prisma.booking.findMany({
      where: { checkOut: date, status: { in: ['CHECKED_IN', 'CONFIRMED'] } },
      include: fullInclude,
      orderBy: { createdAt: 'asc' },
    }),
};
