'use client';

import { CalendarDays, Search, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Field, Input, Select } from '@/components/ui';
import { addDaysISO, nightsBetween, todayISO } from '@/lib/format';

/**
 * Date + party-size picker. Submits to /rooms as query params so a search is
 * shareable and survives a reload.
 */
export function AvailabilitySearch({
  initial = {},
  variant = 'hero',
  roomTypes = [],
  onSearch,
}) {
  const router = useRouter();
  const today = todayISO();

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

  const hero = variant === 'hero';

  return (
    <form
      onSubmit={submit}
      className={
        hero
          ? 'grid gap-3 rounded-xl border border-ink-200 bg-white p-4 shadow-lg sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto]'
          : 'grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_1fr_auto]'
      }
    >
      <Field label="Check-in" required>
        <div className="relative">
          <CalendarDays className="pointer-events-none absolute top-2.5 left-3 size-4 text-ink-400" />
          <Input
            type="date"
            value={checkIn}
            min={today}
            onChange={(e) => handleCheckIn(e.target.value)}
            className="pl-9"
            required
          />
        </div>
      </Field>

      <Field
        label="Check-out"
        required
        error={invalid ? 'Must be after check-in' : undefined}
        hint={!invalid ? `${nights} night${nights === 1 ? '' : 's'}` : undefined}
      >
        <div className="relative">
          <CalendarDays className="pointer-events-none absolute top-2.5 left-3 size-4 text-ink-400" />
          <Input
            type="date"
            value={checkOut}
            min={addDaysISO(checkIn, 1)}
            onChange={(e) => setCheckOut(e.target.value)}
            className="pl-9"
            error={invalid}
            required
          />
        </div>
      </Field>

      <Field label="Guests" required className="sm:max-w-28">
        <div className="relative">
          <Users className="pointer-events-none absolute top-2.5 left-3 size-4 text-ink-400" />
          <Select
            value={guests}
            onChange={(e) => setGuests(Number(e.target.value))}
            className="pl-9"
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </div>
      </Field>

      {!hero && roomTypes.length > 0 && (
        <Field label="Room type">
          <Select value={roomType} onChange={(e) => setRoomType(e.target.value)}>
            <option value="">Any room type</option>
            {roomTypes.map((t) => (
              <option key={t.roomType} value={t.roomType}>
                {t.roomType}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <div className="flex items-end">
        <Button type="submit" variant="brass" size="lg" disabled={invalid} className="w-full">
          <Search className="size-4" />
          Search
        </Button>
      </div>
    </form>
  );
}
