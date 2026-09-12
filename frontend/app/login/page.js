'use client';

import { Lock, Mail } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { AuthField, AuthLayout, AuthPasswordField, AuthSubmit } from '@/components/AuthLayout';
import { Alert } from '@/components/ui';

function LoginForm() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

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
    <AuthLayout
      eyebrow="Welcome back"
      title="Welcome back."
      subtitle="Sign in to plan your next stay and manage your reservations."
      footer={
        <>
          Don&rsquo;t have an account?{' '}
          <Link
            href="/register"
            className="font-semibold text-ink-900 underline underline-offset-4 hover:text-ink-700"
          >
            Sign Up
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}

        <AuthField
          label="Email"
          icon={Mail}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
          required
        />

        <AuthPasswordField
          label="Password"
          icon={Lock}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          placeholder="Enter password"
          required
          action={
            <button
              type="button"
              onClick={() => setShowHelp((v) => !v)}
              className="text-xs font-medium text-ink-500 underline underline-offset-2 hover:text-ink-800"
            >
              Forgot password?
            </button>
          }
        />

        {showHelp && (
          <Alert tone="info" className="text-xs">
            Self-service password reset is not available yet. Call reception on{' '}
            <span className="whitespace-nowrap">+91 22 4567 8900</span> and a member of staff
            will set a new password for you.
          </Alert>
        )}

        <div className="pt-2">
          <AuthSubmit loading={submitting}>Sign In</AuthSubmit>
        </div>

        <p className="pt-1 text-center text-xs text-ink-400">
          Your reservations and stay details, all in one place.
        </p>
      </form>
    </AuthLayout>
  );
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense fallback={<div className="min-h-screen bg-ink-900" />}>
      <LoginForm />
    </Suspense>
  );
}
