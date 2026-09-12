'use client';

import { CalendarPlus, CalendarRange, Clock } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { CancelDialog } from '@/components/CancelDialog';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  LoadingBlock,
  Modal,
} from '@/components/ui';
import { api } from '@/lib/api';
import {
  addDaysISO,
  formatDate,
  formatDateTime,
  money,
  nightsBetween,
  todayISO,
} from '@/lib/format';

const FILTERS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'all', label: 'All' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState(null);
  const [filter, setFilter] = useState('upcoming');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [modifyTarget, setModifyTarget] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { bookings: list } = await api.bookings.list({ take: 100 });
      setBookings(list);
    } catch (err) {
      setError(err.message);
      setBookings([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = (bookings ?? []).filter((booking) => {
    if (filter === 'all') return true;
    if (filter === 'upcoming') return ['CONFIRMED', 'CHECKED_IN'].includes(booking.status);
    return booking.status === filter;
  });

  function onCancelled(result) {
    setNotice(
      result.outcome === 'CANCELLED'
        ? {
            tone: 'success',
            // Spell out why nothing is pending - otherwise an empty
            // cancellation-requests queue looks like something went wrong.
            text: `Booking ${result.booking.reference} has been cancelled immediately, because you cancelled more than 24 hours before check-in. No staff review is needed, so there is nothing to track under Cancellations.`,
          }
        : {
            tone: 'info',
            text: `Your cancellation request for ${result.booking.reference} has been sent to hotel staff for review, because check-in is less than 24 hours away. The booking stays confirmed until they decide - you can follow it under Cancellations.`,
          }
    );
    load();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink-900">My bookings</h1>
          <p className="mt-1 text-sm text-ink-500">
            View your stays, change dates, or cancel a reservation.
          </p>
        </div>
        <Link href="/rooms">
          <Button variant="brass">
            <CalendarPlus className="size-4" />
            New booking
          </Button>
        </Link>
      </header>

      {notice && (
        <Alert tone={notice.tone} className="animate-fade-up">
          {notice.text}
        </Alert>
      )}
      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setFilter(option.key)}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              filter === option.key
                ? 'bg-ink-900 font-medium text-white'
                : 'border border-ink-200 bg-white text-ink-600 hover:bg-cream-100'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {bookings === null ? (
        <Card>
          <LoadingBlock rows={3} />
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarRange}
            title={filter === 'upcoming' ? 'No upcoming stays' : 'Nothing to show'}
            action={
              <Link href="/rooms">
                <Button variant="brass">Browse rooms</Button>
              </Link>
            }
          >
            {filter === 'upcoming'
              ? 'Book a room and your reservation will appear here.'
              : 'Try a different filter.'}
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-4">
          {visible.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              onCancel={() => setCancelTarget(booking)}
              onModify={() => setModifyTarget(booking)}
            />
          ))}
        </div>
      )}

      <CancelDialog
        booking={cancelTarget}
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onDone={onCancelled}
      />

      <ModifyDialog
        booking={modifyTarget}
        open={!!modifyTarget}
        onClose={() => setModifyTarget(null)}
        onDone={(updated) => {
          setNotice({
            tone: 'success',
            text: `Booking ${updated.reference} moved to ${formatDate(updated.checkIn)} - ${formatDate(updated.checkOut)}.`,
          });
          load();
        }}
      />
    </div>
  );
}

function BookingCard({ booking, onCancel, onModify }) {
  const isActive = ['CONFIRMED', 'CHECKED_IN'].includes(booking.status);
  const pendingRequest = booking.cancellationRequests?.find((r) => r.status === 'PENDING');

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-100 p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-serif text-xl font-semibold text-ink-900">
              {booking.room.roomType}
            </h2>
            <Badge status={booking.status} />
          </div>
          <p className="mt-1 text-sm text-ink-500">
            Room {booking.room.roomNumber} &middot; {booking.hotel?.name ?? 'The Meridian Grand'}
          </p>
          <p className="mt-1 font-mono text-xs text-ink-400">{booking.reference}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-ink-900">{money(booking.totalAmount)}</p>
          <p className="text-xs text-ink-500">
            {money(booking.nightlyRate)} &times; {booking.nights}{' '}
            {booking.nights === 1 ? 'night' : 'nights'}
          </p>
        </div>
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-4">
        {[
          ['Check-in', `${formatDate(booking.checkIn)}, 2:00 PM`],
          ['Check-out', `${formatDate(booking.checkOut)}, 12:00 PM`],
          ['Guests', String(booking.guests)],
          ['Booked on', formatDateTime(booking.createdAt)],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-xs tracking-wide text-ink-400 uppercase">{label}</p>
            <p className="mt-1 text-sm font-medium text-ink-900">{value}</p>
          </div>
        ))}
      </div>

      {booking.specialRequests && (
        <p className="border-t border-ink-100 px-5 py-3 text-sm text-ink-500">
          <span className="font-medium text-ink-700">Special requests:</span>{' '}
          {booking.specialRequests}
        </p>
      )}

      {pendingRequest && (
        <div className="border-t border-ink-100 bg-amber-50 px-5 py-3">
          <p className="flex items-start gap-2 text-sm text-amber-900">
            <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <strong>Cancellation request under review.</strong> Submitted{' '}
              {formatDateTime(pendingRequest.createdAt)} - &ldquo;{pendingRequest.reason}&rdquo;. Your
              booking stays confirmed until staff decide.
            </span>
          </p>
        </div>
      )}

      {booking.status === 'CANCELLED' && (
        <p className="border-t border-ink-100 bg-rose-50 px-5 py-3 text-sm text-rose-900">
          <span className="font-medium">
            Cancelled{booking.cancelledAt ? ` on ${formatDateTime(booking.cancelledAt)}` : ''}
          </span>
          {booking.cancellationReason ? `: ${booking.cancellationReason}` : ''}
        </p>
      )}

      {isActive && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-ink-100 bg-ink-50 px-5 py-3">
          {booking.status === 'CONFIRMED' && (
            <Button variant="outline" size="sm" onClick={onModify}>
              Change dates
            </Button>
          )}
          {!pendingRequest && (
            <Button variant="danger" size="sm" onClick={onCancel}>
              Cancel booking
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

function ModifyDialog({ booking, open, onClose, onDone }) {
  const today = todayISO();
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (booking) {
      setCheckIn(booking.checkIn);
      setCheckOut(booking.checkOut);
      setError(null);
    }
  }, [booking]);

  const nights = nightsBetween(checkIn, checkOut);
  const invalid = nights < 1;
  const newTotal = booking ? Number(booking.nightlyRate) * nights : 0;

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const { booking: updated } = await api.bookings.modify(booking.id, { checkIn, checkOut });
      onDone?.(updated);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change your dates"
      description={booking ? `Booking ${booking.reference}` : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Keep current dates
          </Button>
          <Button onClick={submit} loading={submitting} disabled={invalid}>
            Confirm change
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}

        <Alert tone="info">
          Date changes depend on the room being free. Nothing is guaranteed until the change is
          confirmed.
        </Alert>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Check-in" required>
            <Input
              type="date"
              value={checkIn}
              min={today}
              onChange={(e) => {
                setCheckIn(e.target.value);
                if (nightsBetween(e.target.value, checkOut) < 1) {
                  setCheckOut(addDaysISO(e.target.value, 1));
                }
              }}
            />
          </Field>
          <Field label="Check-out" required error={invalid ? 'Must be after check-in' : undefined}>
            <Input
              type="date"
              value={checkOut}
              min={checkIn ? addDaysISO(checkIn, 1) : today}
              onChange={(e) => setCheckOut(e.target.value)}
              error={invalid}
            />
          </Field>
        </div>

        {booking && !invalid && (
          <div className="space-y-1.5 rounded-lg bg-ink-50 p-4 text-sm">
            <div className="flex justify-between text-ink-600">
              <span>
                {money(booking.nightlyRate)} &times; {nights}{' '}
                {nights === 1 ? 'night' : 'nights'}
              </span>
              <span>{money(newTotal)}</span>
            </div>
            {newTotal !== Number(booking.totalAmount) && (
              <div className="flex justify-between border-t border-ink-200 pt-1.5 font-medium text-ink-900">
                <span>{newTotal > booking.totalAmount ? 'Additional due' : 'Refund due'}</span>
                <span>{money(Math.abs(newTotal - Number(booking.totalAmount)))}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
