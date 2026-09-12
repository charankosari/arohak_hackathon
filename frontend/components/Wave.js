/**
 * Organic section transitions.
 *
 * Sections meet along a soft wave rather than a straight rule. The SVG uses
 * `preserveAspectRatio="none"` so one path stretches to any width, and sits
 * in `currentColor` so the caller sets the colour of the section it is
 * flowing *into*.
 */

const PATHS = {
  // Gentle swell — used between most sections.
  calm: 'M0,40 C220,88 420,0 720,28 C1020,56 1240,104 1440,64 L1440,120 L0,120 Z',
  // Deeper, more playful curve — used under the hero.
  swell: 'M0,64 C180,8 380,104 640,72 C900,40 1130,0 1440,48 L1440,120 L0,120 Z',
};

export function Wave({ variant = 'calm', flip = false, className = '' }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none relative w-full leading-none ${className}`}
      style={flip ? { transform: 'rotate(180deg)' } : undefined}
    >
      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="block h-[60px] w-full sm:h-[90px]"
      >
        <path d={PATHS[variant]} fill="currentColor" />
      </svg>
    </div>
  );
}

/**
 * Decorative blurred blob, for depth behind content. Purely cosmetic, so it
 * is hidden from assistive technology.
 */
export function Blob({ className = '', variant = 'blob' }) {
  return (
    <div
      aria-hidden
      className={`${variant} animate-drift pointer-events-none absolute blur-2xl ${className}`}
    />
  );
}
