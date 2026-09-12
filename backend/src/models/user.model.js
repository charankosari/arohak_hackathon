import { prisma } from '../lib/prisma.js';

/** Fields safe to return; never leaks passwordHash. */
const publicSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  phone: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

export const userModel = {
  /** Includes passwordHash - only for the login path. */
  findByEmailWithSecret: (email) =>
    prisma.user.findUnique({ where: { email: email.toLowerCase() } }),

  findById: (id) => prisma.user.findUnique({ where: { id }, select: publicSelect }),

  findByEmail: (email) =>
    prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: publicSelect }),

  create: (data) =>
    prisma.user.create({
      data: { ...data, email: data.email.toLowerCase() },
      select: publicSelect,
    }),

  update: (id, data) =>
    prisma.user.update({
      where: { id },
      data: data.email ? { ...data, email: data.email.toLowerCase() } : data,
      select: publicSelect,
    }),

  list: ({ role, search, skip = 0, take = 50 } = {}) => {
    const where = {
      ...(role ? { role } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return prisma.$transaction([
      prisma.user.findMany({ where, select: publicSelect, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.user.count({ where }),
    ]);
  },

  countByRole: () => prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
};
