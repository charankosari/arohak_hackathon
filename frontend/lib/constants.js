export const ROLES = {
  ADMIN: 'ADMIN',
  RECEPTIONIST: 'RECEPTIONIST',
  CUSTOMER: 'CUSTOMER',
};

export const ROLE_LABELS = {
  ADMIN: 'Administrator',
  RECEPTIONIST: 'Receptionist',
  CUSTOMER: 'Guest',
};

export const STAFF_ROLES = [ROLES.ADMIN, ROLES.RECEPTIONIST];

export const BOOKING_STATUSES = [
  'CONFIRMED',
  'CHECKED_IN',
  'CHECKED_OUT',
  'CANCELLED',
  'NO_SHOW',
];

export const ROOM_STATUSES = ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'OUT_OF_SERVICE'];

export const CANCELLATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];

/** Tailwind classes per status badge. */
export const STATUS_TONE = {
  // Bookings
  CONFIRMED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  CHECKED_IN: 'bg-sky-50 text-sky-700 ring-sky-200',
  CHECKED_OUT: 'bg-ink-100 text-ink-600 ring-ink-200',
  CANCELLED: 'bg-rose-50 text-rose-700 ring-rose-200',
  NO_SHOW: 'bg-amber-50 text-amber-700 ring-amber-200',
  // Rooms
  AVAILABLE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  OCCUPIED: 'bg-sky-50 text-sky-700 ring-sky-200',
  MAINTENANCE: 'bg-amber-50 text-amber-700 ring-amber-200',
  OUT_OF_SERVICE: 'bg-rose-50 text-rose-700 ring-rose-200',
  // Hotels
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  INACTIVE: 'bg-ink-100 text-ink-600 ring-ink-200',
  // Cancellation requests
  PENDING: 'bg-amber-50 text-amber-700 ring-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 ring-rose-200',
  // Roles
  ADMIN: 'bg-brass-100 text-brass-800 ring-brass-300',
  RECEPTIONIST: 'bg-ink-100 text-ink-700 ring-ink-300',
  CUSTOMER: 'bg-sky-50 text-sky-700 ring-sky-200',
};
