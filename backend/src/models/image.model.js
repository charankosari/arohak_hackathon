import { prisma } from '../lib/prisma.js';

export const imageModel = {
  findById: (id) => prisma.image.findUnique({ where: { id } }),

  listFor: (where) => prisma.image.findMany({ where, orderBy: { position: 'asc' } }),

  countFor: (where) => prisma.image.count({ where }),

  /** Next free slot at the end of the gallery. */
  nextPosition: async (where) => {
    const last = await prisma.image.findFirst({
      where,
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return last ? last.position + 1 : 0;
  },

  create: (data) => prisma.image.create({ data }),

  update: (id, data) => prisma.image.update({ where: { id }, data }),

  delete: (id) => prisma.image.delete({ where: { id } }),
};
