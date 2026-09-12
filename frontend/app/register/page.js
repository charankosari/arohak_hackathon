'use client';

import { Lock, Mail, Phone, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { AuthField, AuthLayout, AuthPasswordField, AuthSubmit } from '@/components/AuthLayout';
import { Alert } from '@/components/ui';

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
    <AuthLayout
      eyebrow="Join us"
      title="Sign Up"
      subtitle="Create an account to book stays and manage your reservations."
      footer={
        <>
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-semibold text-ink-900 underline underline-offset-4 hover:text-ink-700"
          >
            Sign In
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}

        <AuthField
          label="Full name"
          icon={User}
          value={form.name}
          onChange={set('name')}
          autoComplete="name"
          placeholder="Rahul Verma"
          error={fieldErrors.name}
          required
        />

        <AuthField
          label="Email"
          icon={Mail}
          type="email"
          value={form.email}
          onChange={set('email')}
          autoComplete="email"
          placeholder="you@example.com"
          error={fieldErrors.email}
          required
        />

        <AuthField
          label="Phone"
          icon={Phone}
          type="tel"
          value={form.phone}
          onChange={set('phone')}
          autoComplete="tel"
          placeholder="+91 98200 10000"
          error={fieldErrors.phone}
          hint="Optional — helps reception reach you about your stay"
        />

        <AuthPasswordField
          label="Password"
          icon={Lock}
          value={form.password}
          onChange={set('password')}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          error={fieldErrors.password}
          minLength={8}
          required
        />

        <div className="pt-2">
          <AuthSubmit loading={submitting}>Sign Up</AuthSubmit>
        </div>

        <p className="pt-1 text-center text-xs text-ink-400">
          Accounts created here are guest accounts. Receptionist and administrator access is
          granted by an administrator.
        </p>
      </form>
    </AuthLayout>
  );
}
