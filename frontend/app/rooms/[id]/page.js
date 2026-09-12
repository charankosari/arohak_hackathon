'use client';

import { ArrowLeft, ArrowUpRight, Check, CheckCircle2, Clock3, MapPin, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { DateRangePicker } from '@/components/DateRangePicker';
import { Dropdown } from '@/components/Dropdown';
import { Navbar } from '@/components/Navbar';
import { RoomGallery } from '@/components/RoomGallery';
import { Alert, Button, Card, Field, Spinner, Textarea } from '@/components/ui';
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

      <div className="room-detail mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        <Link
          href="/rooms"
          className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800"
        >
          <ArrowLeft className="size-4" />
          All rooms
        </Link>

        <header className="mt-7 mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-brass-800 uppercase">Your private retreat</p>
            <h1 className="font-serif text-4xl font-medium tracking-tight text-ink-900 sm:text-5xl">{room.roomType}</h1>
            <p className="mt-3 flex items-center gap-2 text-sm text-ink-500"><MapPin className="size-4" aria-hidden />{room.hotel?.name ?? 'The Meridian Grand'}{room.hotel?.city ? ' · ' + room.hotel.city : ''}</p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-cream-300 bg-cream-50 px-4 py-2.5 text-sm text-ink-600"><Users className="size-4" aria-hidden />Up to {room.maxGuests} {room.maxGuests === 1 ? 'guest' : 'guests'}</div>
        </header>
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(340px,1fr)] lg:gap-10">
          {/* Room details */}
          <div>
            <section className="min-w-0">
              <RoomGallery room={room} />

              <div className="py-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <h2 className="font-serif text-3xl text-ink-900">A little room to unwind.</h2>
                  <span className="text-xs tracking-wide text-ink-500">Room {room.roomNumber}</span>
                </div>

                {room.status !== 'AVAILABLE' && (
                  <Alert tone="warn" className="mt-4">
                    This room is currently marked{' '}
                    <strong>{room.status.toLowerCase().replace(/_/g, ' ')}</strong> and cannot be
                    booked. Please choose another room or contact reception.
                  </Alert>
                )}

                {room.description && (
                  <p className="mt-4 max-w-2xl text-base leading-8 text-ink-600">{room.description}</p>
                )}

                {room.amenities?.length > 0 && (
                  <div className="mt-8 border-t border-cream-300 pt-7">
                    <h2 className="font-serif text-2xl text-ink-900">Thoughtful comforts</h2>
                    <ul className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
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
            </section>
          </div>

          {/* Booking panel */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <Card className="reservation-panel !rounded-xl !border-cream-400 !bg-cream-50">
              <div className="border-b border-cream-300 px-6 pt-6 pb-5 sm:px-7">
                <p className="text-xs font-medium tracking-[0.16em] text-brass-800 uppercase">Make it your stay</p>
                <div className="mt-3 flex items-baseline gap-2"><span className="numerals text-3xl font-semibold tracking-tight text-ink-900">{money(room.pricePerNight)}</span><span className="text-sm text-ink-500">/ night</span></div>
                <h2 className="mt-2 text-sm text-ink-500">Reserve your {room.roomType.toLowerCase()}</h2>
              </div>

              <form onSubmit={onBook} className="space-y-5 p-6 sm:p-7">
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
                  <p role="status" className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-800">
                    <Check className="size-4" aria-hidden />
                    Available for these dates
                  </p>
                )}

                {/* Same calendar and listbox as the search bar, so the
                    booking flow feels like one continuous interface. */}
                <div className="rounded-lg border border-cream-400 bg-white px-4 py-3">
                  <DateRangePicker
                    checkIn={checkIn}
                    checkOut={checkOut}
                    minDate={today}
                    onChange={({ checkIn: nextIn, checkOut: nextOut }) => {
                      setCheckIn(nextIn);
                      setCheckOut(nextOut);
                    }}
                  />
                </div>

                <Field
                  label="Guests"
                  required
                  error={overCapacity ? `This room sleeps at most ${room.maxGuests}` : undefined}
                >
                  <div
                    className={`rounded-xl border px-3.5 py-2.5 ${
                      overCapacity ? 'border-rose-400' : 'border-cream-400'
                    }`}
                  >
                    <Dropdown
                      value={guests}
                      onChange={setGuests}
                      label="Number of guests"
                      options={Array.from({ length: room.maxGuests }, (_, i) => i + 1).map((n) => ({
                        value: n,
                        label: `${n} ${n === 1 ? 'guest' : 'guests'}`,
                      }))}
                    />
                  </div>
                </Field>

                <Field label="Special requests (optional)" hint="We’ll do our best to accommodate your preferences.">
                  <Textarea
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    placeholder="High floor, early check-in, dietary needs..."
                    maxLength={1000}
                  />
                </Field>

                {/* Price breakdown */}
                <div className="space-y-3 border-t border-cream-300 pt-5 text-sm">
                  <div className="flex justify-between text-ink-600">
                    <span>
                      {money(room.pricePerNight)} &times; {nights}{' '}
                      {nights === 1 ? 'night' : 'nights'}
                    </span>
                    <span>{money(total)}</span>
                  </div>
                  <div className="flex justify-between border-t border-cream-300 pt-3 text-lg font-semibold text-ink-900">
                    <span>Total</span>
                    <span>{money(total)}</span>
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={submitting || checking}
                  disabled={!canBook || authLoading}
                  className="w-full !rounded-lg py-3.5"
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
                  {!checking && !submitting && !unavailable && <ArrowUpRight className="size-4" aria-hidden />}
                </Button>

                <p className="text-center text-xs leading-5 text-ink-500">
                  Free cancellation until 24 hours before check-in.
                </p>
              </form>
            </Card>

            <div className="mt-5 flex justify-center gap-5 text-xs text-ink-500"><span className="flex items-center gap-1.5"><Clock3 className="size-3.5" aria-hidden />Check-in 2:00 PM</span><span>Check-out 12:00 PM</span></div>
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
