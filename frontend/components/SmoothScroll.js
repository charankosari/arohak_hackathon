'use client';

import Lenis from 'lenis';
import { useEffect } from 'react';

/**
 * Momentum scrolling for the marketing pages.
 *
 * Deliberately NOT applied to the dashboard: hijacking the wheel in a data
 * table is irritating. It also disables itself when the visitor has asked for
 * reduced motion, and leaves anchor links to native smooth scrolling.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const lenis = new Lenis({
      duration: 1.05,
      // Gentle ease-out; nothing that feels floaty or laggy to click through.
      easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
      smoothWheel: true,
      // Native touch scrolling stays as the platform intends.
      syncTouch: false,
    });

    let frame;
    const raf = (time) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  return null;
}
