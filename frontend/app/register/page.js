'use client';

import { ArrowRight, Info } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Navbar } from '@/components/Navbar';
import { ScrollReveal } from '@/components/ScrollReveal';
import { Alert, Field, Input } from '@/components/ui';

export default function RegisterPage() {
  const { register, user, loading } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [loading, user, router]);

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));

  async function onSubmit(event) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        // Send phone only when filled - the API rejects an empty string.
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
      });
      router.push('/dashboard');
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fieldErrors ?? {});
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream-100">
      <Navbar />
      <div className="mx-auto max-w-md px-4 py-12 sm:px-6 lg:py-20">
        <ScrollReveal>
          <span className="marker-honey inline-block -rotate-1 font-serif text-sm text-ink-800">
            Join us
          </span>
          <h1 className="mt-5 font-serif text-4xl font-bold text-ink-900 sm:text-5xl">
            Create your account
          </h1>
          <p className="mt-3 text-ink-500">
            Book stays, view your reservations and manage cancellations.
          </p>
        </ScrollReveal>

        <div className="mt-8">
          <form onSubmit={onSubmit} className="space-y-4">
            {error && <Alert tone="error">{error}</Alert>}

            <Field label="Full name" required error={fieldErrors.name}>
              <Input
                value={form.name}
                onChange={set('name')}
                autoComplete="name"
                placeholder="Rahul Verma"
                className="!rounded-full !bg-white !px-5 !py-3"
                error={fieldErrors.name}
                required
              />
            </Field>

            <Field label="Email address" required error={fieldErrors.email}>
              <Input
                type="email"
                value={form.email}
                onChange={set('email')}
                autoComplete="email"
                placeholder="you@example.com"
                className="!rounded-full !bg-white !px-5 !py-3"
                error={fieldErrors.email}
                required
              />
            </Field>

            <Field
              label="Phone number"
              error={fieldErrors.phone}
              hint="Optional - helps reception reach you about your stay"
            >
              <Input
                type="tel"
                value={form.phone}
                onChange={set('phone')}
                autoComplete="tel"
                placeholder="+91 98200 10000"
                className="!rounded-full !bg-white !px-5 !py-3"
                error={fieldErrors.phone}
              />
            </Field>

            <Field
              label="Password"
              required
              error={fieldErrors.password}
              hint="At least 8 characters"
            >
              <Input
                type="password"
                value={form.password}
                onChange={set('password')}
                autoComplete="new-password"
                className="!rounded-full !bg-white !px-5 !py-3"
                error={fieldErrors.password}
                minLength={8}
                required
              />
            </Field>

            <button
              type="submit"
              disabled={submitting}
              className="group inline-flex w-full items-center justify-center gap-3 rounded-full bg-ink-900 py-2.5 pr-2.5 pl-6 font-medium text-cream-100 transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:bg-ink-300"
            >
              {submitting ? 'Creating account…' : 'Create account'}
              <span className="grid size-9 place-items-center rounded-full bg-cream-100 text-ink-900 transition-transform group-hover:translate-x-0.5">
                <ArrowRight className="size-4" aria-hidden />
              </span>
            </button>
          </form>

          <div className="mt-6 flex gap-2.5 rounded-2xl bg-sky-100 p-4 text-xs text-ink-600">
            <Info className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
            <p>
              Accounts created here are guest accounts. Receptionist and administrator
              access is granted by an existing administrator.
            </p>
          </div>

          <p className="mt-6 text-sm text-ink-500">
            Already registered?{' '}
            <Link
              href="/login"
              className="font-medium text-ink-900 underline underline-offset-4 hover:text-ink-700"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
