'use client';

import { BedDouble, SearchX } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { AvailabilitySearch } from '@/components/AvailabilitySearch';
import { Navbar } from '@/components/Navbar';
import { RoomCard } from '@/components/RoomCard';
import { Alert, Card, EmptyState, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { addDaysISO, formatDate, todayISO } from '@/lib/format';

function RoomsBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Browsing without dates used to list every room, including ones already
  // booked - so a guest could open a room and only discover the clash when
  // they pressed Confirm. This page is now always an availability search:
  // absent dates fall back to tomorrow for two nights.
  const today = todayISO();
  const checkIn = searchParams.get('checkIn') || addDaysISO(today, 1);
  const checkOut = searchParams.get('checkOut') || addDaysISO(today, 3);
  const guests = Number(searchParams.get('guests') || 2);
  const roomType = searchParams.get('roomType') || '';
  const datesWereGiven = Boolean(searchParams.get('checkIn') && searchParams.get('checkOut'));

  const [roomTypes, setRoomTypes] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.rooms
      .types()
      .then(({ types }) => setRoomTypes(types))
      .catch(() => setRoomTypes([]));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    api.rooms
      .availability({ checkIn, checkOut, guests, roomType }, controller.signal)
      .then((data) => ({ stay: data.stay, rooms: data.rooms, mode: 'availability' }))
      .then(setResult)
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [checkIn, checkOut, guests, roomType]);

  const onSearch = useCallback(
    (params) => router.push(`/rooms?${new URLSearchParams(params).toString()}`),
    [router]
  );

  return (
    <div className="min-h-screen bg-cream-100">
      <Navbar />

      <div className="relative z-20 border-b border-cream-300 bg-cream-50">
        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
          <h1 className="font-serif text-3xl font-bold text-ink-900">Rooms &amp; suites</h1>
          <p className="mt-1 text-sm text-ink-500">
            Showing rooms still free from {formatDate(checkIn)} to {formatDate(checkOut)}
            {datesWereGiven ? '' : ' (default dates - change them below)'}. Rooms already
            booked for these dates are not listed.
          </p>
          <div className="mt-5">
            <AvailabilitySearch
              variant="inline"
              roomTypes={roomTypes}
              initial={{ checkIn, checkOut, guests, roomType }}
              onSearch={onSearch}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {error && (
          <Alert tone="error" title="Could not load rooms">
            {error}
          </Alert>
        )}

        {loading ? (
          <div className="grid place-items-center py-20">
            <Spinner />
          </div>
        ) : !result?.rooms?.length ? (
          <Card>
            <EmptyState
              icon={SearchX}
              title="No rooms match this search"
              action={
                <button
                  type="button"
                  onClick={() => router.push('/rooms')}
                  className="text-sm font-medium text-brass-600 hover:text-brass-700"
                >
                  Clear filters
                </button>
              }
            >
              Every matching room is taken for those dates. Try different dates, a
              different room type, or a smaller party.
            </EmptyState>
          </Card>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm text-ink-500">
              <BedDouble className="size-4" aria-hidden />
              {result.rooms.length} {result.rooms.length === 1 ? 'room' : 'rooms'}
              {result.stay && (
                <>
                  {' '}
                  &middot; {result.stay.nights}{' '}
                  {result.stay.nights === 1 ? 'night' : 'nights'} &middot; {result.stay.guests}{' '}
                  {result.stay.guests === 1 ? 'guest' : 'guests'}
                </>
              )}
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {result.rooms.map((room) => (
                <RoomCard key={room.id} room={room} stay={{ checkIn, checkOut, guests }} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function RoomsPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center bg-cream-100">
          <Spinner />
        </div>
      }
    >
      <RoomsBrowser />
    </Suspense>
  );
}
