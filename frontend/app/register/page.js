'use client';

import { ArrowLeft, Lock, Mail, Phone, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { AuthField, AuthLayout, AuthPasswordField, AuthSubmit } from '@/components/AuthLayout';
import { Alert } from '@/components/ui';

/**
 * Name and email are kept here between the two steps so a refresh, or a
 * bounce back from step two, does not lose them. The password is never
 * written anywhere - it only ever lives in component state.
 */
const DRAFT_KEY = 'meridian.signup-draft';

function readDraft() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(window.sessionStorage.getItem(DRAFT_KEY) ?? 'null');
  } catch {
    return null;
  }
}

function writeDraft(draft) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* private window or storage disabled - the step still works in memory */
  }
}

function clearDraft() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function RegisterPage() {
  const { register, user, loading } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [loading, user, router]);

  // Restore anything saved from a previous visit to step one.
  useEffect(() => {
    const draft = readDraft();
    if (draft?.name || draft?.email) {
      setForm((f) => ({ ...f, name: draft.name ?? '', email: draft.email ?? '' }));
    }
  }, []);

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));

  /** Step one: validate locally, stash the details, move on. */
  function onContinue(event) {
    event.preventDefault();
    setError(null);

    const name = form.name.trim();
    const email = form.email.trim();
    const errors = {};

    if (name.length < 2) errors.name = 'Please enter your full name';
    if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address';

    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    writeDraft({ name, email });
    setForm((f) => ({ ...f, name, email }));
    setStep(2);
  }

  /** Step two: combine the saved details with the new ones and register. */
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
      clearDraft();
      router.push('/dashboard');
    } catch (err) {
      const fields = err.fieldErrors ?? {};
      setFieldErrors(fields);
      setError(err.message);

      // A duplicate email, or a rejected name, belongs to step one - send the
      // guest back so they can actually see and fix the offending field.
      if (fields.name || fields.email || err.status === 409) setStep(1);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Join us"
      title="Make yourself at home."
      subtitle={
        step === 1
          ? 'Start with your name and email — it takes a moment.'
          : 'Almost there. Choose a password to secure your account.'
      }
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
      {/* Progress */}
      <div className="mb-6 flex items-center gap-3">
        {[1, 2].map((n) => (
          <span
            key={n}
            aria-hidden
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              n <= step ? 'bg-ink-900' : 'bg-cream-300'
            }`}
          />
        ))}
        <span className="numerals shrink-0 text-xs font-medium text-ink-400">
          Step {step} of 2
        </span>
      </div>

      {step === 1 ? (
        <form onSubmit={onContinue} className="space-y-4" noValidate>
          {error && <Alert tone="error">{error}</Alert>}

          <AuthField
            label="Full name"
            icon={User}
            value={form.name}
            onChange={set('name')}
            autoComplete="name"
            placeholder="Rahul Verma"
            error={fieldErrors.name}
            autoFocus
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
          />

          <div className="pt-2">
            <AuthSubmit>Continue</AuthSubmit>
          </div>

          <p className="pt-1 text-center text-xs text-ink-400">
            Save your details for your next visit and keep every reservation close at hand.
          </p>
        </form>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && <Alert tone="error">{error}</Alert>}

          {/* What was captured in step one, so it is never a black box. */}
          <div className="flex items-start justify-between gap-3 rounded-2xl bg-sky-100 px-4 py-3">
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink-900">{form.name}</span>
              <span className="block truncate text-xs text-ink-600">{form.email}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setFieldErrors({});
                setStep(1);
              }}
              className="shrink-0 text-xs font-medium text-ink-700 underline underline-offset-2 hover:text-ink-900"
            >
              Edit
            </button>
          </div>

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
            autoFocus
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
            <AuthSubmit loading={submitting}>Create account</AuthSubmit>
          </div>

          <button
            type="button"
            onClick={() => setStep(1)}
            className="mx-auto flex items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-ink-800"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Back
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
