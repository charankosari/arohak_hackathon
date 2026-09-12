'use client';

import { Loader2, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { STATUS_TONE } from '@/lib/constants';
import { titleCase } from '@/lib/format';

const cx = (...classes) => classes.filter(Boolean).join(' ');

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

const BUTTON_VARIANTS = {
  primary: 'bg-ink-900 text-white hover:bg-ink-800 disabled:bg-ink-300',
  brass: 'bg-brass-500 text-ink-950 hover:bg-brass-400 disabled:bg-brass-200',
  outline: 'border border-ink-300 bg-white text-ink-800 hover:bg-ink-50 disabled:text-ink-400',
  ghost: 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
  danger: 'bg-rose-600 text-white hover:bg-rose-500 disabled:bg-rose-300',
  quiet: 'border border-ink-200 bg-ink-50 text-ink-700 hover:bg-ink-100',
};

const BUTTON_SIZES = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
        'disabled:cursor-not-allowed',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------

const FIELD_BASE =
  'w-full rounded-lg border bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 ' +
  'disabled:bg-ink-50 disabled:text-ink-400';

export function Field({ label, error, hint, required, children, className }) {
  return (
    <label className={cx('block', className)}>
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-ink-700">
          {label}
          {required && <span className="ml-0.5 text-rose-600">*</span>}
        </span>
      )}
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-rose-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-ink-400">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input({ error, className, ...props }) {
  return (
    <input
      className={cx(FIELD_BASE, error ? 'border-rose-400' : 'border-ink-200', className)}
      {...props}
    />
  );
}

export function Textarea({ error, className, ...props }) {
  return (
    <textarea
      rows={3}
      className={cx(
        FIELD_BASE,
        'resize-y',
        error ? 'border-rose-400' : 'border-ink-200',
        className
      )}
      {...props}
    />
  );
}

export function Select({ error, className, children, ...props }) {
  return (
    <select
      className={cx(FIELD_BASE, error ? 'border-rose-400' : 'border-ink-200', className)}
      {...props}
    >
      {children}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

export function Card({ children, className, as: Tag = 'div', ...props }) {
  return (
    <Tag
      className={cx('rounded-xl border border-ink-200 bg-white shadow-sm', className)}
      {...props}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({ title, subtitle, action, className }) {
  return (
    <div
      className={cx(
        'flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 px-5 py-4',
        className
      )}
    >
      <div>
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Badge({ status, children, tone, className }) {
  const resolved = tone ?? STATUS_TONE[status] ?? 'bg-ink-100 text-ink-700 ring-ink-200';
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        resolved,
        className
      )}
    >
      {children ?? titleCase(status)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

export function Alert({ tone = 'info', title, children, className }) {
  const tones = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-rose-200 bg-rose-50 text-rose-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  };
  return (
    <div className={cx('rounded-lg border px-4 py-3 text-sm', tones[tone], className)}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? 'mt-1' : undefined}>{children}</div>}
    </div>
  );
}

export function Spinner({ className }) {
  return (
    <Loader2 className={cx('size-5 animate-spin text-ink-400', className)} aria-label="Loading" />
  );
}

export function LoadingBlock({ label = 'Loading', rows = 3 }) {
  return (
    <div className="space-y-3 p-5" aria-busy="true" aria-label={label}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-ink-100" />
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {Icon && (
        <div className="mb-3 grid size-11 place-items-center rounded-full bg-ink-100">
          <Icon className="size-5 text-ink-400" aria-hidden />
        </div>
      )}
      <p className="text-sm font-medium text-ink-800">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-ink-500">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);

    // Stop the page behind the dialog from scrolling.
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    // Move focus into the dialog for screen-reader and keyboard users.
    panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'animate-fade-up relative w-full overflow-hidden rounded-xl bg-white shadow-xl',
          sizes[size]
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-ink-100 bg-ink-50 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

/** Tables scroll horizontally on small screens rather than breaking layout. */
export function TableWrap({ children, className }) {
  return (
    <div className={cx('overflow-x-auto', className)}>
      <table className="w-full min-w-[40rem] text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }) {
  return (
    <th
      className={cx(
        'whitespace-nowrap border-b border-ink-200 bg-ink-50 px-4 py-2.5',
        'text-xs font-semibold tracking-wide text-ink-500 uppercase',
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }) {
  return (
    <td className={cx('border-b border-ink-100 px-4 py-3 align-middle', className)}>{children}</td>
  );
}

export function StatTile({ label, value, hint, icon: Icon, tone = 'ink' }) {
  const tones = {
    ink: 'bg-ink-900 text-white',
    brass: 'bg-brass-500 text-ink-950',
    light: 'bg-ink-100 text-ink-700',
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold text-ink-900">{value}</p>
          {hint && <p className="mt-1 truncate text-xs text-ink-400">{hint}</p>}
        </div>
        {Icon && (
          <div className={cx('grid size-9 shrink-0 place-items-center rounded-lg', tones[tone])}>
            <Icon className="size-4" aria-hidden />
          </div>
        )}
      </div>
    </Card>
  );
}
