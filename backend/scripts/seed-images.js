/**
 * Upload starter photography into YOUR Cloudinary account and attach it to the
 * seeded hotel and room categories.
 *
 *   node scripts/seed-images.js            preview what it would do
 *   node scripts/seed-images.js --apply    upload and attach
 *   node scripts/seed-images.js --reset    remove existing photos first
 *
 * Source images are royalty-free Unsplash photographs, fetched once and pushed
 * to Cloudinary, so everything afterwards is served from your own account.
 * This is a convenience for demos - the real flow is an administrator
 * uploading through the admin panel.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { cache } from '../src/lib/cache.js';
import {
  destroyAsset,
  folderFor,
  isCloudinaryConfigured,
  uploadFromUrl,
} from '../src/lib/cloudinary.js';
import { initRedis, closeRedis } from '../src/lib/redis.js';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const reset = process.argv.includes('--reset');

const unsplash = (id, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

/** Photographs for the property itself. */
const HOTEL_PHOTOS = [
  { id: '1566073771259-6a8506099945', alt: 'The hotel facade at dusk' },
  { id: '1445019980597-93fa8acb246c', alt: 'The reception lobby' },
  { id: '1540541338287-41700207dee6', alt: 'The fourth-floor swimming pool' },
  { id: '1414235077428-338989a2e8c0', alt: 'Harbour Table restaurant' },
];

/** One set per room category, keyed by the room type in the seed. */
const ROOM_PHOTOS = {
  'Deluxe King': [
    { id: '1611892440504-42a792e24d32', alt: 'King bed with city view' },
    { id: '1590490360182-c33d57733427', alt: 'Work desk by the window' },
  ],
  'Deluxe Twin': [
    { id: '1631049307264-da0ec9d70304', alt: 'Two twin beds' },
    { id: '1582719478250-c89cae4dc85b', alt: 'Seating area' },
  ],
  'Premier Sea View': [
    { id: '1618773928121-c32242e63f39', alt: 'King bed facing the sea' },
    { id: '1560448204-e02f11c3d0e2', alt: 'Sea view from the window' },
  ],
  'Executive Suite': [
    { id: '1591088398332-8a7791972843', alt: 'Suite living area' },
    { id: '1596394516093-501ba68a0ba6', alt: 'Suite bedroom' },
  ],
  'Family Suite': [
    { id: '1578683010236-d716f9a3f461', alt: 'Family suite living room' },
    { id: '1505693416388-ac5ce068fe85', alt: 'Second bedroom' },
  ],
};

/** Confirm a source image is actually fetchable before sending it onward. */
async function reachable(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return res.ok && (res.headers.get('content-type') ?? '').startsWith('image/');
  } catch {
    return false;
  }
}

async function attach({ where, label, photos, kind }) {
  const existing = await prisma.image.count({ where });

  if (existing > 0 && !reset) {
    console.log(`  ${label.padEnd(22)} already has ${existing} photo(s) - skipping`);
    return 0;
  }

  if (existing > 0 && reset && apply) {
    const old = await prisma.image.findMany({ where, select: { id: true, publicId: true } });
    for (const image of old) {
      try {
        await destroyAsset(image.publicId);
      } catch {
        /* already gone remotely; the row still goes */
      }
    }
    await prisma.image.deleteMany({ where });
    console.log(`  ${label.padEnd(22)} removed ${old.length} existing photo(s)`);
  }

  let added = 0;
  for (const [index, photo] of photos.entries()) {
    const url = unsplash(photo.id);

    if (!(await reachable(url))) {
      console.log(`  ${label.padEnd(22)} source unavailable, skipped: ${photo.id}`);
      continue;
    }

    if (!apply) {
      added += 1;
      continue;
    }

    try {
      const uploaded = await uploadFromUrl(url, { folder: folderFor(kind), tags: [kind] });
      await prisma.image.create({
        data: {
          publicId: uploaded.public_id,
          url: uploaded.secure_url,
          width: uploaded.width,
          height: uploaded.height,
          format: uploaded.format,
          bytes: uploaded.bytes,
          alt: photo.alt,
          position: index,
          ...where,
        },
      });
      added += 1;
    } catch (error) {
      console.log(`  ${label.padEnd(22)} upload failed (${photo.id}): ${error.message}`);
    }
  }

  console.log(`  ${label.padEnd(22)} ${apply ? 'uploaded' : 'would upload'} ${added} photo(s)`);
  return added;
}

async function main() {
  if (!isCloudinaryConfigured()) {
    console.error(
      '\nCloudinary is not configured.\n' +
        'Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to\n' +
        'backend/.env, then run this again.\n'
    );
    process.exit(1);
  }

  // These writes go straight to the database rather than through the service
  // layer, so the cached room and hotel listings have to be cleared by hand
  // afterwards - otherwise the site keeps serving photo-less payloads.
  if (apply) await initRedis();

  console.log(`\n${apply ? 'Uploading' : 'Previewing'} starter photography...\n`);

  const hotel = await prisma.hotel.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!hotel) {
    console.error('No hotel found. Run `npm run db:seed` first.\n');
    process.exit(1);
  }

  let total = 0;

  total += await attach({
    where: { hotelId: hotel.id },
    label: hotel.name,
    photos: HOTEL_PHOTOS,
    kind: 'hotels',
  });

  // Photos are per category, applied to every room of that type, so all
  // fifteen rooms end up illustrated from five sets.
  for (const [roomType, photos] of Object.entries(ROOM_PHOTOS)) {
    const rooms = await prisma.room.findMany({
      where: { hotelId: hotel.id, roomType },
      orderBy: { roomNumber: 'asc' },
    });

    for (const room of rooms) {
      total += await attach({
        where: { roomId: room.id },
        label: `${roomType} ${room.roomNumber}`,
        photos,
        kind: 'rooms',
      });
    }
  }

  if (apply) {
    await Promise.all([cache.invalidateRooms(), cache.invalidateHotels()]);
    await closeRedis();
    console.log('\n  cleared cached room and hotel listings');
  }

  console.log(
    `\n${apply ? 'Done' : 'Preview complete'} - ${total} photo(s) ${apply ? 'uploaded' : 'would be uploaded'}.`
  );
  if (!apply) console.log('Re-run with --apply to upload them.\n');
  else console.log('');
}

main()
  .catch((error) => {
    console.error('Image seeding failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
