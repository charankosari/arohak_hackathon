'use client';

import { useEffect, useRef } from 'react';

/**
 * Reveals its children once they scroll into view.
 *
 * Uses IntersectionObserver rather than scroll listeners, unobserves after the
 * first reveal so nothing re-animates on the way back up, and reveals
 * immediately when the visitor prefers reduced motion.
 */
export function ScrollReveal({ children, delay = 0, className = '', as: Tag = 'div' }) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      node.dataset.revealed = 'true';
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        node.dataset.revealed = 'true';
        observer.unobserve(node);
      },
      // Fire a little before the element is fully on screen.
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      data-revealed="false"
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={`reveal ${className}`}
    >
      {children}
    </Tag>
  );
}
