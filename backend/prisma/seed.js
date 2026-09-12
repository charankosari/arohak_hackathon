/**
 * Seeds the hotel, its room inventory, demo accounts and sample bookings.
 *
 * Hotel details and room categories come from
 * AROHAK_Hotel_Information_For_RAG.pdf (sections 1, 4 and 5), so the database
 * and the chatbot's knowledge base describe the same property.
 *
 * Safe to re-run: everything is upserted by a natural key.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const HOTEL = {
  code: 'HGMUM001',
  name: 'The Meridian Grand Mumbai',
  address: '18 Marine View Road, Nariman Point',
  city: 'Mumbai',
  description:
    'A 24-hour luxury property on Mumbai’s Marine Drive, with sea-view suites, the Harbour ' +
    'Table restaurant, the Skyline 18 rooftop lounge, a 24-hour fitness centre, spa and pool. ' +
    'Reception speaks English, Hindi and Marathi.',
  contactNumber: '+91 22 4567 8900',
  email: 'reservations@meridiangrand.example',
  status: 'ACTIVE',
};

// PDF section 4, with the standard amenities of section 5.
const BASE_AMENITIES = [
  'Complimentary Wi-Fi',
  'Air conditioning',
  'Smart television',
  'Electric kettle and tea/coffee setup',
  'In-room safe',
  'Hair dryer',
  'Mini refrigerator',
  'Complimentary bottled water',
  'Daily housekeeping',
];

const SUITE_EXTRAS = [
  'Separate living area',
  'Bathrobe and slippers',
  'Premium bathroom amenities',
  'Evening turndown service',
];

const ROOM_TYPES = [
  {
    roomType: 'Deluxe King',
    maxGuests: 2,
    pricePerNight: 8500,
    description: 'King bed, city view, work desk.',
    amenities: [...BASE_AMENITIES, 'King bed', 'City view', 'Work desk'],
    floors: [['301', '302', '303', '304']],
  },
  {
    roomType: 'Deluxe Twin',
    maxGuests: 2,
    pricePerNight: 8500,
    description: 'Two twin beds, city view, work desk.',
    amenities: [...BASE_AMENITIES, 'Two twin beds', 'City view', 'Work desk'],
    floors: [['305', '306', '307']],
  },
  {
    roomType: 'Premier Sea View',
    maxGuests: 3,
    pricePerNight: 12500,
    description: 'King bed, sea view, sofa chair.',
    amenities: [...BASE_AMENITIES, 'King bed', 'Sea view', 'Sofa chair'],
    floors: [['901', '902', '903', '904']],
  },
  {
    roomType: 'Executive Suite',
    maxGuests: 3,
    pricePerNight: 18000,
    description: 'Separate bedroom, living area and sea view.',
    amenities: [...BASE_AMENITIES, ...SUITE_EXTRAS, 'Sea view', 'King bed'],
    floors: [['1401', '1402']],
  },
  {
    roomType: 'Family Suite',
    maxGuests: 4,
    pricePerNight: 22000,
    description: 'Two bedrooms, living area and dining table.',
    amenities: [...BASE_AMENITIES, ...SUITE_EXTRAS, 'Two bedrooms', 'Dining table'],
    floors: [['1601', '1602']],
  },
];

const USERS = [
  {
    name: 'Aarav Mehta',
    email: 'admin@meridiangrand.example',
    password: 'Admin@123',
    role: 'ADMIN',
    phone: '+91 98200 10001',
  },
  {
    name: 'Priya Nair',
    email: 'reception@meridiangrand.example',
    password: 'Reception@123',
    role: 'RECEPTIONIST',
    phone: '+91 98200 10002',
  },
  {
    name: 'Rahul Verma',
    email: 'guest@example.com',
    password: 'Guest@123',
    role: 'CUSTOMER',
    phone: '+91 98200 10003',
  },
  {
    name: 'Sneha Iyer',
    email: 'sneha@example.com',
    password: 'Guest@123',
    role: 'CUSTOMER',
    phone: '+91 98200 10004',
  },
];

/** A date N days from today, as a UTC-midnight Date (matches Postgres `date`). */
function daysFromToday(n) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const reference = () =>
  `MG-${Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')}`;

async function main() {
  console.log('Seeding The Meridian Grand Mumbai...\n');

  // --- Users ---------------------------------------------------------
  const users = {};
  for (const user of USERS) {
    const record = await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role, phone: user.phone, isActive: true },
      create: {
        name: user.name,
        email: user.email,
        passwordHash: await bcrypt.hash(user.password, 10),
        role: user.role,
        phone: user.phone,
      },
    });
    users[user.role] = users[user.role] ?? record;
    users[user.email] = record;
    console.log(`  user   ${record.role.padEnd(12)} ${record.email}`);
  }

  // --- Hotel ---------------------------------------------------------
  const hotel = await prisma.hotel.upsert({
    where: { code: HOTEL.code },
    update: HOTEL,
    create: HOTEL,
  });
  console.log(`\n  hotel  ${hotel.code} ${hotel.name}`);

  // --- Rooms ---------------------------------------------------------
  const rooms = [];
  for (const type of ROOM_TYPES) {
    for (const numbers of type.floors) {
      for (const roomNumber of numbers) {
        const room = await prisma.room.upsert({
          where: { hotelId_roomNumber: { hotelId: hotel.id, roomNumber } },
          update: {
            roomType: type.roomType,
            maxGuests: type.maxGuests,
            pricePerNight: type.pricePerNight,
            description: type.description,
            amenities: type.amenities,
          },
          create: {
            hotelId: hotel.id,
            roomNumber,
            roomType: type.roomType,
            maxGuests: type.maxGuests,
            pricePerNight: type.pricePerNight,
            description: type.description,
            amenities: type.amenities,
            status: 'AVAILABLE',
          },
        });
        rooms.push(room);
      }
    }
  }
  console.log(`  rooms  ${rooms.length} across ${ROOM_TYPES.length} categories`);

  // One room parked in maintenance so the availability filter is visibly doing
  // something in the demo.
  await prisma.room.update({
    where: { hotelId_roomNumber: { hotelId: hotel.id, roomNumber: '307' } },
    data: { status: 'MAINTENANCE' },
  });
  console.log('  room   307 set to MAINTENANCE (demo)');

  // --- Bookings ------------------------------------------------------
  // `--reset-bookings` clears the sample reservations and recreates them, so a
  // demo can be replayed from a clean slate after things have been cancelled
  // or checked in.
  if (process.argv.includes('--reset-bookings')) {
    const existing = await prisma.booking.findMany({
      where: { hotelId: hotel.id },
      select: { id: true },
    });
    if (existing.length) {
      const ids = existing.map((b) => b.id);
      // Requests reference bookings, so they have to go first.
      await prisma.cancellationRequest.deleteMany({ where: { bookingId: { in: ids } } });
      await prisma.booking.deleteMany({ where: { id: { in: ids } } });
      console.log(`\n  cleared ${ids.length} existing booking(s) (--reset-bookings)`);
    }
  }

  // Otherwise skip, so re-seeding doesn't pile up duplicate reservations.
  const existingBookings = await prisma.booking.count();
  if (existingBookings > 0) {
    console.log(`\n  bookings already present (${existingBookings}) - skipping sample bookings`);
    console.log('  (pass --reset-bookings to recreate the demo reservations)');
  } else {
    const guest = users['guest@example.com'];
    const guest2 = users['sneha@example.com'];
    const reception = users['reception@meridiangrand.example'];
    const seaView = rooms.find((r) => r.roomNumber === '901');
    const seaView2 = rooms.find((r) => r.roomNumber === '902');
    const family = rooms.find((r) => r.roomNumber === '1601');
    const deluxe = rooms.find((r) => r.roomNumber === '301');

    const samples = [
      {
        // Far out: the guest can still cancel this one directly.
        room: seaView,
        guest,
        createdBy: guest,
        checkIn: daysFromToday(14),
        checkOut: daysFromToday(17),
        guests: 2,
        specialRequests: 'High floor if possible.',
      },
      {
        // Tomorrow: inside 24 hours, so cancelling needs staff review.
        room: family,
        guest: guest2,
        createdBy: reception,
        checkIn: daysFromToday(1),
        checkOut: daysFromToday(3),
        guests: 4,
        specialRequests: 'Travelling with two children.',
      },
      {
        // Arriving today. Its direct-cancellation deadline was 2:00 PM
        // yesterday, so a guest cancelling this one ALWAYS lands in the
        // staff review queue - which makes that flow demoable at any hour.
        room: seaView2,
        guest: guest2,
        createdBy: guest2,
        checkIn: daysFromToday(0),
        checkOut: daysFromToday(2),
        guests: 2,
        specialRequests: 'Late arrival, around 9 PM.',
      },
      {
        // Currently in-house.
        room: deluxe,
        guest,
        createdBy: reception,
        checkIn: daysFromToday(-1),
        checkOut: daysFromToday(2),
        guests: 1,
        status: 'CHECKED_IN',
      },
    ];

    for (const s of samples) {
      const nights = Math.round((s.checkOut - s.checkIn) / 86400000);
      const nightlyRate = Number(s.room.pricePerNight);
      const booking = await prisma.booking.create({
        data: {
          reference: reference(),
          hotelId: hotel.id,
          roomId: s.room.id,
          guestId: s.guest.id,
          createdById: s.createdBy.id,
          guestName: s.guest.name,
          guestEmail: s.guest.email,
          guestPhone: s.guest.phone,
          checkIn: s.checkIn,
          checkOut: s.checkOut,
          guests: s.guests,
          nights,
          nightlyRate,
          totalAmount: nightlyRate * nights,
          status: s.status ?? 'CONFIRMED',
          specialRequests: s.specialRequests ?? null,
        },
      });
      console.log(
        `  booking ${booking.reference} ${s.room.roomNumber} ${booking.status} ` +
          `${booking.checkIn.toISOString().slice(0, 10)} -> ${booking.checkOut.toISOString().slice(0, 10)}`
      );
    }
  }

  console.log('\nDone.\n');
  console.log('  Sign in with:');
  for (const u of USERS) {
    console.log(`    ${u.role.padEnd(12)} ${u.email.padEnd(36)} ${u.password}`);
  }
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
