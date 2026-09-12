/**
 * Remove data created by scripts/smoke-test.js, leaving the seeded demo
 * records untouched.
 *
 *   node scripts/clean-fixtures.js            preview what would be removed
 *   node scripts/clean-fixtures.js --apply    actually remove it
 *
 * Scoped deliberately: only rooms whose number carries a test prefix, the
 * bookings attached to them, and throwaway accounts created by the
 * privilege-escalation check. Nothing else is touched.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

// Test rooms are named ZZ<stamp>-<n>; T-9xx is the older naming.
const ROOM_PREFIXES = ['ZZ', 'T-'];
const THROWAWAY_EMAIL = /^esc(alate)?\d+@example\.com$/;

async function main() {
  const rooms = await prisma.room.findMany({
    where: { OR: ROOM_PREFIXES.map((prefix) => ({ roomNumber: { startsWith: prefix } })) },
    select: { id: true, roomNumber: true, _count: { select: { bookings: true } } },
  });

  const users = (
    await prisma.user.findMany({ select: { id: true, email: true, name: true } })
  ).filter((u) => THROWAWAY_EMAIL.test(u.email));

  const roomIds = rooms.map((r) => r.id);
  const bookingCount = roomIds.length
    ? await prisma.booking.count({ where: { roomId: { in: roomIds } } })
    : 0;

  console.log(`\n${apply ? 'Removing' : 'Would remove'}:`);
  console.log(`  rooms    ${rooms.length}${rooms.length ? ` (${rooms.map((r) => r.roomNumber).join(', ')})` : ''}`);
  console.log(`  bookings ${bookingCount} attached to those rooms`);
  console.log(`  accounts ${users.length}${users.length ? ` (${users.map((u) => u.email).join(', ')})` : ''}`);

  if (!rooms.length && !users.length) {
    console.log('\nNothing to clean.\n');
    return;
  }

  if (!apply) {
    console.log('\nRe-run with --apply to remove these.\n');
    return;
  }

  // Cancellation requests cascade from bookings, but bookings are RESTRICTed
  // from rooms, so bookings must go first.
  await prisma.$transaction(async (tx) => {
    if (roomIds.length) {
      await tx.cancellationRequest.deleteMany({
        where: { booking: { roomId: { in: roomIds } } },
      });
      await tx.booking.deleteMany({ where: { roomId: { in: roomIds } } });
      await tx.room.deleteMany({ where: { id: { in: roomIds } } });
    }
    for (const user of users) {
      // Only safe to delete an account with no booking history of its own.
      const owned = await tx.booking.count({ where: { guestId: user.id } });
      if (owned === 0) await tx.user.delete({ where: { id: user.id } });
    }
  });

  console.log('\nDone.\n');
}

main()
  .catch((error) => {
    console.error('Cleanup failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
