import { prisma } from '../lib/prisma.js';

const fullInclude = {
  booking: { include: { room: { include: { hotel: true } }, guest: true } },
  requestedBy: true,
  reviewedBy: true,
};

export const cancellationModel = {
  findById: (id) => prisma.cancellationRequest.findUnique({ where: { id }, include: fullInclude }),

  create: (data, tx = prisma) =>
    tx.cancellationRequest.create({ data, include: fullInclude }),

  update: (id, data, tx = prisma) =>
    tx.cancellationRequest.update({ where: { id }, data, include: fullInclude }),

  /** A booking may only have one request awaiting review at a time. */
  findPendingForBooking: (bookingId, tx = prisma) =>
    tx.cancellationRequest.findFirst({ where: { bookingId, status: 'PENDING' } }),

  list: ({ status, bookingId, requestedById, skip = 0, take = 50 } = {}) => {
    const where = {
      ...(status ? { status: Array.isArray(status) ? { in: status } : status } : {}),
      ...(bookingId ? { bookingId } : {}),
      ...(requestedById ? { requestedById } : {}),
    };
    return prisma.$transaction([
      prisma.cancellationRequest.findMany({
        where,
        include: fullInclude,
        // Oldest pending first: staff work the queue front to back.
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        skip,
        take,
      }),
      prisma.cancellationRequest.count({ where }),
    ]);
  },

  countPending: () => prisma.cancellationRequest.count({ where: { status: 'PENDING' } }),
};
