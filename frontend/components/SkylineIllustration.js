/**
 * Marine Drive, drawn rather than photographed.
 *
 * A flat line-art skyline that anchors the bottom of the auth panel: the
 * Queen's Necklace curve, a row of Art Deco blocks, palm trees and a low sun.
 * Built in the brand palette so it always matches, and as inline SVG so it
 * scales to any width without a network request.
 */
export function SkylineIllustration({ className = '' }) {
  return (
    <svg
      viewBox="0 0 640 320"
      preserveAspectRatio="xMidYMax meet"
      role="img"
      aria-label="Illustration of the Marine Drive skyline"
      className={className}
    >
      <defs>
        {/* Diagonal hatching, as on the reference illustration */}
        <pattern id="hatch" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="7" stroke="var(--color-ink-900)" strokeWidth="1.1" opacity="0.28" />
        </pattern>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-sky-100)" />
          <stop offset="100%" stopColor="var(--color-sky-200)" />
        </linearGradient>
        <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-sky-300)" />
          <stop offset="100%" stopColor="var(--color-sky-400)" />
        </linearGradient>
      </defs>

      <rect width="640" height="320" fill="url(#sky)" />

      {/* Low sun */}
      <circle cx="497" cy="84" r="34" fill="var(--color-brass-200)" />
      <circle cx="497" cy="84" r="34" fill="none" stroke="var(--color-brass-500)" strokeWidth="1.5" opacity="0.5" />

      {/* Far skyline, flat and pale for depth */}
      <g fill="var(--color-sky-300)" opacity="0.75">
        <rect x="14" y="150" width="42" height="92" rx="3" />
        <rect x="66" y="126" width="30" height="116" rx="3" />
        <rect x="548" y="140" width="38" height="102" rx="3" />
        <rect x="596" y="162" width="32" height="80" rx="3" />
      </g>

      {/* Principal blocks */}
      <g stroke="var(--color-ink-900)" strokeWidth="2" strokeLinejoin="round">
        {/* Art Deco tower, stepped crown */}
        <path d="M112 242V96h14V74h10v22h14v146z" fill="var(--color-cream-100)" />
        <path d="M112 242V96h14V74h10v22h14v146z" fill="url(#hatch)" />
        <line x1="136" y1="74" x2="136" y2="52" />
        <circle cx="136" cy="48" r="4" fill="var(--color-brass-300)" />

        {/* Wide block */}
        <rect x="164" y="132" width="78" height="110" rx="3" fill="var(--color-sky-100)" />
        <g stroke="var(--color-ink-900)" strokeWidth="1.2" opacity="0.45">
          {[148, 168, 188, 208, 228].map((y) => (
            <line key={y} x1="164" y1={y} x2="242" y2={y} />
          ))}
          {[184, 204, 222].map((x) => (
            <line key={x} x1={x} y1="132" x2={x} y2="242" />
          ))}
        </g>

        {/* Slim tower */}
        <rect x="254" y="88" width="46" height="154" rx="3" fill="var(--color-cream-100)" />
        <rect x="262" y="102" width="30" height="126" rx="2" fill="url(#hatch)" />

        {/* Curved-corner block, an Art Deco nod */}
        <path d="M312 242V150a22 22 0 0 1 22-22h44v114z" fill="var(--color-brass-100)" />
        <g stroke="var(--color-ink-900)" strokeWidth="1.2" opacity="0.4">
          {[172, 196, 220].map((y) => (
            <line key={y} x1="316" y1={y} x2="378" y2={y} />
          ))}
        </g>

        {/* Short block */}
        <rect x="390" y="176" width="54" height="66" rx="3" fill="var(--color-sky-100)" />
        <g stroke="var(--color-ink-900)" strokeWidth="1.2" opacity="0.4">
          <line x1="390" y1="198" x2="444" y2="198" />
          <line x1="390" y1="220" x2="444" y2="220" />
          <line x1="417" y1="176" x2="417" y2="242" />
        </g>

        {/* Tall slab behind the sun */}
        <rect x="456" y="112" width="58" height="130" rx="3" fill="var(--color-cream-100)" />
        <rect x="464" y="124" width="42" height="106" rx="2" fill="url(#hatch)" />
      </g>

      {/* Palm trees along the promenade */}
      <g stroke="var(--color-ink-900)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
        {[
          { x: 74, scale: 1 },
          { x: 534, scale: 0.84 },
        ].map(({ x, scale }) => (
          <g key={x} transform={`translate(${x} 242) scale(${scale})`}>
            {/* Trunk */}
            <path d="M-3 0c2-20 4-34 5-48h5c-2 14-4 28-3 48z" fill="var(--color-brass-200)" />
            {/* Fronds, drawn as solid tapered leaves */}
            <path d="M5-48c-9 1-19 6-25 16 9-3 15-4 24-2z" fill="var(--color-sky-400)" />
            <path d="M5-48c10 0 20 5 26 14-9-3-16-4-25-2z" fill="var(--color-sky-400)" />
            <path d="M5-48c-7-7-10-17-8-27 6 7 10 15 12 24z" fill="var(--color-sky-400)" />
            <path d="M5-48c8-5 18-6 27-2-8 2-15 6-21 12z" fill="var(--color-sky-300)" />
            <path d="M5-48c-9-4-19-4-27 1 8 1 15 4 21 10z" fill="var(--color-sky-300)" />
            <circle cx="5" cy="-49" r="2.5" fill="var(--color-brass-400)" stroke="none" />
          </g>
        ))}
      </g>

      {/* Promenade and the bay */}
      <path d="M0 242h640v10H0z" fill="var(--color-cream-300)" />
      <path
        d="M0 252c88 0 132 14 220 14s152-14 240-14 92 8 180 8v60H0z"
        fill="url(#sea)"
      />
      <g stroke="var(--color-cream-100)" strokeWidth="2" strokeLinecap="round" opacity="0.7">
        <path d="M60 286c14-6 28-6 42 0" fill="none" />
        <path d="M186 300c14-6 28-6 42 0" fill="none" />
        <path d="M356 290c14-6 28-6 42 0" fill="none" />
        <path d="M486 304c14-6 28-6 42 0" fill="none" />
      </g>
    </svg>
  );
}
