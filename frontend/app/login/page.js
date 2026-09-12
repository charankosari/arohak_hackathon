'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Navbar } from '@/components/Navbar';
import { Alert, Button, Card, Field, Input } from '@/components/ui';

/** The seeded accounts, offered as one-click fills so a demo needs no typing. */
const DEMO_ACCOUNTS = [
  { role: 'Administrator', email: 'admin@meridiangrand.example', password: 'Admin@123' },
  { role: 'Receptionist', email: 'reception@meridiangrand.example', password: 'Reception@123' },
  { role: 'Guest', email: 'guest@example.com', password: 'Guest@123' },
];

function LoginForm() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in: don't show the form again.
  useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [loading, user, next, router]);

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
    <div className="min-h-screen bg-ink-50">
      <Navbar />
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:py-20">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink-900">Sign in</h1>
          <p className="mt-2 text-sm text-ink-500">
            Guests, receptionists and administrators all sign in here. You will land on the
            dashboard for your role.
          </p>

          <Card className="mt-6 p-6">
            <form onSubmit={onSubmit} className="space-y-4">
              {error && <Alert tone="error">{error}</Alert>}

              <Field label="Email address" required>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="you@example.com"
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
                  required
                />
              </Field>

              <Button type="submit" size="lg" loading={submitting} className="w-full">
                Sign in
              </Button>
            </form>

            <p className="mt-4 text-center text-sm text-ink-500">
              No account yet?{' '}
              <Link href="/register" className="font-medium text-brass-600 hover:text-brass-700">
                Create one
              </Link>
            </p>
          </Card>
        </div>

        <div className="lg:pt-16">
          <Card className="overflow-hidden">
            <div className="border-b border-ink-100 bg-ink-50 px-5 py-3">
              <p className="text-sm font-semibold text-ink-900">Demo accounts</p>
              <p className="mt-0.5 text-xs text-ink-500">
                Seeded by <code className="text-ink-600">npm run db:seed</code>. Click to fill.
              </p>
            </div>
            <ul className="divide-y divide-ink-100">
              {DEMO_ACCOUNTS.map((account) => (
                <li key={account.email}>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(account.email);
                      setPassword(account.password);
                      setError(null);
                    }}
                    className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-ink-50"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink-900">
                        {account.role}
                      </span>
                      <span className="block truncate text-xs text-ink-500">{account.email}</span>
                    </span>
                    <span className="shrink-0 rounded-md bg-ink-100 px-2 py-1 font-mono text-xs text-ink-600">
                      {account.password}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense fallback={<div className="min-h-screen bg-ink-50" />}>
      <LoginForm />
    </Suspense>
  );
}
