'use client';

import { Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SkylineIllustration } from '@/components/SkylineIllustration';
import { api } from '@/lib/api';

/**
 * Split card used by sign-in and registration: the form on the left, a quote
 * and the Marine Drive skyline illustration on the right, inside one rounded
 * panel floating on a soft cream-to-periwinkle gradient.
 */
export function AuthLayout({ eyebrow, title, subtitle, children, footer }) {
  const [hotel, setHotel] = useState(null);

  useEffect(() => {
    api.hotels
      .list({ take: 1 })
      .then(({ hotels }) => setHotel(hotels[0] ?? null))
      .catch(() => setHotel(null));
  }, []);

  return (
    <div className="auth-page min-h-dvh bg-cream-100 p-4 sm:p-8">
      <div className="auth-shell mx-auto grid max-w-6xl overflow-hidden rounded-2xl border border-cream-300 bg-cream-50 lg:grid-cols-[1fr_0.95fr]">
        <div className="flex flex-col px-6 py-8 sm:px-12 lg:px-16">
          <Link href="/" className="flex items-center gap-3 self-start">
            <Image src="/logo.png" alt="" width={42} height={42} priority />
            <span><span className="block font-serif text-lg font-semibold">The Meridian Grand</span><span className="text-[10px] tracking-[0.24em] text-brass-800 uppercase">Mumbai</span></span>
          </Link>
          <div className="mx-auto w-full max-w-md flex-1 py-10 lg:py-12">
            <p className="text-xs font-semibold tracking-[0.18em] text-brass-800 uppercase">{eyebrow}</p>
            <h1 className="mt-3 font-serif text-4xl leading-tight tracking-tight sm:text-5xl">{title}</h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-500">{subtitle}</p>
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-7 border-t border-cream-300 pt-6 text-sm text-ink-500">{footer}</div>}
          </div>
          <Link href="/" className="self-start text-xs text-ink-500 hover:text-ink-900">← Back to the hotel</Link>
        </div>
        <aside className="auth-property relative hidden flex-col justify-between overflow-hidden bg-cream-200 p-10 lg:flex">
          <div className="relative z-10"><p className="text-xs tracking-[0.2em] text-brass-800 uppercase">An address to remember</p><h2 className="mt-8 max-w-xs font-serif text-5xl leading-[1.1] tracking-tight">Mumbai, at your own pace.</h2><p className="mt-5 max-w-xs text-sm leading-7 text-ink-600">Sea-view mornings. Unhurried evenings. A place to call your own on Marine Drive.</p></div>
          <div className="relative mt-12 min-h-48 flex-1"><SkylineIllustration className="absolute inset-x-0 bottom-0 h-auto w-full" /></div>
          <div className="relative z-10 mt-6 border-t border-cream-400 pt-6"><p className="font-serif text-xl">{hotel?.name ?? 'The Meridian Grand'}</p><p className="mt-2 text-xs text-ink-500">{hotel?.city ?? 'Marine Drive, Mumbai'} · A warm welcome awaits</p></div>
        </aside>
      </div>
    </div>
  );
}

/** Pill input with a leading icon, matching the reference's field style. */
export function AuthField({ label, icon: Icon, error, hint, action, ...props }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-ink-700">{label}</span>
        {action}
      </span>
      <span className="relative block">
        {Icon && (
          <Icon
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-400"
            aria-hidden
          />
        )}
        <input
          className={`w-full rounded-lg border bg-cream-50 py-3.5 pr-4 text-sm text-ink-900 transition-colors placeholder:text-ink-400 focus:border-brass-600 ${
            Icon ? 'pl-11' : 'pl-4'
          } ${error ? 'border-rose-400' : 'border-cream-400'}`}
          {...props}
        />
      </span>
      {error ? (
        <span className="mt-1 block pl-4 text-xs text-rose-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block pl-4 text-xs text-ink-400">{hint}</span>
      ) : null}
    </label>
  );
}

/** Password field with a show/hide toggle. */
export function AuthPasswordField({ label, icon: Icon, error, hint, action, ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-ink-700">{label}</span>
        {action}
      </span>
      <span className="relative block">
        {Icon && (
          <Icon
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-400"
            aria-hidden
          />
        )}
        <input
          type={visible ? 'text' : 'password'}
          className={`w-full rounded-lg border bg-cream-50 py-3.5 pr-12 text-sm text-ink-900 transition-colors placeholder:text-ink-400 focus:border-brass-600 ${
            Icon ? 'pl-11' : 'pl-4'
          } ${error ? 'border-rose-400' : 'border-cream-400'}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-ink-400 hover:bg-cream-100 hover:text-ink-700"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </span>
      {error ? (
        <span className="mt-1 block pl-4 text-xs text-rose-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block pl-4 text-xs text-ink-400">{hint}</span>
      ) : null}
    </label>
  );
}

/** Full-width pill submit button. */
export function AuthSubmit({ children, loading, ...props }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full rounded-lg bg-ink-900 py-3.5 text-sm font-semibold text-cream-100 transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:bg-ink-300"
      {...props}
    >
      {loading ? 'Please wait…' : children}
    </button>
  );
}
