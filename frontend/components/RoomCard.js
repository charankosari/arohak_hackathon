'use client';

import { BedDouble, Users } from 'lucide-react';
import Link from 'next/link';
import { Badge, Button, Card } from '@/components/ui';
import { money } from '@/lib/format';

/**
 * A room in the guest-facing catalogue. `stay` carries the searched dates so
 * the detail page can pre-fill them and show the correct total.
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
    <Card className="flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <div className="relative flex h-32 items-center justify-center bg-ink-900">
        <BedDouble className="size-9 text-brass-400" aria-hidden />
        <span className="absolute top-3 left-3 rounded-md bg-ink-950/70 px-2 py-1 text-xs font-medium text-brass-200">
          Room {room.roomNumber}
        </span>
        {showStatus && (
          <span className="absolute top-3 right-3">
            <Badge status={room.status} />
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
                className="rounded-md bg-ink-50 px-2 py-0.5 text-xs text-ink-600 ring-1 ring-ink-200 ring-inset"
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

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-ink-100 pt-4">
          <div>
            <p>
              <span className="text-xl font-semibold text-ink-900">
                {money(room.pricePerNight)}
              </span>
              <span className="text-sm text-ink-500"> / night</span>
            </p>
            {room.quote && (
              <p className="mt-0.5 text-xs text-ink-500">
                {money(room.quote.totalAmount)} for {room.quote.nights}{' '}
                {room.quote.nights === 1 ? 'night' : 'nights'}
              </p>
            )}
          </div>
          <Link href={`/rooms/${room.id}${query}`}>
            <Button variant="primary" size="sm">
              {stay?.checkIn ? 'Book' : 'View'}
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
