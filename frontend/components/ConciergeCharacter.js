/**
 * Aarav, the Meridian Grand concierge — drawn rather than photographed.
 *
 * Flat line-art in the brand palette, matching SkylineIllustration: cream
 * fills, navy strokes, a periwinkle uniform and a brass cap band. Inline SVG so
 * it scales to any size without a network request and inherits the CSS colour
 * tokens, which keeps him in step with the palette for free.
 *
 * He is animated entirely in CSS (see globals.css) rather than with a timer or
 * an animation library: the browser runs it off the main thread, nothing
 * re-renders, and the reduced-motion block already in globals.css stops all of
 * it without this component knowing.
 *
 * Three states drive the expression:
 *   idle      breathing, blinking, occasional wave
 *   thinking  eyes glance up, three dots pulse above his cap
 *   speaking  a gentle nod, mouth open
 */
export function ConciergeCharacter({ state = 'idle', className = '', title }) {
  return (
    <svg
      viewBox="0 0 120 132"
      role="img"
      aria-label={title ?? 'Aarav, the Meridian Grand concierge'}
      className={`concierge concierge--${state} ${className}`}
    >
      <defs>
        {/* Same 45-degree hatching as the skyline, for the jacket shadow. */}
        <pattern
          id="concierge-hatch"
          width="6"
          height="6"
          patternTransform="rotate(45)"
          patternUnits="userSpaceOnUse"
        >
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-ink-950)" strokeWidth="1" opacity="0.22" />
        </pattern>
        {/* Clips the fringe to the head so it cannot spill past the outline. */}
        <clipPath id="concierge-head-clip">
          <circle cx="60" cy="60" r="25" />
        </clipPath>
      </defs>

      {/* Thinking dots. Hidden unless state="thinking"; they sit above the cap. */}
      <g className="concierge__thinking" aria-hidden="true">
        <circle className="concierge__dot concierge__dot--1" cx="44" cy="14" r="3.4" />
        <circle className="concierge__dot concierge__dot--2" cx="56" cy="11" r="3.4" />
        <circle className="concierge__dot concierge__dot--3" cx="68" cy="14" r="3.4" />
      </g>

      {/* Everything below breathes as one body. */}
      <g className="concierge__body">
        {/* ---- Shoulders and jacket ---- */}
        <g strokeLinejoin="round" strokeLinecap="round">
          <path
            d="M22 132c0-19 8.5-29 20-33h36c11.5 4 20 14 20 33z"
            fill="var(--color-sky-400)"
            stroke="var(--color-ink-900)"
            strokeWidth="2.4"
          />
          <path
            d="M22 132c0-19 8.5-29 20-33h36c11.5 4 20 14 20 33z"
            fill="url(#concierge-hatch)"
            stroke="none"
          />

          {/* Shirt and lapels: a V of cream between the jacket fronts. */}
          <path
            d="M47 99 60 116 73 99l5 2-8 31H50l-8-31z"
            fill="var(--color-cream-100)"
            stroke="var(--color-ink-900)"
            strokeWidth="2.2"
          />
          {/* Bow tie — the one flash of blush in the uniform. */}
          <path
            d="M60 108l-8-5v10zM60 108l8-5v10z"
            fill="var(--color-blush-300)"
            stroke="var(--color-ink-900)"
            strokeWidth="1.8"
          />
          <circle cx="60" cy="108" r="2.4" fill="var(--color-blush-200)" stroke="var(--color-ink-900)" strokeWidth="1.4" />

          {/* Brass buttons */}
          <circle cx="60" cy="122" r="2.2" fill="var(--color-brass-300)" stroke="var(--color-ink-900)" strokeWidth="1.3" />
          <circle cx="60" cy="130" r="2.2" fill="var(--color-brass-300)" stroke="var(--color-ink-900)" strokeWidth="1.3" />
        </g>

        {/* ---- Waving arm. Rotates from the shoulder. ---- */}
        <g className="concierge__arm">
          <path
            d="M90 112c6-5 11-12 12-19"
            fill="none"
            stroke="var(--color-sky-400)"
            strokeWidth="9"
            strokeLinecap="round"
          />
          <path
            d="M90 112c6-5 11-12 12-19"
            fill="none"
            stroke="var(--color-ink-900)"
            strokeWidth="2.2"
            strokeLinecap="round"
            opacity="0.85"
          />
          {/* Cuff, then the hand */}
          <circle cx="102" cy="94" r="4" fill="var(--color-cream-100)" stroke="var(--color-ink-900)" strokeWidth="1.8" />
          <circle cx="104" cy="87" r="6.5" fill="var(--color-cream-200)" stroke="var(--color-ink-900)" strokeWidth="2.2" />
        </g>

        {/* ---- Head ---- */}
        <g className="concierge__head">
          <circle
            cx="60"
            cy="60"
            r="25"
            fill="var(--color-cream-200)"
            stroke="var(--color-ink-900)"
            strokeWidth="2.4"
          />

          {/* Hair, clipped to the skull */}
          <g clipPath="url(#concierge-head-clip)">
            <path d="M35 52c3-14 12-21 25-21s22 7 25 21c-6-6-14-9-25-9s-19 3-25 9z" fill="var(--color-ink-800)" />
          </g>

          {/* Ears */}
          <circle cx="35" cy="62" r="4" fill="var(--color-cream-200)" stroke="var(--color-ink-900)" strokeWidth="1.8" />
          <circle cx="85" cy="62" r="4" fill="var(--color-cream-200)" stroke="var(--color-ink-900)" strokeWidth="1.8" />

          {/* Eyes. The group scales to nothing on the blink keyframe. */}
          <g className="concierge__eyes" fill="var(--color-ink-950)">
            <circle className="concierge__eye" cx="51" cy="60" r="3.1" />
            <circle className="concierge__eye" cx="69" cy="60" r="3.1" />
          </g>
          {/* Catchlights sit outside the blinking group so they vanish with it. */}
          <g className="concierge__eyes" fill="var(--color-cream-50)">
            <circle cx="52.2" cy="58.8" r="1" />
            <circle cx="70.2" cy="58.8" r="1" />
          </g>

          {/* Brows — they lift in the thinking state. */}
          <g
            className="concierge__brows"
            stroke="var(--color-ink-900)"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          >
            <path d="M46 52.5q5-3 10 0" />
            <path d="M64 52.5q5-3 10 0" />
          </g>

          {/* Cheeks */}
          <ellipse cx="44" cy="68" rx="4" ry="2.6" fill="var(--color-blush-200)" opacity="0.75" />
          <ellipse cx="76" cy="68" rx="4" ry="2.6" fill="var(--color-blush-200)" opacity="0.75" />

          {/* Mouth: a closed smile, swapped for an open one while speaking. */}
          <path
            className="concierge__mouth concierge__mouth--closed"
            d="M53 70q7 6 14 0"
            fill="none"
            stroke="var(--color-ink-900)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <ellipse
            className="concierge__mouth concierge__mouth--open"
            cx="60"
            cy="72"
            rx="5"
            ry="4"
            fill="var(--color-ink-900)"
          />

          {/* ---- Pillbox cap ---- */}
          <g strokeLinejoin="round">
            <path
              d="M37 43a23 23 0 0 1 46 0z"
              fill="var(--color-sky-500)"
              stroke="var(--color-ink-900)"
              strokeWidth="2.4"
            />
            {/* Brass band */}
            <path d="M36 43h48" stroke="var(--color-brass-400)" strokeWidth="5" strokeLinecap="round" />
            <path d="M36 43h48" stroke="var(--color-ink-900)" strokeWidth="2.2" strokeLinecap="round" />
            {/* The Meridian "M" badge: up, dip, up, down. */}
            <path
              d="M55 39l2.5-6 2.5 4 2.5-4 2.5 6"
              fill="none"
              stroke="var(--color-brass-200)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </g>
      </g>
    </svg>
  );
}
