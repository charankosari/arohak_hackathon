'use client';

import { useEffect, useId, useRef } from 'react';

/**
 * Aarav, the Meridian Grand bellhop — drawn rather than photographed.
 *
 * Illustrated in the brand palette to sit beside SkylineIllustration, but with
 * more craft than a flat mark: a gold-frogged tailcoat, epaulettes, a tasselled
 * pillbox cap, white gloves and a brass bell, shaded with gradients and lit
 * with a sweep across the cap band.
 *
 * Animation is CSS (see globals.css) with one exception: his eyes follow the
 * pointer. That is done by writing two CSS custom properties from a
 * rAF-throttled listener, so the pupils move without React re-rendering and
 * without touching the SVG geometry. It is skipped entirely for a
 * reduced-motion preference, along with everything else.
 *
 * States:
 *   idle      breathes, blinks, sways; waves and rings the bell now and then
 *   thinking  glances up, brows lift, three dots pulse above the cap
 *   speaking  nods, mouth works, brows animate
 */
/**
 * Framing. The same artwork, cropped by the viewBox rather than redrawn.
 *
 * A full figure shrunk into a 44px launcher leaves a 12px head, and the face is
 * the whole point of a character. "bust" pulls in to the head, shoulders and
 * waving hand, so the same drawing stays legible at avatar size.
 */
const FRAMES = {
  full: '0 0 140 168',
  // Padded so the shoulders do not press against a circular avatar's border,
  // and so the thinking dots (y ≈ 5) stay inside the frame.
  bust: '23 17 94 100',
};

export function ConciergeCharacter({ state = 'idle', frame = 'full', className = '', title }) {
  const root = useRef(null);
  // Gradient ids must be unique: the launcher and the panel header both mount
  // one of these, and duplicate ids in a document collide.
  const uid = useId().replace(/:/g, '');
  const id = (name) => `${name}-${uid}`;

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (reduced?.matches) return;

    let frame = 0;
    const onMove = (event) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = root.current;
        if (!el) return;
        const box = el.getBoundingClientRect();
        if (!box.width) return;
        // Aim from the eyes, which sit above the centre of the figure.
        const dx = event.clientX - (box.left + box.width / 2);
        const dy = event.clientY - (box.top + box.height * 0.4);
        const distance = Math.hypot(dx, dy) || 1;
        // Saturates at arm's length so the eyes don't jitter far from the page.
        const reach = (Math.min(distance, 320) / 320) * 2.4;
        el.style.setProperty('--eye-x', ((dx / distance) * reach).toFixed(2));
        el.style.setProperty('--eye-y', ((dy / distance) * reach * 0.7).toFixed(2));
      });
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <svg
      ref={root}
      viewBox={FRAMES[frame] ?? FRAMES.full}
      role="img"
      aria-label={title ?? 'Aarav, the Meridian Grand concierge'}
      className={`concierge concierge--${state} concierge--${frame} ${className}`}
    >
      <defs>
        <linearGradient id={id('coat')} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="var(--color-sky-400)" />
          <stop offset="55%" stopColor="var(--color-sky-500)" />
          <stop offset="100%" stopColor="var(--color-sky-600)" />
        </linearGradient>
        <linearGradient id={id('cap')} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="var(--color-sky-400)" />
          <stop offset="100%" stopColor="var(--color-sky-600)" />
        </linearGradient>
        <linearGradient id={id('skin')} x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#f7e3d0" />
          <stop offset="100%" stopColor="#e9c9ac" />
        </linearGradient>
        <linearGradient id={id('brass')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-brass-200)" />
          <stop offset="45%" stopColor="var(--color-brass-400)" />
          <stop offset="100%" stopColor="var(--color-brass-600)" />
        </linearGradient>
        {/* Travels across the cap band as a highlight. */}
        <linearGradient id={id('shine')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="50%" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={id('glow')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="var(--color-brass-200)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--color-brass-200)" stopOpacity="0" />
        </radialGradient>
        <clipPath id={id('head')}>
          <ellipse cx="70" cy="64" rx="27" ry="28" />
        </clipPath>
        <clipPath id={id('band')}>
          <rect x="40" y="45" width="60" height="10" rx="5" />
        </clipPath>
      </defs>

      {/* Warmth behind the figure; the launcher reads as lit rather than flat. */}
      <ellipse className="concierge__glow" cx="70" cy="80" rx="66" ry="70" fill={`url(#${id('glow')})`} />

      {/* Contact shadow. Widens as he settles, which sells the breathing. */}
      <ellipse className="concierge__shadow" cx="70" cy="162" rx="42" ry="5.5" fill="var(--color-ink-900)" opacity="0.14" />

      {/* Thinking dots, above the cap. */}
      <g className="concierge__thinking" aria-hidden="true">
        <circle className="concierge__dot concierge__dot--1" cx="48" cy="14" r="3.6" />
        <circle className="concierge__dot concierge__dot--2" cx="61" cy="9" r="3.6" />
        <circle className="concierge__dot concierge__dot--3" cx="74" cy="14" r="3.6" />
      </g>

      <g className="concierge__figure">
        {/* ---------------- Torso ---------------- */}
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Neck and collar shadow */}
          <path d="M60 84h20v18H60z" fill="#e0bb9b" stroke="var(--color-ink-900)" strokeWidth="2.4" />

          {/* Tailcoat */}
          <path
            d="M70 100c-14 0-24 4-30 10-7 7-10 20-10 34v22h80v-22c0-14-3-27-10-34-6-6-16-10-30-10z"
            fill={`url(#${id('coat')})`}
            stroke="var(--color-ink-900)"
            strokeWidth="2.6"
          />

          {/* Shirt front, waistcoat V */}
          <path
            d="M70 100 58 104l6 62h12l6-62z"
            fill="var(--color-cream-50)"
            stroke="var(--color-ink-900)"
            strokeWidth="2.2"
          />

          {/* Lapels */}
          <path d="M58 104 46 112l8 14 10-20z" fill="var(--color-sky-600)" stroke="var(--color-ink-900)" strokeWidth="2" />
          <path d="M82 104l12 8-8 14-10-20z" fill="var(--color-sky-600)" stroke="var(--color-ink-900)" strokeWidth="2" />

          {/* Gold frogging — the bellhop signature, and legible even at 40px.
              Each bar runs from its button in to the shirt opening and stops:
              braid sits on the coat panels, never across the shirt. */}
          {[
            { y: 128, left: 44, right: 96, inL: 60, inR: 80 },
            { y: 142, left: 43, right: 97, inL: 61, inR: 79 },
            { y: 156, left: 44, right: 96, inL: 63, inR: 77 },
          ].map(({ y, left, right, inL, inR }) => (
            <g key={y}>
              <path
                d={`M${left} ${y}h${inL - left}`}
                stroke="var(--color-brass-400)"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path
                d={`M${inR} ${y}h${right - inR}`}
                stroke="var(--color-brass-400)"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <circle cx={left} cy={y} r="2.8" fill="var(--color-brass-300)" stroke="var(--color-ink-900)" strokeWidth="1.2" />
              <circle cx={right} cy={y} r="2.8" fill="var(--color-brass-300)" stroke="var(--color-ink-900)" strokeWidth="1.2" />
            </g>
          ))}

          {/* Bow tie */}
          <path
            d="M70 106l-11-6v13zM70 106l11-6v13z"
            fill="var(--color-blush-300)"
            stroke="var(--color-ink-900)"
            strokeWidth="1.9"
          />
          <circle cx="70" cy="106" r="2.8" fill="var(--color-blush-200)" stroke="var(--color-ink-900)" strokeWidth="1.4" />

          {/* Epaulettes */}
          <g fill={`url(#${id('brass')})`} stroke="var(--color-ink-900)" strokeWidth="1.8">
            <rect x="32" y="106" width="16" height="8" rx="4" />
            <rect x="92" y="106" width="16" height="8" rx="4" />
          </g>
        </g>

        {/* ---------------- Left arm, holding the bell ----------------
            Both arms swing clear of the coat's silhouette (x 30-110). Drawn
            inside it, a sky-coloured sleeve on a sky-coloured coat simply
            disappears, and the wave stops reading as a wave. */}
        <g className="concierge__bell-arm">
          <path d="M40 114c-10 4-16 11-18 18" fill="none" stroke="var(--color-sky-600)" strokeWidth="10.5" strokeLinecap="round" />
          <path d="M40 114c-10 4-16 11-18 18" fill="none" stroke="var(--color-ink-900)" strokeWidth="2.3" strokeLinecap="round" opacity="0.7" />
          {/* Brass cuff, then a gloved hand with a thumb - a bare circle reads
              as a ball on a stick at small sizes. */}
          <path d="M17 128.5a6.5 6.5 0 0 1 9 3.5" fill="none" stroke="var(--color-brass-400)" strokeWidth="3.2" strokeLinecap="round" />
          <path
            d="M21 132a6.8 6.8 0 1 0 0 13.6 6.8 6.8 0 0 0 0-13.6zm-6.4 3.6c-2.1 0-3.6 1.3-3.6 2.9s1.5 2.9 3.6 2.9z"
            fill="var(--color-cream-50)"
            stroke="var(--color-ink-900)"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <g className="concierge__bell">
            {/* Handle, dome, flared lip, clapper. */}
            <path d="M21 145v3.5" stroke="var(--color-ink-900)" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M13 159c0-7.5 3.5-11 8-11s8 3.5 8 11z" fill={`url(#${id('brass')})`} stroke="var(--color-ink-900)" strokeWidth="2.1" strokeLinejoin="round" />
            <path d="M11.5 159h19" stroke="var(--color-ink-900)" strokeWidth="2.4" strokeLinecap="round" />
            <circle cx="21" cy="162" r="2.3" fill="var(--color-brass-600)" stroke="var(--color-ink-900)" strokeWidth="1.3" />
          </g>
        </g>

        {/* ---------------- Right arm, raised in a wave ---------------- */}
        <g className="concierge__arm">
          <path d="M100 114c11 0 19-6 22-14" fill="none" stroke="var(--color-sky-600)" strokeWidth="10.5" strokeLinecap="round" />
          <path d="M100 114c11 0 19-6 22-14" fill="none" stroke="var(--color-ink-900)" strokeWidth="2.3" strokeLinecap="round" opacity="0.7" />
          <path d="M117 97a6.5 6.5 0 0 1 9 3" fill="none" stroke="var(--color-brass-400)" strokeWidth="3.2" strokeLinecap="round" />
          {/* Open palm: rounded mitt plus a thumb, so the wave reads as a hand. */}
          <path
            d="M126 87a7.2 7.2 0 1 1 0 14.4 7.2 7.2 0 0 1 0-14.4zm-7 4.4c-2.1 0-3.7 1.3-3.7 2.9s1.6 2.9 3.7 2.9z"
            fill="var(--color-cream-50)"
            stroke="var(--color-ink-900)"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          {/* Finger seams, short enough not to read as stripes. */}
          <g stroke="var(--color-ink-300)" strokeWidth="1.1" strokeLinecap="round" opacity="0.8">
            <path d="M124.5 88.5v4" />
            <path d="M128.5 89.5v4" />
          </g>
        </g>

        {/* ---------------- Head ---------------- */}
        <g className="concierge__head">
          <ellipse
            cx="70"
            cy="64"
            rx="27"
            ry="28"
            fill={`url(#${id('skin')})`}
            stroke="var(--color-ink-900)"
            strokeWidth="2.6"
          />

          {/* Hair at the temples, clipped to the skull */}
          <g clipPath={`url(#${id('head')})`}>
            <path d="M43 62c0-16 11-26 27-26s27 10 27 26c-4-8-9-12-14-12H57c-5 0-10 4-14 12z" fill="var(--color-ink-800)" />
          </g>

          {/* Ears */}
          <ellipse cx="42" cy="66" rx="4.5" ry="6" fill={`url(#${id('skin')})`} stroke="var(--color-ink-900)" strokeWidth="2" />
          <ellipse cx="98" cy="66" rx="4.5" ry="6" fill={`url(#${id('skin')})`} stroke="var(--color-ink-900)" strokeWidth="2" />

          {/* Brows */}
          <g className="concierge__brows" stroke="var(--color-ink-900)" strokeWidth="2.6" strokeLinecap="round" fill="none">
            <path d="M53 54q7-4.5 14-1" />
            <path d="M73 53q7-3.5 14 1" />
          </g>

          {/* Eyes: whites stay put, pupils follow the pointer, lids blink. */}
          <g className="concierge__eyes">
            <ellipse cx="60" cy="64" rx="6.6" ry="7" fill="#fff" stroke="var(--color-ink-900)" strokeWidth="1.9" />
            <ellipse cx="80" cy="64" rx="6.6" ry="7" fill="#fff" stroke="var(--color-ink-900)" strokeWidth="1.9" />
            <g className="concierge__pupils">
              <circle cx="60" cy="64.5" r="3.4" fill="var(--color-ink-950)" />
              <circle cx="80" cy="64.5" r="3.4" fill="var(--color-ink-950)" />
              <circle cx="61.4" cy="62.9" r="1.2" fill="#fff" />
              <circle cx="81.4" cy="62.9" r="1.2" fill="#fff" />
            </g>
          </g>

          {/* Nose — a soft underside curve. A full outline reads as a smudge
              once the whole figure is 40px wide. */}
          <path
            d="M67 76q3 2.5 6 0"
            fill="none"
            stroke="var(--color-ink-700)"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.6"
          />

          {/* Cheeks */}
          <ellipse cx="51" cy="76" rx="5" ry="3.2" fill="var(--color-blush-300)" opacity="0.6" />
          <ellipse cx="89" cy="76" rx="5" ry="3.2" fill="var(--color-blush-300)" opacity="0.6" />

          {/* Mouth — one is swapped for the other while speaking. */}
          <path
            className="concierge__mouth concierge__mouth--closed"
            d="M62 83q8 7 16 0"
            fill="none"
            stroke="var(--color-ink-900)"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <g className="concierge__mouth concierge__mouth--open">
            <path
              d="M61 83q9 12 18 0a9 9 0 0 1-18 0z"
              fill="var(--color-ink-900)"
              stroke="var(--color-ink-900)"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            {/* Upper teeth, so the open mouth is not a flat hole. */}
            <path d="M62.5 83.8h15" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
          </g>

          {/* ---------------- Cap ---------------- */}
          <g className="concierge__cap">
            <path
              d="M42 48C42 27 55 19 70 19s28 8 28 29z"
              fill={`url(#${id('cap')})`}
              stroke="var(--color-ink-900)"
              strokeWidth="2.6"
              strokeLinejoin="round"
            />
            {/* Crown highlight */}
            <path d="M52 42c1-12 8-18 16-19-6 4-9 10-10 19z" fill="#fff" opacity="0.22" />

            {/* Brass band, with a highlight that sweeps across it */}
            <rect x="40" y="45" width="60" height="10" rx="5" fill={`url(#${id('brass')})`} stroke="var(--color-ink-900)" strokeWidth="2.2" />
            <g clipPath={`url(#${id('band')})`}>
              <rect className="concierge__shine" x="-30" y="45" width="26" height="10" fill={`url(#${id('shine')})`} />
            </g>

            {/* The Meridian "M" */}
            <path
              d="M63 40l3-11 4 7 4-7 3 11"
              fill="none"
              stroke="var(--color-brass-100)"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Tassel, swinging from the crown */}
            <g className="concierge__tassel">
              <path d="M96 28c8 3 12 9 12 16" fill="none" stroke="var(--color-brass-500)" strokeWidth="2.2" strokeLinecap="round" />
              <circle cx="108" cy="45" r="3.4" fill={`url(#${id('brass')})`} stroke="var(--color-ink-900)" strokeWidth="1.4" />
              <path d="M108 48v7" stroke="var(--color-brass-400)" strokeWidth="3" strokeLinecap="round" />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}
