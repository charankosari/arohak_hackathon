'use client';

import { Info } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Navbar } from '@/components/Navbar';
import { Alert, Button, Card, Field, Input } from '@/components/ui';

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
    <div className="min-h-screen bg-ink-50">
      <Navbar />
      <div className="mx-auto max-w-md px-4 py-12 sm:px-6 lg:py-20">
        <h1 className="font-serif text-3xl font-bold text-ink-900">Create your account</h1>
        <p className="mt-2 text-sm text-ink-500">
          Book stays, view your reservations and manage cancellations.
        </p>

        <Card className="mt-6 p-6">
          <form onSubmit={onSubmit} className="space-y-4">
            {error && <Alert tone="error">{error}</Alert>}

            <Field label="Full name" required error={fieldErrors.name}>
              <Input
                value={form.name}
                onChange={set('name')}
                autoComplete="name"
                placeholder="Rahul Verma"
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
                error={fieldErrors.password}
                minLength={8}
                required
              />
            </Field>

            <Button type="submit" size="lg" loading={submitting} className="w-full">
              Create account
            </Button>
          </form>

          <div className="mt-5 flex gap-2.5 rounded-lg bg-ink-50 p-3 text-xs text-ink-500">
            <Info className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
            <p>
              Accounts created here are guest accounts. Receptionist and administrator
              access is granted by an existing administrator.
            </p>
          </div>

          <p className="mt-4 text-center text-sm text-ink-500">
            Already registered?{' '}
            <Link href="/login" className="font-medium text-brass-600 hover:text-brass-700">
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
