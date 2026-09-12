'use client';

import { Eye, EyeOff, Quote } from 'lucide-react';
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-linear-to-br from-cream-100 via-sky-100 to-sky-200 px-3 py-6 sm:px-6 sm:py-10">
      {/* Drifting blobs give the gradient some depth */}
      <div
        aria-hidden
        className="blob animate-drift pointer-events-none absolute -top-32 -left-24 size-[30rem] bg-brass-200/40 blur-3xl"
      />
      <div
        aria-hidden
        className="blob-alt animate-drift pointer-events-none absolute -right-32 -bottom-40 size-[34rem] bg-sky-300/50 blur-3xl"
      />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] bg-cream-50 shadow-2xl ring-1 ring-white/60 lg:grid-cols-2">
        {/* ------------------------------------------------------ Form */}
        <div className="flex flex-col p-6 sm:p-10 lg:p-12">
          <Link href="/" className="flex items-center gap-2.5 self-start">
            <Image
              src="/logo.png"
              alt=""
              width={40}
              height={40}
              priority
              className="h-9 w-auto object-contain"
            />
            <span className="leading-tight">
              <span className="block font-serif text-base font-semibold text-ink-900">
                The Meridian Grand
              </span>
              <span className="block text-[10px] tracking-[0.18em] text-ink-400 uppercase">
                Mumbai
              </span>
            </span>
          </Link>

          <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
            <div className="text-center">
              {eyebrow && (
                <span className="marker-honey inline-block -rotate-1 font-serif text-sm text-ink-800">
                  {eyebrow}
                </span>
              )}
              <h1 className="mt-4 font-serif text-4xl font-bold text-ink-900">{title}</h1>
              <p className="mt-2 text-sm text-ink-500">{subtitle}</p>
            </div>

            <div className="mt-8">{children}</div>

            {footer && <div className="mt-6 text-center text-sm text-ink-500">{footer}</div>}
          </div>
        </div>

        {/* -------------------------------------------------- Property */}
        <aside className="relative hidden bg-linear-to-b from-sky-100 to-sky-200 lg:flex lg:flex-col">
          <div className="relative z-10 px-10 pt-12 pb-2">
            <Quote className="size-8 rotate-180 text-sky-500" aria-hidden />
            <p className="mt-5 font-serif text-2xl leading-snug font-semibold text-ink-900">
              {hotel?.description
                ? hotel.description.split('.')[0] + '.'
                : 'A seafront address on Marine Drive, with sea-view suites and a rooftop lounge on the eighteenth floor.'}
            </p>

            <div className="mt-6 flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-ink-900">
                <Image
                  src="/logo.png"
                  alt=""
                  width={40}
                  height={40}
                  className="h-6 w-auto object-contain"
                />
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-semibold text-ink-900">
                  {hotel?.name ?? 'The Meridian Grand'}
                </span>
                <span className="block text-xs text-ink-600">
                  {hotel ? `${hotel.city} · ${hotel.contactNumber}` : 'Nariman Point, Mumbai'}
                </span>
              </span>
            </div>
          </div>

          {/* Line-art skyline anchored to the bottom. Height follows the
              drawing's own aspect so it never crops, whatever the panel's
              height - the gradient fills any space above it. */}
          <div className="relative mt-8 min-h-40 flex-1">
            <SkylineIllustration className="absolute inset-x-0 bottom-0 h-auto w-full" />
          </div>
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
          className={`w-full rounded-full border bg-white py-3 pr-4 text-sm text-ink-900 transition-colors placeholder:text-ink-400 focus:border-sky-400 ${
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
          className={`w-full rounded-full border bg-white py-3 pr-12 text-sm text-ink-900 transition-colors placeholder:text-ink-400 focus:border-sky-400 ${
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
      className="w-full rounded-full bg-ink-900 py-3.5 text-sm font-semibold text-cream-100 transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:bg-ink-300"
      {...props}
    >
      {loading ? 'Please wait…' : children}
    </button>
  );
}
