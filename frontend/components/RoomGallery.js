'use client';

import { useState } from 'react';
import { SmartImage } from '@/components/SmartImage';

/**
 * Photo gallery for a room: one large frame plus thumbnails.
 *
 * With no photographs it collapses to a single placeholder, so the page
 * layout is identical either way.
 */
export function RoomGallery({ room }) {
  const images = room.images ?? [];
  const [active, setActive] = useState(0);
  const current = images[active] ?? room.coverImage ?? null;

  return (
    <div>
      <div className="relative aspect-16/10 bg-ink-900">
        <SmartImage
          image={current}
          alt={`${room.roomType}, room ${room.roomNumber}`}
          label={room.roomType}
          priority
          sizes="(max-width: 1024px) 100vw, 60vw"
        />
        <span className="absolute top-4 left-4 rounded-md bg-ink-950/70 px-2.5 py-1 text-xs font-medium text-brass-200 backdrop-blur-sm">
          Room {room.roomNumber}
        </span>
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto p-3">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`Show photograph ${index + 1} of ${images.length}`}
              aria-current={index === active}
              className={`relative size-16 shrink-0 overflow-hidden rounded-lg ring-2 transition-all ${
                index === active ? 'ring-brass-500' : 'ring-transparent hover:ring-ink-300'
              }`}
            >
              <SmartImage image={image} alt="" sizes="64px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
