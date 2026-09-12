'use client';

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { addDaysISO, formatDateShort, nightsBetween, todayISO } from '@/lib/format';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/** Build the day grid for one month, padded to whole weeks. */
function monthGrid(year, month) {
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const leading = first.getUTCDay();

  const cells = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(Date.UTC(year, month, day)));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const iso = (date) => date.toISOString().slice(0, 10);
const monthLabel = (year, month) =>
  new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month, 1))
  );

/**
 * Two-month range calendar in a popover.
 *
 * Replaces a pair of native date inputs: those cannot be styled, render
 * differently in every browser, and their popup collided with the search bar.
 * First click sets check-in, second sets check-out; clicking an earlier date
 * restarts the range.
 */
export function DateRangePicker({ checkIn, checkOut, onChange, minDate }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(null);
  // 'down' by default; flips to 'up' when the viewport has no room below.
  const [placement, setPlacement] = useState('down');
  const [cursor, setCursor] = useState(() => {
    const [y, m] = (checkIn || todayISO()).split('-').map(Number);
    return { year: y, month: m - 1 };
  });
  const rootRef = useRef(null);

  const min = minDate ?? todayISO();
  const nights = nightsBetween(checkIn, checkOut);

  // Decide which way to open before the popover paints.
  useEffect(() => {
    if (!open) return;
    const trigger = rootRef.current?.getBoundingClientRect();
    if (!trigger) return;
    const NEEDED = 420; // roughly the popover's height
    const below = window.innerHeight - trigger.bottom;
    setPlacement(below < NEEDED && trigger.top > below ? 'up' : 'down');
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const months = useMemo(() => {
    const next = cursor.month === 11 ? { year: cursor.year + 1, month: 0 } : { year: cursor.year, month: cursor.month + 1 };
    return [cursor, next];
  }, [cursor]);

  function step(delta) {
    setCursor(({ year, month }) => {
      const m = month + delta;
      if (m < 0) return { year: year - 1, month: 11 };
      if (m > 11) return { year: year + 1, month: 0 };
      return { year, month: m };
    });
  }

  function pick(date) {
    const value = iso(date);

    // No range yet, or a complete one: start over from this date.
    if (!checkIn || (checkIn && checkOut)) {
      onChange({ checkIn: value, checkOut: addDaysISO(value, 1) });
      return;
    }
    // Second click earlier than the first: treat it as a new start.
    if (value <= checkIn) {
      onChange({ checkIn: value, checkOut: addDaysISO(value, 1) });
      return;
    }
    onChange({ checkIn, checkOut: value });
    setOpen(false);
  }

  /** Preview the range the pointer is currently describing. */
  const previewEnd = checkIn && !checkOut && hovered && hovered > checkIn ? hovered : checkOut;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex w-full items-center gap-3 text-left"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sky-100 text-ink-700">
          <CalendarDays className="size-4" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block text-[11px] font-medium tracking-wide text-ink-400 uppercase">
            {nights > 0 ? `${nights} night${nights === 1 ? '' : 's'}` : 'Select dates'}
          </span>
          <span className="block truncate text-sm font-medium text-ink-900">
            {checkIn && checkOut
              ? `${formatDateShort(checkIn)} – ${formatDateShort(checkOut)}`
              : 'Add dates'}
          </span>
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose your dates"
          className={`animate-fade-up absolute left-0 z-50 w-[20rem] rounded-3xl border border-cream-300 bg-white p-4 shadow-2xl sm:w-[34rem] ${
            placement === 'up' ? 'bottom-full mb-3' : 'top-full mt-3'
          }`}
        >
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous month"
              className="grid size-8 place-items-center rounded-full text-ink-600 hover:bg-cream-100"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <p className="text-sm font-semibold text-ink-900">
              {monthLabel(months[0].year, months[0].month)}
              <span className="hidden sm:inline">
                {' '}
                — {monthLabel(months[1].year, months[1].month)}
              </span>
            </p>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next month"
              className="grid size-8 place-items-center rounded-full text-ink-600 hover:bg-cream-100"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {months.map((m, index) => (
              <div key={`${m.year}-${m.month}`} className={index === 1 ? 'hidden sm:block' : ''}>
                <p className="mb-2 text-center text-xs font-medium text-ink-500 sm:hidden">
                  {monthLabel(m.year, m.month)}
                </p>
                <div className="grid grid-cols-7 gap-0.5">
                  {WEEKDAYS.map((d) => (
                    <span
                      key={d}
                      className="grid h-7 place-items-center text-[11px] font-medium text-ink-400"
                    >
                      {d}
                    </span>
                  ))}

                  {monthGrid(m.year, m.month).map((date, cellIndex) => {
                    if (!date) return <span key={`pad-${cellIndex}`} />;

                    const value = iso(date);
                    const disabled = value < min;
                    const isStart = value === checkIn;
                    const isEnd = value === checkOut;
                    const inRange =
                      checkIn && previewEnd && value > checkIn && value < previewEnd;

                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={disabled}
                        onClick={() => pick(date)}
                        onMouseEnter={() => setHovered(value)}
                        onMouseLeave={() => setHovered(null)}
                        aria-label={value}
                        aria-pressed={isStart || isEnd}
                        className={[
                          'numerals grid h-9 place-items-center text-sm transition-colors',
                          disabled && 'cursor-not-allowed text-ink-200',
                          !disabled && !isStart && !isEnd && !inRange && 'text-ink-700 hover:bg-cream-200',
                          inRange && 'bg-sky-100 text-ink-900',
                          (isStart || isEnd) && 'bg-ink-900 font-semibold text-cream-100',
                          isStart && 'rounded-l-full',
                          isEnd && 'rounded-r-full',
                          !isStart && !isEnd && !inRange && 'rounded-full',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {date.getUTCDate()}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-cream-200 pt-3">
            <p className="text-xs text-ink-500">
              {checkIn && checkOut
                ? `${formatDateShort(checkIn)} → ${formatDateShort(checkOut)} · ${nights} night${nights === 1 ? '' : 's'}`
                : 'Pick your arrival date'}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full bg-ink-900 px-4 py-1.5 text-xs font-medium text-cream-100 hover:bg-ink-800"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
