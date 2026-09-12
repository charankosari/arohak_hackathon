/** Indian Rupee, no decimals - room rates are always whole rupees. */
export const money = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(amount ?? 0));

/**
 * Format a "YYYY-MM-DD" string without letting the local timezone shift the
 * day. `new Date('2026-09-20')` parses as UTC midnight, which in a negative
 * offset renders as the 19th - so the parts are read directly instead.
 */
export function formatDate(value, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!value) return '';
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { ...options, timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d))
  );
}

export const formatDateShort = (value) => formatDate(value, { day: 'numeric', month: 'short' });

/** A real timestamp (cancellation deadlines etc.) in hotel-local time. */
export function formatDateTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}

/** "in 3 days" / "2 hours ago" */
export function relativeTime(value) {
  if (!value) return '';
  const diffMs = new Date(value).getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const units = [
    ['day', 86400000],
    ['hour', 3600000],
    ['minute', 60000],
  ];
  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms || unit === 'minute') {
      return rtf.format(Math.round(diffMs / ms), unit);
    }
  }
  return '';
}

/** Today in the hotel's timezone, as YYYY-MM-DD - the min for date inputs. */
export function todayISO() {
  const now = new Date();
  const ist = new Date(now.getTime() + 330 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

export function addDaysISO(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(`${checkIn}T00:00:00Z`);
  const b = new Date(`${checkOut}T00:00:00Z`);
  return Math.max(0, Math.round((b - a) / 86400000));
}

export const titleCase = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

export const initials = (name) =>
  String(name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
