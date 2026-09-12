'use client';

import { CalendarDays, Search, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { addDaysISO, nightsBetween, todayISO } from '@/lib/format';

/**
 * Date + party-size picker, styled as one continuous pill with hairline
 * dividers rather than separate boxed inputs.
 *
 * Submits to /rooms as query params, so a search is shareable and survives a
 * reload.
 */
export function AvailabilitySearch({ initial = {}, variant = 'hero', roomTypes = [], onSearch }) {
  const router = useRouter();
  const today = todayISO();
  const uid = useId();

  const [checkIn, setCheckIn] = useState(initial.checkIn || addDaysISO(today, 1));
  const [checkOut, setCheckOut] = useState(initial.checkOut || addDaysISO(today, 3));
  const [guests, setGuests] = useState(initial.guests || 2);
  const [roomType, setRoomType] = useState(initial.roomType || '');

  const nights = nightsBetween(checkIn, checkOut);
  const invalid = nights < 1;

  /** Check-out must stay after check-in, so it follows a later check-in date. */
  function handleCheckIn(value) {
    setCheckIn(value);
    if (nightsBetween(value, checkOut) < 1) setCheckOut(addDaysISO(value, 1));
  }

  function submit(event) {
    event.preventDefault();
    if (invalid) return;

    const params = { checkIn, checkOut, guests: String(guests) };
    if (roomType) params.roomType = roomType;

    if (onSearch) onSearch(params);
    else router.push(`/rooms?${new URLSearchParams(params).toString()}`);
  }

  const showTypes = variant !== 'hero' && roomTypes.length > 0;

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-2 rounded-[1.75rem] bg-white p-2 shadow-sm ring-1 ring-cream-300 md:flex-row md:items-stretch md:rounded-full md:gap-0"
    >
      {/* Check-in */}
      <Segment
        icon={CalendarDays}
        label="Check-in"
        htmlFor={`${uid}-in`}
        className="md:flex-1"
      >
        <input
          id={`${uid}-in`}
          type="date"
          value={checkIn}
          min={today}
          onChange={(e) => handleCheckIn(e.target.value)}
          className="w-full bg-transparent text-sm font-medium text-ink-900 outline-none"
          required
        />
      </Segment>

      <Divider />

      {/* Check-out */}
      <Segment
        icon={CalendarDays}
        label={invalid ? 'Check-out — must be later' : `Check-out · ${nights} night${nights === 1 ? '' : 's'}`}
        htmlFor={`${uid}-out`}
        className="md:flex-1"
        error={invalid}
      >
        <input
          id={`${uid}-out`}
          type="date"
          value={checkOut}
          min={addDaysISO(checkIn, 1)}
          onChange={(e) => setCheckOut(e.target.value)}
          className="w-full bg-transparent text-sm font-medium text-ink-900 outline-none"
          required
        />
      </Segment>

      <Divider />

      {/* Guests */}
      <Segment icon={Users} label="Guests" htmlFor={`${uid}-guests`} className="md:w-40">
        <select
          id={`${uid}-guests`}
          value={guests}
          onChange={(e) => setGuests(Number(e.target.value))}
          className="w-full cursor-pointer bg-transparent text-sm font-medium text-ink-900 outline-none"
        >
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? 'guest' : 'guests'}
            </option>
          ))}
        </select>
      </Segment>

      {showTypes && (
        <>
          <Divider />
          <Segment label="Room type" htmlFor={`${uid}-type`} className="md:w-48">
            <select
              id={`${uid}-type`}
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
              className="w-full cursor-pointer bg-transparent text-sm font-medium text-ink-900 outline-none"
            >
              <option value="">Any type</option>
              {roomTypes.map((t) => (
                <option key={t.roomType} value={t.roomType}>
                  {t.roomType}
                </option>
              ))}
            </select>
          </Segment>
        </>
      )}

      <button
        type="submit"
        disabled={invalid}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-ink-900 px-7 py-3.5 text-sm font-medium text-cream-100 transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:bg-ink-300 md:ml-2"
      >
        <Search className="size-4" aria-hidden />
        Search
      </button>
    </form>
  );
}

function Segment({ icon: Icon, label, htmlFor, children, className = '', error }) {
  return (
    <div className={`min-w-0 rounded-2xl px-4 py-2.5 transition-colors hover:bg-cream-100 md:rounded-full ${className}`}>
      <label
        htmlFor={htmlFor}
        className={`flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase ${
          error ? 'text-rose-600' : 'text-ink-400'
        }`}
      >
        {Icon && <Icon className="size-3" aria-hidden />}
        {label}
      </label>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

const Divider = () => <span aria-hidden className="hidden w-px self-center bg-cream-300 md:block md:h-9" />;
