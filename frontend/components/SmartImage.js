'use client';

import { BedDouble, Building2, ImageOff } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

/**
 * Renders an admin-uploaded Cloudinary photo, or a designed placeholder when
 * there is none.
 *
 * Photography is optional throughout the app, so the placeholder has to look
 * deliberate rather than broken — it keeps the same aspect ratio and carries
 * the brand's navy/brass palette.
 */
export function SmartImage({
  image,
  alt,
  fill = true,
  sizes = '100vw',
  priority = false,
  className = '',
  placeholderIcon = 'room',
  label,
}) {
  const [failed, setFailed] = useState(false);
  const usable = image?.url && !failed;

  if (usable) {
    return (
      <Image
        src={image.url}
        alt={image.alt || alt || ''}
        fill={fill}
        sizes={sizes}
        priority={priority}
        onError={() => setFailed(true)}
        className={`object-cover ${className}`}
      />
    );
  }

  const Icon = placeholderIcon === 'hotel' ? Building2 : failed ? ImageOff : BedDouble;

  return (
    <div
      role="img"
      aria-label={alt || label || 'No photograph available'}
      className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-linear-to-br from-ink-900 via-ink-800 to-ink-900 ${className}`}
    >
      <Icon className="size-8 text-brass-400/80" aria-hidden />
      {label && (
        <span className="px-3 text-center font-serif text-sm text-brass-200/70">{label}</span>
      )}
    </div>
  );
}

/**
 * Arch-topped frame, echoing the hotel's colonnade. Used for portrait
 * photography on the landing page.
 */
export function ArchImage({ image, alt, label, className = '', sizes = '33vw', priority }) {
  return (
    <div className={`arch relative overflow-hidden bg-ink-900 ${className}`}>
      <SmartImage image={image} alt={alt} label={label} sizes={sizes} priority={priority} />
    </div>
  );
}
