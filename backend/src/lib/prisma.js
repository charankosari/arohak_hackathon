import { PrismaClient } from '@prisma/client';
import { isProduction } from '../config/env.js';

export const prisma = new PrismaClient({
  log: isProduction ? ['error'] : ['warn', 'error'],
});

export async function disconnectPrisma() {
  await prisma.$disconnect();
}
