'use client';

import { ArrowRight, Users } from 'lucide-react';
import Link from 'next/link';
import { SmartImage } from '@/components/SmartImage';
import { Badge } from '@/components/ui';
import { money } from '@/lib/format';

/**
 * A room in the guest-facing catalogue.
 *
 * The whole card is the link, not just the button — anywhere you click takes
 * you to that room. `stay` carries the searched dates through so the detail
 * page opens pre-filled with the correct total.
 */
export function RoomCard({ room, stay, showStatus = false }) {
  const query = stay?.checkIn
    ? `?${new URLSearchParams({
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        guests: String(stay.guests ?? 1),
      }).toString()}`
    : '';

  return (
    <Link
      href={`/rooms/${room.id}${query}`}
      aria-label={`${room.roomType}, room ${room.roomNumber} — ${money(room.pricePerNight)} per night`}
      className="group flex flex-col overflow-hidden rounded-3xl border border-cream-300 bg-white shadow-sm transition-shadow hover:shadow-xl"
    >
      <div className="relative aspect-4/3 overflow-hidden bg-ink-900">
        <SmartImage
          image={room.coverImage}
          alt={`${room.roomType}, room ${room.roomNumber}`}
          label={room.roomType}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="transition-transform duration-700 group-hover:scale-105"
        />
        <span className="absolute top-3 left-3 rounded-full bg-ink-950/70 px-2.5 py-1 text-xs font-medium text-cream-100 backdrop-blur-sm">
          Room {room.roomNumber}
        </span>
        {showStatus && (
          <span className="absolute top-3 right-3">
            <Badge status={room.status} />
          </span>
        )}
        {room.images?.length > 1 && (
          <span className="absolute right-3 bottom-3 rounded-full bg-ink-950/60 px-2 py-0.5 text-[11px] text-cream-100 backdrop-blur-sm">
            {room.images.length} photos
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-serif text-xl font-semibold text-ink-900">{room.roomType}</h3>

        <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-500">
          <Users className="size-3.5" aria-hidden />
          Sleeps up to {room.maxGuests}
        </p>

        {room.description && (
          <p className="mt-2.5 line-clamp-2 text-sm text-ink-500">{room.description}</p>
        )}

        {room.amenities?.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {room.amenities.slice(0, 3).map((amenity) => (
              <li
                key={amenity}
                className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs text-ink-600"
              >
                {amenity}
              </li>
            ))}
            {room.amenities.length > 3 && (
              <li className="px-1 py-0.5 text-xs text-ink-400">
                +{room.amenities.length - 3} more
              </li>
            )}
          </ul>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-cream-300 pt-4">
          <div>
            <p>
              <span className="numerals text-xl font-semibold text-ink-900">
                {money(room.pricePerNight)}
              </span>
              <span className="text-sm text-ink-500"> / night</span>
            </p>
            {room.quote && (
              <p className="numerals mt-0.5 text-xs text-ink-500">
                {money(room.quote.totalAmount)} for {room.quote.nights}{' '}
                {room.quote.nights === 1 ? 'night' : 'nights'}
              </p>
            )}
          </div>

          {/* Visual affordance only - the whole card is already the link. */}
          <span
            aria-hidden
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-sky-200 py-1.5 pr-1.5 pl-4 text-sm font-medium text-ink-900 transition-colors group-hover:bg-ink-900 group-hover:text-cream-100"
          >
            {stay?.checkIn ? 'Book' : 'View'}
            <span className="grid size-7 place-items-center rounded-full bg-white/70 text-ink-900 transition-transform group-hover:translate-x-0.5">
              <ArrowRight className="size-3.5" />
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}
