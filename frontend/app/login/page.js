'use client';

import { ArrowRight, Lock } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Navbar } from '@/components/Navbar';
import { ScrollReveal } from '@/components/ScrollReveal';
import { SmartImage } from '@/components/SmartImage';
import { Blob, Wave } from '@/components/Wave';
import { Alert, Field, Input } from '@/components/ui';
import { api } from '@/lib/api';

function LoginForm() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [image, setImage] = useState(null);

  // Already signed in: don't show the form again.
  useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [loading, user, next, router]);

  // Borrow the property's own photography for the side panel.
  useEffect(() => {
    api.hotels
      .list({ take: 1 })
      .then(({ hotels }) => setImage(hotels[0]?.coverImage ?? null))
      .catch(() => setImage(null));
  }, []);

  async function onSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      router.push(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream-100">
      <Navbar />

      <div className="mx-auto grid max-w-6xl items-stretch gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:py-16">
        {/* Form */}
        <ScrollReveal className="flex items-center">
          <div className="w-full max-w-md lg:mx-auto">
            <span className="marker-honey inline-block -rotate-1 font-serif text-sm text-ink-800">
              Welcome back
            </span>

            <h1 className="mt-5 font-serif text-4xl font-bold text-ink-900 sm:text-5xl">
              Sign in
            </h1>
            <p className="mt-3 text-ink-500">
              Guests, receptionists and administrators all sign in here — you will land on
              the dashboard for your role.
            </p>

            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              {error && <Alert tone="error">{error}</Alert>}

              <Field label="Email address" required>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="!rounded-full !bg-white !px-5 !py-3"
                  required
                />
              </Field>

              <Field label="Password" required>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Your password"
                  className="!rounded-full !bg-white !px-5 !py-3"
                  required
                />
              </Field>

              <button
                type="submit"
                disabled={submitting}
                className="group inline-flex w-full items-center justify-center gap-3 rounded-full bg-ink-900 py-2.5 pr-2.5 pl-6 font-medium text-cream-100 transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:bg-ink-300"
              >
                {submitting ? 'Signing in…' : 'Sign in'}
                <span className="grid size-9 place-items-center rounded-full bg-cream-100 text-ink-900 transition-transform group-hover:translate-x-0.5">
                  <ArrowRight className="size-4" aria-hidden />
                </span>
              </button>
            </form>

            <p className="mt-6 text-sm text-ink-500">
              No account yet?{' '}
              <Link
                href="/register"
                className="font-medium text-ink-900 underline underline-offset-4 hover:text-ink-700"
              >
                Create one
              </Link>
            </p>

            <p className="mt-8 flex items-start gap-2 text-xs text-ink-400">
              <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Staff access is granted by an administrator. Accounts created here are guest
              accounts.
            </p>
          </div>
        </ScrollReveal>

        {/* Photograph */}
        <ScrollReveal delay={120} className="hidden lg:block">
          <div className="relative h-full min-h-[32rem] overflow-hidden rounded-[2rem] bg-ink-900">
            <SmartImage
              image={image}
              alt="The Meridian Grand Mumbai"
              label="The Meridian Grand"
              placeholderIcon="hotel"
              sizes="(max-width: 1024px) 0px, 45vw"
              priority
            />

            {/* Periwinkle footer panel, echoing the landing page */}
            <div className="absolute inset-x-0 bottom-0">
              <div className="text-sky-300">
                <Wave variant="swell" />
              </div>
              <div className="relative bg-sky-300 px-7 pt-1 pb-7">
                <Blob className="-top-6 right-6 size-24 bg-cream-100/40" />
                <p className="relative font-serif text-2xl font-semibold text-ink-900">
                  A seafront address on Marine Drive
                </p>
                <p className="relative mt-1 text-sm text-ink-700">
                  Nariman Point, Mumbai · +91 22 4567 8900
                </p>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense fallback={<div className="min-h-screen bg-cream-100" />}>
      <LoginForm />
    </Suspense>
  );
}
