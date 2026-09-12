'use client';

import { ArrowLeft, Check, CheckCircle2, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Navbar } from '@/components/Navbar';
import { RoomGallery } from '@/components/RoomGallery';
import { Alert, Badge, Button, Card, Field, Input, Select, Spinner, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import { addDaysISO, formatDate, money, nightsBetween, todayISO } from '@/lib/format';

function RoomDetail() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, isStaff } = useAuth();

  const today = todayISO();
  const [room, setRoom] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const [checkIn, setCheckIn] = useState(searchParams.get('checkIn') || addDaysISO(today, 1));
  const [checkOut, setCheckOut] = useState(searchParams.get('checkOut') || addDaysISO(today, 3));
  const [guests, setGuests] = useState(Number(searchParams.get('guests') || 2));
  const [specialRequests, setSpecialRequests] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [confirmation, setConfirmation] = useState(null);

  // Live availability for the dates currently in the form.
  const [availability, setAvailability] = useState(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    api.rooms
      .get(id)
      .then(({ room: found }) => setRoom(found))
      .catch((err) => setLoadError(err.message));
  }, [id]);

  const nights = nightsBetween(checkIn, checkOut);
  const datesInvalid = nights < 1;

  /**
   * Ask the API whether this room is actually free for these dates, rather
   * than only checking its operational status. Without this a guest could
   * reach a booked room from the catalogue and not find out until they
   * pressed Confirm.
   */
  useEffect(() => {
    if (datesInvalid) return undefined;

    const controller = new AbortController();
    setChecking(true);

    // Small debounce: the date inputs fire on every keystroke.
    const timer = setTimeout(() => {
      api.rooms
        .checkAvailability(id, { checkIn, checkOut, guests }, controller.signal)
        .then(setAvailability)
        .catch((err) => {
          if (err.name !== 'AbortError') setAvailability(null);
        })
        .finally(() => setChecking(false));
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [id, checkIn, checkOut, guests, datesInvalid]);

  const total = useMemo(
    () => (room ? Number(room.pricePerNight) * nights : 0),
    [room, nights]
  );

  const overCapacity = room ? guests > room.maxGuests : false;
  const unavailable = availability ? !availability.available : false;
  const canBook =
    room?.status === 'AVAILABLE' && !overCapacity && !datesInvalid && !unavailable && !checking;

  function handleCheckIn(value) {
    setCheckIn(value);
    if (nightsBetween(value, checkOut) < 1) setCheckOut(addDaysISO(value, 1));
  }

  async function onBook(event) {
    event.preventDefault();

    if (!user) {
      // Send them to sign in, then straight back to this room with the dates.
      const next = `/rooms/${id}?${new URLSearchParams({ checkIn, checkOut, guests: String(guests) })}`;
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const { booking } = await api.bookings.create({
        roomId: id,
        checkIn,
        checkOut,
        guests,
        ...(specialRequests.trim() ? { specialRequests: specialRequests.trim() } : {}),
      });
      setConfirmation(booking);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-cream-100">
        <Navbar />
        <div className="mx-auto max-w-2xl px-4 py-16">
          <Alert tone="error" title="Room not found">
            {loadError}
          </Alert>
          <Link href="/rooms" className="mt-4 inline-block text-sm text-brass-600">
            Back to all rooms
          </Link>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="grid min-h-screen place-items-center bg-cream-100">
        <Spinner />
      </div>
    );
  }

  // --- Booking confirmed -------------------------------------------------
  if (confirmation) {
    return (
      <div className="min-h-screen bg-cream-100">
        <Navbar />
        <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
          <Card className="animate-fade-up overflow-hidden">
            <div className="flex flex-col items-center bg-emerald-50 px-6 py-8 text-center">
              <CheckCircle2 className="size-10 text-emerald-600" aria-hidden />
              <h1 className="mt-3 font-serif text-2xl font-bold text-ink-900">
                Your stay is confirmed
              </h1>
              <p className="mt-1 text-sm text-ink-600">
                A confirmation has been recorded under your account.
              </p>
            </div>

            <dl className="divide-y divide-ink-100">
              {[
                ['Confirmation code', confirmation.reference],
                ['Room', `${confirmation.room.roomType} - Room ${confirmation.room.roomNumber}`],
                ['Check-in', `${formatDate(confirmation.checkIn)} from 2:00 PM`],
                ['Check-out', `${formatDate(confirmation.checkOut)} by 12:00 PM`],
                ['Guests', String(confirmation.guests)],
                [
                  'Total',
                  `${money(confirmation.totalAmount)} (${confirmation.nights} ${
                    confirmation.nights === 1 ? 'night' : 'nights'
                  })`,
                ],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 px-6 py-3 text-sm">
                  <dt className="text-ink-500">{label}</dt>
                  <dd className="text-right font-medium text-ink-900">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="flex flex-col gap-2 border-t border-ink-100 bg-ink-50 px-6 py-4 sm:flex-row">
              <Link href="/dashboard/my-bookings" className="flex-1">
                <Button className="w-full">View my bookings</Button>
              </Link>
              <Link href="/rooms" className="flex-1">
                <Button variant="outline" className="w-full">
                  Book another room
                </Button>
              </Link>
            </div>
          </Card>

          <p className="mt-4 text-center text-xs text-ink-500">
            You can cancel this booking free of charge until 24 hours before check-in.
          </p>
        </div>
      </div>
    );
  }

  // --- Booking form ------------------------------------------------------
  return (
    <div className="min-h-screen bg-cream-100">
      <Navbar />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Link
          href="/rooms"
          className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800"
        >
          <ArrowLeft className="size-4" />
          All rooms
        </Link>

        <div className="mt-5 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          {/* Room details */}
          <div>
            <Card className="overflow-hidden">
              <RoomGallery room={room} />

              <div className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h1 className="font-serif text-3xl font-bold text-ink-900">{room.roomType}</h1>
                    <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink-500">
                      <Users className="size-4" aria-hidden />
                      Maximum {room.maxGuests} {room.maxGuests === 1 ? 'guest' : 'guests'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold text-ink-900">
                      {money(room.pricePerNight)}
                    </p>
                    <p className="text-sm text-ink-500">per night</p>
                  </div>
                </div>

                {room.status !== 'AVAILABLE' && (
                  <Alert tone="warn" className="mt-4">
                    This room is currently marked{' '}
                    <strong>{room.status.toLowerCase().replace(/_/g, ' ')}</strong> and cannot be
                    booked. Please choose another room or contact reception.
                  </Alert>
                )}

                {room.description && (
                  <p className="mt-4 text-sm leading-relaxed text-ink-600">{room.description}</p>
                )}

                {room.amenities?.length > 0 && (
                  <div className="mt-6">
                    <h2 className="text-sm font-semibold text-ink-900">Room amenities</h2>
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {room.amenities.map((amenity) => (
                        <li key={amenity} className="flex items-start gap-2 text-sm text-ink-600">
                          <Check className="mt-0.5 size-4 shrink-0 text-brass-500" aria-hidden />
                          {amenity}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {room.hotel && (
                  <div className="mt-6 border-t border-ink-100 pt-5">
                    <h2 className="text-sm font-semibold text-ink-900">{room.hotel.name}</h2>
                    <p className="mt-1 text-sm text-ink-500">
                      {room.hotel.address}, {room.hotel.city}
                    </p>
                    <p className="mt-1 text-sm text-ink-500">{room.hotel.contactNumber}</p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Booking panel */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <Card className="overflow-hidden">
              <div className="border-b border-ink-100 px-5 py-4">
                <h2 className="font-serif text-lg font-semibold text-ink-900">Reserve this room</h2>
              </div>

              <form onSubmit={onBook} className="space-y-4 p-5">
                {error && <Alert tone="error">{error}</Alert>}

                {/* Availability for the dates currently selected. */}
                {!datesInvalid && unavailable && (
                  <Alert tone="warn" title="Not available for these dates">
                    <ul className="list-inside list-disc space-y-0.5">
                      {availability.reasons.map((reason) => (
                        <li key={reason.code}>{reason.message}</li>
                      ))}
                    </ul>
                    {availability.nextAvailableFrom && (
                      <button
                        type="button"
                        onClick={() => {
                          setCheckIn(availability.nextAvailableFrom);
                          setCheckOut(addDaysISO(availability.nextAvailableFrom, nights || 1));
                        }}
                        className="mt-2 font-medium underline underline-offset-2"
                      >
                        Try from {formatDate(availability.nextAvailableFrom)} instead
                      </button>
                    )}
                    <p className="mt-2">
                      Or{' '}
                      <Link
                        href={`/rooms?${new URLSearchParams({ checkIn, checkOut, guests: String(guests) })}`}
                        className="font-medium underline underline-offset-2"
                      >
                        see rooms that are free
                      </Link>{' '}
                      for these dates.
                    </p>
                  </Alert>
                )}

                {!datesInvalid && !unavailable && availability && (
                  <p className="flex items-center gap-1.5 text-sm text-emerald-700">
                    <Check className="size-4" aria-hidden />
                    Available for these dates
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Check-in" required>
                    <Input
                      type="date"
                      value={checkIn}
                      min={today}
                      onChange={(e) => handleCheckIn(e.target.value)}
                      required
                    />
                  </Field>
                  <Field label="Check-out" required error={datesInvalid ? 'Invalid' : undefined}>
                    <Input
                      type="date"
                      value={checkOut}
                      min={addDaysISO(checkIn, 1)}
                      onChange={(e) => setCheckOut(e.target.value)}
                      error={datesInvalid}
                      required
                    />
                  </Field>
                </div>

                <Field
                  label="Guests"
                  required
                  error={overCapacity ? `This room sleeps at most ${room.maxGuests}` : undefined}
                >
                  <Select
                    value={guests}
                    onChange={(e) => setGuests(Number(e.target.value))}
                    error={overCapacity}
                  >
                    {Array.from({ length: Math.max(room.maxGuests, guests) }, (_, i) => i + 1).map(
                      (n) => (
                        <option key={n} value={n} disabled={n > room.maxGuests}>
                          {n} {n === 1 ? 'guest' : 'guests'}
                          {n > room.maxGuests ? ' - over capacity' : ''}
                        </option>
                      )
                    )}
                  </Select>
                </Field>

                <Field label="Special requests" hint="Optional">
                  <Textarea
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    placeholder="High floor, early check-in, dietary needs..."
                    maxLength={1000}
                  />
                </Field>

                {/* Price breakdown */}
                <div className="space-y-1.5 rounded-lg bg-ink-50 p-4 text-sm">
                  <div className="flex justify-between text-ink-600">
                    <span>
                      {money(room.pricePerNight)} &times; {nights}{' '}
                      {nights === 1 ? 'night' : 'nights'}
                    </span>
                    <span>{money(total)}</span>
                  </div>
                  <div className="flex justify-between border-t border-ink-200 pt-1.5 font-semibold text-ink-900">
                    <span>Total</span>
                    <span>{money(total)}</span>
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="brass"
                  size="lg"
                  loading={submitting || checking}
                  disabled={!canBook || authLoading}
                  className="w-full"
                >
                  {checking
                    ? 'Checking availability'
                    : unavailable
                      ? 'Not available'
                      : !user
                        ? 'Sign in to book'
                        : isStaff
                          ? 'Book for guest'
                          : 'Confirm booking'}
                </Button>

                <p className="text-center text-xs text-ink-400">
                  Free cancellation until 24 hours before check-in.
                </p>
              </form>
            </Card>

            {isStaff && (
              <Alert tone="info" className="mt-4 text-xs">
                You are signed in as staff. This books the room under your own account - use the
                Bookings desk to book on behalf of a guest.
              </Alert>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RoomPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center bg-cream-100">
          <Spinner />
        </div>
      }
    >
      <RoomDetail />
    </Suspense>
  );
}
