'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
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
      <div className="relative aspect-4/3 overflow-hidden rounded-xl bg-ink-900 sm:aspect-16/10">
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
        {images.length > 1 && <div className="absolute inset-x-4 bottom-4 flex items-center justify-between">
          <span aria-live="polite" className="rounded-md bg-ink-950/70 px-3 py-2 text-xs text-white backdrop-blur-sm">{active + 1} / {images.length} photos</span>
          <div className="flex gap-2">
            <button type="button" aria-label="Previous photo" onClick={() => setActive((index) => (index - 1 + images.length) % images.length)} className="grid size-10 place-items-center rounded-full bg-cream-50 text-ink-900 transition-colors hover:bg-cream-200"><ChevronLeft className="size-4" /></button>
            <button type="button" aria-label="Next photo" onClick={() => setActive((index) => (index + 1) % images.length)} className="grid size-10 place-items-center rounded-full bg-cream-50 text-ink-900 transition-colors hover:bg-cream-200"><ChevronRight className="size-4" /></button>
          </div>
        </div>}
      </div>

      {images.length > 1 && (
        <div className="flex gap-3 overflow-x-auto px-0.5 pt-4 pb-1">
          {images.map((image, index) => (
            <button
              key={image.id ?? index}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`Show photograph ${index + 1} of ${images.length}`}
              aria-current={index === active}
              className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg ring-2 transition-all ${
                index === active ? 'ring-brass-500' : 'ring-transparent hover:ring-ink-300'
              }`}
            >
              <SmartImage image={image} alt="" sizes="96px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
