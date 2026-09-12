/**
 * End-to-end check of the API's permissions matrix and booking rules.
 *
 * Run against a seeded database with the server up:
 *   node src/server.js          (in one terminal)
 *   node scripts/smoke-test.js  (in another)
 *
 * Exits non-zero if any assertion fails.
 *
 * Fixtures use a per-run room-number prefix so repeated runs never collide, and
 * teardown removes what it can. Rooms that picked up booking history cannot be
 * deleted (history is preserved by design), so those are parked
 * OUT_OF_SERVICE to keep them out of guest-facing availability.
 */
const BASE = process.env.API_BASE ?? 'http://localhost:4000';

const ACCOUNTS = {
  admin: { email: 'admin@meridiangrand.example', password: 'Admin@123' },
  reception: { email: 'reception@meridiangrand.example', password: 'Reception@123' },
  guest: { email: 'guest@example.com', password: 'Guest@123' },
  guest2: { email: 'sneha@example.com', password: 'Guest@123' },
};

/** Every fixture room is named ZZ<stamp>-<n>, so runs never clash. */
const FIXTURE_PREFIX = 'ZZ';
const stamp = Date.now().toString().slice(-6);
const fixtureRoom = (n) => `${FIXTURE_PREFIX}${stamp}-${n}`;

let passed = 0;
let failed = 0;
const failures = [];

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    failures.push(`${label}${detail ? ` -- ${detail}` : ''}`);
    console.log(`  FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, data };
}

/** A date N days from today, as YYYY-MM-DD. */
function day(n) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Remove fixture rooms left behind by earlier runs (including the older T-9xx
 * naming), so a previous failure cannot poison this one.
 */
async function sweepOldFixtures(adminToken) {
  const { data } = await api('/api/rooms?take=100', { token: adminToken });
  const stale = (data?.rooms ?? []).filter(
    (r) => r.roomNumber.startsWith(FIXTURE_PREFIX) || r.roomNumber.startsWith('T-')
  );
  if (!stale.length) return 0;

  let removed = 0;
  for (const room of stale) {
    const { data: list } = await api(`/api/bookings?roomId=${room.id}&take=100`, {
      token: adminToken,
    });
    for (const booking of list?.bookings ?? []) {
      if (['CONFIRMED', 'CHECKED_IN'].includes(booking.status)) {
        await api(`/api/bookings/${booking.id}/cancel`, {
          method: 'POST',
          token: adminToken,
          body: { reason: 'smoke-test fixture sweep' },
        });
      }
    }
    const del = await api(`/api/rooms/${room.id}`, { method: 'DELETE', token: adminToken });
    if (del.status === 200) removed += 1;
    else {
      // Has booking history and so cannot be deleted - park it instead.
      await api(`/api/rooms/${room.id}`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'OUT_OF_SERVICE' },
      });
    }
  }
  return removed;
}

async function main() {
  const tokens = {};

  console.log('\n=== Authentication ===');
  for (const [key, creds] of Object.entries(ACCOUNTS)) {
    const res = await api('/api/auth/login', { method: 'POST', body: creds });
    tokens[key] = res.data?.token;
    check(`login as ${key}`, res.status === 200 && !!res.data?.token, `status ${res.status}`);
  }
  if (!tokens.admin) {
    console.error('\nCannot continue without an admin token. Run `npm run db:seed` first.\n');
    process.exit(1);
  }

  const wrong = await api('/api/auth/login', {
    method: 'POST',
    body: { email: ACCOUNTS.guest.email, password: 'WrongPassword1' },
  });
  check('wrong password rejected (401)', wrong.status === 401, `status ${wrong.status}`);

  const noToken = await api('/api/bookings');
  check('unauthenticated request rejected (401)', noToken.status === 401, `status ${noToken.status}`);

  const badToken = await api('/api/bookings', { token: 'not.a.real.token' });
  check('invalid token rejected (401)', badToken.status === 401, `status ${badToken.status}`);

  const swept = await sweepOldFixtures(tokens.admin);
  if (swept) console.log(`  (swept ${swept} fixture room(s) from a previous run)`);

  console.log('\n=== Public browsing ===');
  const hotels = await api('/api/hotels');
  check('anonymous can list hotels', hotels.status === 200 && hotels.data.total >= 1, `status ${hotels.status}`);
  const hotelId = hotels.data?.hotels?.[0]?.id;

  const types = await api('/api/rooms/types');
  check(
    'room types expose the 5 PDF categories',
    types.status === 200 && types.data.types.length === 5,
    `got ${types.data?.types?.length}`
  );

  const avail = await api(`/api/rooms/availability?checkIn=${day(40)}&checkOut=${day(43)}&guests=2`);
  check('availability search works', avail.status === 200 && avail.data.count > 0, `status ${avail.status}`);
  check(
    'availability quote is priced per night',
    avail.data?.rooms?.[0]?.quote?.nights === 3 &&
      avail.data.rooms[0].quote.totalAmount === avail.data.rooms[0].quote.nightlyRate * 3,
    JSON.stringify(avail.data?.rooms?.[0]?.quote)
  );
  check(
    'MAINTENANCE room excluded from availability',
    (avail.data?.rooms ?? []).every((r) => r.roomNumber !== '307')
  );

  const bigParty = await api(`/api/rooms/availability?checkIn=${day(40)}&checkOut=${day(42)}&guests=4`);
  check(
    'party of 4 only matches rooms seating 4',
    bigParty.status === 200 && bigParty.data.rooms.every((r) => r.maxGuests >= 4),
    `capacities: ${bigParty.data?.rooms?.map((r) => r.maxGuests).join(',')}`
  );

  console.log('\n=== Customer permissions ===');
  const custUsers = await api('/api/users', { token: tokens.guest });
  check('customer cannot list users (403)', custUsers.status === 403, `status ${custUsers.status}`);

  const custHotel = await api('/api/hotels', {
    method: 'POST',
    token: tokens.guest,
    body: {
      code: `HACK${stamp}`,
      name: 'Rogue Hotel',
      address: '1 Nowhere Street',
      city: 'Nowhere',
      contactNumber: '+911234567890',
      email: 'x@example.com',
    },
  });
  check('customer cannot create a hotel (403)', custHotel.status === 403, `status ${custHotel.status}`);

  const custFrontDesk = await api('/api/bookings/front-desk', { token: tokens.guest });
  check('customer cannot see the front desk (403)', custFrontDesk.status === 403, `status ${custFrontDesk.status}`);

  console.log('\n=== Receptionist permissions (must NOT be admin-level) ===');
  const recHotel = await api('/api/hotels', {
    method: 'POST',
    token: tokens.reception,
    body: {
      code: `RECEP${stamp}`,
      name: 'Receptionist Hotel',
      address: '2 Nowhere Street',
      city: 'Nowhere',
      contactNumber: '+911234567890',
      email: 'y@example.com',
    },
  });
  check('receptionist cannot create a hotel (403)', recHotel.status === 403, `status ${recHotel.status}`);

  const recUsers = await api('/api/users', { token: tokens.reception });
  check('receptionist cannot list users (403)', recUsers.status === 403, `status ${recUsers.status}`);

  const roomList = await api(`/api/rooms?hotelId=${hotelId}&take=100`, { token: tokens.reception });
  const realRoom = roomList.data.rooms.find((r) => r.roomNumber === '306');

  const recPrice = await api(`/api/rooms/${realRoom.id}`, {
    method: 'PATCH',
    token: tokens.reception,
    body: { pricePerNight: 1 },
  });
  check('receptionist cannot change room price (403)', recPrice.status === 403, `status ${recPrice.status}`);

  const recType = await api(`/api/rooms/${realRoom.id}`, {
    method: 'PATCH',
    token: tokens.reception,
    body: { roomType: 'Penthouse' },
  });
  check('receptionist cannot change room type (403)', recType.status === 403, `status ${recType.status}`);

  const recNewRoom = await api('/api/rooms', {
    method: 'POST',
    token: tokens.reception,
    body: { hotelId, roomNumber: fixtureRoom('reject'), roomType: 'Deluxe King', maxGuests: 2, pricePerNight: 8500 },
  });
  check('receptionist cannot create a room (403)', recNewRoom.status === 403, `status ${recNewRoom.status}`);

  const recDelRoom = await api(`/api/rooms/${realRoom.id}`, {
    method: 'DELETE',
    token: tokens.reception,
  });
  check('receptionist cannot delete a room (403)', recDelRoom.status === 403, `status ${recDelRoom.status}`);

  const recFrontDesk = await api('/api/bookings/front-desk', { token: tokens.reception });
  check('receptionist CAN see the front desk', recFrontDesk.status === 200, `status ${recFrontDesk.status}`);
  check('front desk reports today', recFrontDesk.data?.date === day(0), `${recFrontDesk.data?.date}`);

  const recCalendar = await api(`/api/rooms/${realRoom.id}/calendar?from=${day(0)}&to=${day(7)}`, {
    token: tokens.reception,
  });
  check(
    'receptionist CAN read the occupancy calendar',
    recCalendar.status === 200 && recCalendar.data.days.length === 7,
    `status ${recCalendar.status}, ${recCalendar.data?.days?.length} days`
  );

  const custCalendar = await api(`/api/rooms/${realRoom.id}/calendar?from=${day(0)}&to=${day(7)}`, {
    token: tokens.guest,
  });
  check('customer cannot read the calendar (403)', custCalendar.status === 403, `status ${custCalendar.status}`);

  console.log('\n=== Admin permissions ===');
  const adminDash = await api('/api/users/dashboard', { token: tokens.admin });
  check(
    'admin dashboard works',
    adminDash.status === 200 && adminDash.data.totalRooms >= 15,
    JSON.stringify(adminDash.data)
  );

  const mainRoom = await api('/api/rooms', {
    method: 'POST',
    token: tokens.admin,
    body: {
      hotelId,
      roomNumber: fixtureRoom('a'),
      roomType: 'Premier Sea View',
      maxGuests: 3,
      pricePerNight: 12500,
      description: 'Smoke-test room',
      amenities: ['Sea view'],
    },
  });
  check('admin CAN create a room', mainRoom.status === 201, JSON.stringify(mainRoom.data?.error ?? ''));
  const mainRoomId = mainRoom.data?.room?.id;

  const dupRoom = await api('/api/rooms', {
    method: 'POST',
    token: tokens.admin,
    body: { hotelId, roomNumber: fixtureRoom('a'), roomType: 'Deluxe King', maxGuests: 2, pricePerNight: 100 },
  });
  check('duplicate room number rejected (409)', dupRoom.status === 409, `status ${dupRoom.status}`);

  console.log('\n=== Booking flow ===');
  const book = await api('/api/bookings', {
    method: 'POST',
    token: tokens.guest,
    body: { roomId: mainRoomId, checkIn: day(30), checkOut: day(33), guests: 2 },
  });
  check('customer can book an available room', book.status === 201, JSON.stringify(book.data?.error ?? ''));
  const bookingId = book.data?.booking?.id;
  check(
    'booking priced correctly (3 nights x 12500)',
    book.data?.booking?.nights === 3 && book.data?.booking?.totalAmount === 37500,
    JSON.stringify({ nights: book.data?.booking?.nights, total: book.data?.booking?.totalAmount })
  );
  check(
    'booking reference issued',
    /^MG-[A-Z0-9]{6}$/.test(book.data?.booking?.reference ?? ''),
    book.data?.booking?.reference
  );

  const doubleBook = await api('/api/bookings', {
    method: 'POST',
    token: tokens.guest2,
    body: { roomId: mainRoomId, checkIn: day(31), checkOut: day(34), guests: 2 },
  });
  check('overlapping booking rejected (409)', doubleBook.status === 409, `status ${doubleBook.status}`);

  const turnover = await api('/api/bookings', {
    method: 'POST',
    token: tokens.guest2,
    body: { roomId: mainRoomId, checkIn: day(33), checkOut: day(35), guests: 2 },
  });
  check('same-day turnover allowed', turnover.status === 201, `status ${turnover.status}`);
  const turnoverId = turnover.data?.booking?.id;

  const overCapacity = await api('/api/bookings', {
    method: 'POST',
    token: tokens.guest,
    body: { roomId: mainRoomId, checkIn: day(60), checkOut: day(62), guests: 4 },
  });
  check('over-capacity booking rejected (409)', overCapacity.status === 409, overCapacity.data?.error?.message);

  const pastBooking = await api('/api/bookings', {
    method: 'POST',
    token: tokens.guest,
    body: { roomId: mainRoomId, checkIn: day(-5), checkOut: day(-2), guests: 1 },
  });
  check('past-dated booking rejected (400)', pastBooking.status === 400, `status ${pastBooking.status}`);

  const zeroNight = await api('/api/bookings', {
    method: 'POST',
    token: tokens.guest,
    body: { roomId: mainRoomId, checkIn: day(30), checkOut: day(30), guests: 1 },
  });
  check('zero-night booking rejected (400)', zeroNight.status === 400, `status ${zeroNight.status}`);

  const reversed = await api('/api/bookings', {
    method: 'POST',
    token: tokens.guest,
    body: { roomId: mainRoomId, checkIn: day(40), checkOut: day(38), guests: 1 },
  });
  check('reversed date range rejected (400)', reversed.status === 400, `status ${reversed.status}`);

  console.log('\n=== Per-room availability check ===');
  // Drives the room page, so a guest learns a room is taken before they try
  // to book it rather than getting a 409 on submit.
  const freeCheck = await api(
    `/api/rooms/${mainRoomId}/availability?checkIn=${day(50)}&checkOut=${day(52)}&guests=2`
  );
  check(
    'free dates report available',
    freeCheck.status === 200 && freeCheck.data.available === true,
    JSON.stringify(freeCheck.data?.reasons)
  );
  check(
    'quote returned alongside availability',
    freeCheck.data?.quote?.nights === 2 && freeCheck.data.quote.totalAmount === 25000,
    JSON.stringify(freeCheck.data?.quote)
  );

  const takenCheck = await api(
    `/api/rooms/${mainRoomId}/availability?checkIn=${day(31)}&checkOut=${day(32)}&guests=2`
  );
  check(
    'booked dates report unavailable',
    takenCheck.status === 200 && takenCheck.data.available === false,
    JSON.stringify(takenCheck.data?.available)
  );
  check(
    'reason is ALREADY_BOOKED',
    takenCheck.data?.reasons?.some((r) => r.code === 'ALREADY_BOOKED'),
    JSON.stringify(takenCheck.data?.reasons?.map((r) => r.code))
  );
  check(
    'suggests when the room next frees up',
    takenCheck.data?.nextAvailableFrom === day(33),
    `${takenCheck.data?.nextAvailableFrom} vs ${day(33)}`
  );

  const capacityCheck = await api(
    `/api/rooms/${mainRoomId}/availability?checkIn=${day(50)}&checkOut=${day(52)}&guests=4`
  );
  check(
    'over-capacity reported without booking',
    capacityCheck.data?.reasons?.some((r) => r.code === 'OVER_CAPACITY'),
    JSON.stringify(capacityCheck.data?.reasons?.map((r) => r.code))
  );

  const anonCheck = await api(
    `/api/rooms/${mainRoomId}/availability?checkIn=${day(50)}&checkOut=${day(52)}&guests=2`
  );
  check('availability check is public', anonCheck.status === 200, `status ${anonCheck.status}`);

  console.log('\n=== Booking isolation between guests ===');
  const otherGuest = await api(`/api/bookings/${bookingId}`, { token: tokens.guest2 });
  check(
    "guest cannot read another guest's booking (404)",
    otherGuest.status === 404,
    `status ${otherGuest.status}`
  );

  const staffRead = await api(`/api/bookings/${bookingId}`, { token: tokens.reception });
  check('receptionist CAN read any booking', staffRead.status === 200, `status ${staffRead.status}`);

  const myList = await api('/api/bookings', { token: tokens.guest });
  check(
    'customer list contains only their own bookings',
    myList.status === 200 && myList.data.bookings.every((b) => b.guestEmail === ACCOUNTS.guest.email),
    `emails: ${[...new Set(myList.data?.bookings?.map((b) => b.guestEmail))].join(',')}`
  );

  const spoofed = await api(`/api/bookings?guestId=${myList.data.bookings[0]?.guestId}`, {
    token: tokens.guest2,
  });
  check(
    'guestId filter cannot be used to read another guest',
    spoofed.status === 200 && spoofed.data.bookings.every((b) => b.guestEmail === ACCOUNTS.guest2.email),
    `emails: ${[...new Set(spoofed.data?.bookings?.map((b) => b.guestEmail))].join(',')}`
  );

  console.log('\n=== Cancellation rules (PDF section 3) ===');
  const policyFar = await api(`/api/bookings/${bookingId}/cancellation-policy`, { token: tokens.guest });
  check(
    'far-out booking is directly cancellable',
    policyFar.data?.outcome === 'IMMEDIATE' && policyFar.data?.withinFreeWindow === true,
    JSON.stringify(policyFar.data?.outcome)
  );

  // A stay starting TODAY is always past its direct-cancellation deadline
  // (2:00 PM IST yesterday), so this branch is deterministic whatever time the
  // suite runs. A booking for *tomorrow* would still be inside the window until
  // 2:00 PM today - which is correct behaviour, not a bug.
  const lateRoom = await api('/api/rooms', {
    method: 'POST',
    token: tokens.admin,
    body: {
      hotelId,
      roomNumber: fixtureRoom('b'),
      roomType: 'Deluxe King',
      maxGuests: 2,
      pricePerNight: 8500,
      amenities: ['City view'],
    },
  });
  const lateRoomId = lateRoom.data?.room?.id;

  const todayBooking = await api('/api/bookings', {
    method: 'POST',
    token: tokens.guest2,
    body: { roomId: lateRoomId, checkIn: day(0), checkOut: day(2), guests: 2 },
  });
  check(
    'can book a stay starting today',
    todayBooking.status === 201,
    JSON.stringify(todayBooking.data?.error ?? '')
  );
  const lateBookingId = todayBooking.data?.booking?.id;

  const policyNear = await api(`/api/bookings/${lateBookingId}/cancellation-policy`, {
    token: tokens.guest2,
  });
  check(
    'past the 24h deadline -> REVIEW_REQUIRED',
    policyNear.data?.outcome === 'REVIEW_REQUIRED' && policyNear.data?.withinFreeWindow === false,
    JSON.stringify(policyNear.data?.outcome)
  );

  const lateNoReason = await api(`/api/bookings/${lateBookingId}/cancel`, {
    method: 'POST',
    token: tokens.guest2,
    body: {},
  });
  check('late cancellation without a reason rejected (400)', lateNoReason.status === 400, `status ${lateNoReason.status}`);

  const lateCancel = await api(`/api/bookings/${lateBookingId}/cancel`, {
    method: 'POST',
    token: tokens.guest2,
    body: { reason: 'Flight cancelled by the airline' },
  });
  check(
    'late cancellation returns 202 REVIEW_REQUESTED',
    lateCancel.status === 202 && lateCancel.data?.outcome === 'REVIEW_REQUESTED',
    `status ${lateCancel.status} ${lateCancel.data?.outcome}`
  );
  check(
    'booking stays CONFIRMED pending review',
    lateCancel.data?.booking?.status === 'CONFIRMED',
    lateCancel.data?.booking?.status
  );
  const requestId = lateCancel.data?.cancellationRequest?.id;

  const duplicate = await api(`/api/bookings/${lateBookingId}/cancel`, {
    method: 'POST',
    token: tokens.guest2,
    body: { reason: 'Trying again' },
  });
  check('duplicate pending request rejected (409)', duplicate.status === 409, `status ${duplicate.status}`);

  const custReview = await api(`/api/cancellation-requests/${requestId}/review`, {
    method: 'POST',
    token: tokens.guest2,
    body: { decision: 'APPROVED' },
  });
  check('customer cannot review their own request (403)', custReview.status === 403, `status ${custReview.status}`);

  const queue = await api('/api/cancellation-requests?status=PENDING', { token: tokens.reception });
  check(
    'receptionist sees the pending queue',
    queue.status === 200 && queue.data.total >= 1,
    `total ${queue.data?.total}`
  );

  const approve = await api(`/api/cancellation-requests/${requestId}/review`, {
    method: 'POST',
    token: tokens.reception,
    body: { decision: 'APPROVED', reviewNote: 'Airline disruption, waived.' },
  });
  check('receptionist CAN approve a request', approve.status === 200, `status ${approve.status}`);
  check('approval cancels the booking', approve.data?.booking?.status === 'CANCELLED', approve.data?.booking?.status);

  const reReview = await api(`/api/cancellation-requests/${requestId}/review`, {
    method: 'POST',
    token: tokens.reception,
    body: { decision: 'REJECTED' },
  });
  check('reviewed request cannot be re-reviewed (409)', reReview.status === 409, `status ${reReview.status}`);

  const recancel = await api(`/api/bookings/${lateBookingId}/cancel`, {
    method: 'POST',
    token: tokens.guest2,
    body: { reason: 'Again' },
  });
  check(
    'cancelled booking cannot be cancelled again (409)',
    recancel.status === 409,
    recancel.data?.error?.message
  );

  console.log('\n=== Rejected request leaves the booking active ===');
  const rejectRoom = await api('/api/rooms', {
    method: 'POST',
    token: tokens.admin,
    body: { hotelId, roomNumber: fixtureRoom('c'), roomType: 'Deluxe Twin', maxGuests: 2, pricePerNight: 8500 },
  });
  const rejectBooking = await api('/api/bookings', {
    method: 'POST',
    token: tokens.guest,
    body: { roomId: rejectRoom.data.room.id, checkIn: day(0), checkOut: day(2), guests: 1 },
  });
  const rejectReq = await api(`/api/bookings/${rejectBooking.data.booking.id}/cancel`, {
    method: 'POST',
    token: tokens.guest,
    body: { reason: 'Testing a rejection' },
  });
  const reject = await api(`/api/cancellation-requests/${rejectReq.data.cancellationRequest.id}/review`, {
    method: 'POST',
    token: tokens.admin,
    body: { decision: 'REJECTED', reviewNote: 'Outside policy, no waiver.' },
  });
  check('admin CAN reject a request', reject.status === 200, `status ${reject.status}`);
  check(
    'rejection leaves the booking CONFIRMED',
    reject.data?.booking?.status === 'CONFIRMED',
    reject.data?.booking?.status
  );

  console.log('\n=== Date modification ===');
  const modify = await api(`/api/bookings/${bookingId}`, {
    method: 'PATCH',
    token: tokens.guest,
    body: { checkIn: day(30), checkOut: day(32) },
  });
  check('guest can shorten a stay when available', modify.status === 200, JSON.stringify(modify.data?.error ?? ''));
  check(
    're-priced after modification (2 nights)',
    modify.data?.booking?.nights === 2 && modify.data?.booking?.totalAmount === 25000,
    JSON.stringify({ nights: modify.data?.booking?.nights, total: modify.data?.booking?.totalAmount })
  );

  const modifyClash = await api(`/api/bookings/${bookingId}`, {
    method: 'PATCH',
    token: tokens.guest,
    body: { checkIn: day(33), checkOut: day(36) },
  });
  check('modification into an occupied range rejected (409)', modifyClash.status === 409, `status ${modifyClash.status}`);

  const cancelNow = await api(`/api/bookings/${bookingId}/cancel`, {
    method: 'POST',
    token: tokens.guest,
    body: { reason: 'Change of plans' },
  });
  check(
    'direct cancellation returns 200 CANCELLED',
    cancelNow.status === 200 && cancelNow.data?.outcome === 'CANCELLED',
    `status ${cancelNow.status}`
  );

  const freedUp = await api(`/api/rooms/availability?checkIn=${day(30)}&checkOut=${day(32)}&guests=2`);
  check(
    'cancelled dates become available again',
    freedUp.data?.rooms?.some((r) => r.id === mainRoomId),
    'room did not return to availability'
  );

  const modifyCancelled = await api(`/api/bookings/${bookingId}`, {
    method: 'PATCH',
    token: tokens.guest,
    body: { checkIn: day(45), checkOut: day(47) },
  });
  check('cancelled booking cannot be modified (409)', modifyCancelled.status === 409, `status ${modifyCancelled.status}`);

  console.log('\n=== Front-desk status transitions ===');
  const badTransition = await api(`/api/bookings/${turnoverId}/status`, {
    method: 'PATCH',
    token: tokens.reception,
    body: { status: 'CHECKED_OUT' },
  });
  check(
    'cannot check out a booking that never checked in (409)',
    badTransition.status === 409,
    `status ${badTransition.status}`
  );

  const custStatus = await api(`/api/bookings/${turnoverId}/status`, {
    method: 'PATCH',
    token: tokens.guest2,
    body: { status: 'CHECKED_IN' },
  });
  check('customer cannot change booking status (403)', custStatus.status === 403, `status ${custStatus.status}`);

  const checkIn = await api(`/api/bookings/${rejectBooking.data.booking.id}/status`, {
    method: 'PATCH',
    token: tokens.reception,
    body: { status: 'CHECKED_IN' },
  });
  check('receptionist CAN check a guest in', checkIn.status === 200, `status ${checkIn.status}`);
  const checkOut = await api(`/api/bookings/${rejectBooking.data.booking.id}/status`, {
    method: 'PATCH',
    token: tokens.reception,
    body: { status: 'CHECKED_OUT' },
  });
  check('receptionist CAN check a guest out', checkOut.status === 200, `status ${checkOut.status}`);

  console.log('\n=== Validation & privilege escalation ===');
  const badReg = await api('/api/auth/register', {
    method: 'POST',
    body: { name: 'Test User', email: 'not-an-email', password: 'short' },
  });
  check('invalid registration rejected (400)', badReg.status === 400, `status ${badReg.status}`);
  check(
    'validation errors are field-specific',
    Array.isArray(badReg.data?.error?.details) && badReg.data.error.details.length >= 2,
    JSON.stringify(badReg.data?.error?.details)
  );

  const escalation = await api('/api/auth/register', {
    method: 'POST',
    body: {
      name: 'Sneaky Admin',
      email: `escalate${stamp}@example.com`,
      password: 'Password1',
      role: 'ADMIN',
    },
  });
  check(
    'self-signup cannot grant itself ADMIN',
    escalation.status === 201 && escalation.data?.user?.role === 'CUSTOMER',
    `role ${escalation.data?.user?.role}`
  );

  const dupEmail = await api('/api/auth/register', {
    method: 'POST',
    body: { name: 'Duplicate', email: ACCOUNTS.guest.email, password: 'Password1' },
  });
  check('duplicate email registration rejected (409)', dupEmail.status === 409, `status ${dupEmail.status}`);

  console.log('\n=== Deletion protects booking history ===');
  const delWithHistory = await api(`/api/rooms/${mainRoomId}`, { method: 'DELETE', token: tokens.admin });
  check(
    'room with booking history cannot be deleted (409)',
    delWithHistory.status === 409,
    `status ${delWithHistory.status}: ${delWithHistory.data?.error?.message}`
  );

  const delHotel = await api(`/api/hotels/${hotelId}`, { method: 'DELETE', token: tokens.admin });
  check('hotel with booking history cannot be deleted (409)', delHotel.status === 409, `status ${delHotel.status}`);

  const freshRoom = await api('/api/rooms', {
    method: 'POST',
    token: tokens.admin,
    body: { hotelId, roomNumber: fixtureRoom('d'), roomType: 'Deluxe Twin', maxGuests: 2, pricePerNight: 8500 },
  });
  const delFresh = await api(`/api/rooms/${freshRoom.data.room.id}`, {
    method: 'DELETE',
    token: tokens.admin,
  });
  check('room with no bookings CAN be deleted', delFresh.status === 200, JSON.stringify(delFresh.data?.error ?? ''));

  console.log('\n=== PATCH must not clobber unrelated fields ===');
  await api(`/api/rooms/${lateRoomId}`, {
    method: 'PATCH',
    token: tokens.admin,
    body: { amenities: ['Sea view', 'Balcony'] },
  });
  const statusOnly = await api(`/api/rooms/${lateRoomId}`, {
    method: 'PATCH',
    token: tokens.reception,
    body: { status: 'MAINTENANCE' },
  });
  check('receptionist CAN change room status', statusOnly.status === 200, `status ${statusOnly.status}`);
  check(
    'status-only PATCH preserves amenities',
    (statusOnly.data?.room?.amenities ?? []).length === 2,
    `amenities: ${JSON.stringify(statusOnly.data?.room?.amenities)}`
  );

  await api(`/api/hotels/${hotelId}`, {
    method: 'PATCH',
    token: tokens.admin,
    body: { status: 'INACTIVE' },
  });
  const cityOnly = await api(`/api/hotels/${hotelId}`, {
    method: 'PATCH',
    token: tokens.admin,
    body: { city: 'Mumbai' },
  });
  check(
    'city-only PATCH does not reactivate an INACTIVE hotel',
    cityOnly.data?.hotel?.status === 'INACTIVE',
    `status ${cityOnly.data?.hotel?.status}`
  );
  // Put the property back on sale so the database is left demo-ready.
  await api(`/api/hotels/${hotelId}`, {
    method: 'PATCH',
    token: tokens.admin,
    body: { status: 'ACTIVE' },
  });

  console.log('\n=== Teardown ===');
  const removed = await sweepOldFixtures(tokens.admin);
  console.log(`  removed ${removed} fixture room(s); any with booking history parked OUT_OF_SERVICE`);

  const finalAvail = await api(`/api/rooms/availability?checkIn=${day(40)}&checkOut=${day(42)}&guests=2`);
  check(
    'no fixture rooms leak into guest availability',
    (finalAvail.data?.rooms ?? []).every((r) => !r.roomNumber.startsWith(FIXTURE_PREFIX)),
    `leaked: ${finalAvail.data?.rooms?.filter((r) => r.roomNumber.startsWith(FIXTURE_PREFIX)).map((r) => r.roomNumber).join(',')}`
  );

  console.log(`\n${'='.repeat(54)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  if (failed) {
    console.log('\n  Failures:');
    failures.forEach((f) => console.log(`    - ${f}`));
  }
  console.log(`${'='.repeat(54)}\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error('\nSmoke test crashed:', error);
  process.exit(1);
});
