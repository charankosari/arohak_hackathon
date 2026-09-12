'use client';

import { Search, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { DateRangePicker } from '@/components/DateRangePicker';
import { Dropdown } from '@/components/Dropdown';
import { addDaysISO, nightsBetween, todayISO } from '@/lib/format';

const GUEST_OPTIONS = [1, 2, 3, 4].map((n) => ({
  value: n,
  label: `${n} ${n === 1 ? 'guest' : 'guests'}`,
}));

/**
 * Date + party-size picker, styled as one continuous pill.
 *
 * Uses a custom calendar and listbox rather than native `<input type=date>`
 * and `<select>`: those render differently in every browser and their popups
 * collided with the surrounding layout.
 *
 * Submits to /rooms as query params, so a search is shareable and survives a
 * reload.
 */
export function AvailabilitySearch({ initial = {}, variant = 'hero', roomTypes = [], onSearch }) {
  const router = useRouter();
  const today = todayISO();

  const [checkIn, setCheckIn] = useState(initial.checkIn || addDaysISO(today, 1));
  const [checkOut, setCheckOut] = useState(initial.checkOut || addDaysISO(today, 3));
  const [guests, setGuests] = useState(initial.guests || 2);
  const [roomType, setRoomType] = useState(initial.roomType || '');

  const nights = nightsBetween(checkIn, checkOut);
  const invalid = nights < 1;

  function submit(event) {
    event.preventDefault();
    if (invalid) return;

    const params = { checkIn, checkOut, guests: String(guests) };
    if (roomType) params.roomType = roomType;

    if (onSearch) onSearch(params);
    else router.push(`/rooms?${new URLSearchParams(params).toString()}`);
  }

  const showTypes = variant !== 'hero' && roomTypes.length > 0;
  const typeOptions = [
    { value: '', label: 'Any room type' },
    ...roomTypes.map((t) => ({ value: t.roomType, label: t.roomType })),
  ];

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-1 rounded-[1.75rem] bg-white p-2 shadow-sm ring-1 ring-cream-300 md:flex-row md:items-center md:gap-0 md:rounded-full"
    >
      {/* Dates */}
      <div className="min-w-0 flex-1 rounded-2xl px-3 py-2 transition-colors hover:bg-cream-100 md:rounded-full">
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

      <Divider />

      {/* Guests */}
      <div className="min-w-0 rounded-2xl px-3 py-2 transition-colors hover:bg-cream-100 md:w-44 md:rounded-full">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sky-100 text-ink-700">
            <Users className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <span className="block text-[11px] font-medium tracking-wide text-ink-400 uppercase">
              Guests
            </span>
            <Dropdown
              value={guests}
              onChange={setGuests}
              options={GUEST_OPTIONS}
              label="Number of guests"
            />
          </div>
        </div>
      </div>

      {showTypes && (
        <>
          <Divider />
          <div className="min-w-0 rounded-2xl px-3 py-2 transition-colors hover:bg-cream-100 md:w-52 md:rounded-full">
            <span className="block text-[11px] font-medium tracking-wide text-ink-400 uppercase">
              Room type
            </span>
            <Dropdown
              value={roomType}
              onChange={setRoomType}
              options={typeOptions}
              label="Room type"
            />
          </div>
        </>
      )}

      <button
        type="submit"
        disabled={invalid}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-ink-900 px-7 py-3.5 text-sm font-medium text-cream-100 transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:bg-ink-300 md:ml-1"
      >
        <Search className="size-4" aria-hidden />
        Search
      </button>
    </form>
  );
}

const Divider = () => (
  <span aria-hidden className="hidden w-px self-center bg-cream-300 md:block md:h-10" />
);
