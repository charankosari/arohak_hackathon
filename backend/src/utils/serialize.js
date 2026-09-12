import { formatDateOnly } from './dates.js';

/** Prisma returns Decimal objects; the API speaks plain JSON numbers. */
const money = (value) => (value == null ? null : Number(value));

export function serializeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone ?? null,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

export function serializeHotel(hotel) {
  if (!hotel) return null;
  return {
    id: hotel.id,
    code: hotel.code,
    name: hotel.name,
    address: hotel.address,
    city: hotel.city,
    description: hotel.description ?? null,
    contactNumber: hotel.contactNumber,
    email: hotel.email,
    status: hotel.status,
    createdAt: hotel.createdAt,
    updatedAt: hotel.updatedAt,
    ...(hotel._count?.rooms !== undefined ? { roomCount: hotel._count.rooms } : {}),
    ...(hotel.rooms ? { rooms: hotel.rooms.map(serializeRoom) } : {}),
  };
}

export function serializeRoom(room) {
  if (!room) return null;
  return {
    id: room.id,
    hotelId: room.hotelId,
    roomNumber: room.roomNumber,
    roomType: room.roomType,
    maxGuests: room.maxGuests,
    pricePerNight: money(room.pricePerNight),
    status: room.status,
    description: room.description ?? null,
    amenities: room.amenities ?? [],
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    ...(room.hotel ? { hotel: serializeHotel(room.hotel) } : {}),
  };
}

export function serializeBooking(booking) {
  if (!booking) return null;
  return {
    id: booking.id,
    reference: booking.reference,
    hotelId: booking.hotelId,
    roomId: booking.roomId,
    guestId: booking.guestId,
    createdById: booking.createdById,
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
    guestPhone: booking.guestPhone ?? null,
    checkIn: formatDateOnly(booking.checkIn),
    checkOut: formatDateOnly(booking.checkOut),
    guests: booking.guests,
    nights: booking.nights,
    nightlyRate: money(booking.nightlyRate),
    totalAmount: money(booking.totalAmount),
    status: booking.status,
    specialRequests: booking.specialRequests ?? null,
    cancelledAt: booking.cancelledAt ?? null,
    cancellationReason: booking.cancellationReason ?? null,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    ...(booking.room ? { room: serializeRoom(booking.room) } : {}),
    ...(booking.hotel ? { hotel: serializeHotel(booking.hotel) } : {}),
    ...(booking.guest ? { guest: serializeUser(booking.guest) } : {}),
    ...(booking.cancellationRequests
      ? { cancellationRequests: booking.cancellationRequests.map(serializeCancellationRequest) }
      : {}),
  };
}

export function serializeCancellationRequest(request) {
  if (!request) return null;
  return {
    id: request.id,
    bookingId: request.bookingId,
    requestedById: request.requestedById,
    reason: request.reason,
    status: request.status,
    reviewNote: request.reviewNote ?? null,
    reviewedAt: request.reviewedAt ?? null,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    ...(request.booking ? { booking: serializeBooking(request.booking) } : {}),
    ...(request.requestedBy ? { requestedBy: serializeUser(request.requestedBy) } : {}),
    ...(request.reviewedBy ? { reviewedBy: serializeUser(request.reviewedBy) } : {}),
  };
}
