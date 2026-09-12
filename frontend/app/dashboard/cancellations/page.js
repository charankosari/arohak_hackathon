'use client';

import { CheckCircle2, Inbox, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  LoadingBlock,
  Modal,
  Textarea,
} from '@/components/ui';
import { api } from '@/lib/api';
import { CANCELLATION_STATUSES } from '@/lib/constants';
import { formatDate, formatDateTime, money } from '@/lib/format';

export default function CancellationsPage() {
  const { isStaff } = useAuth();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState(isStaff ? 'PENDING' : '');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [review, setReview] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api.cancellations.list({ ...(status ? { status } : {}), take: 100 }));
    } catch (err) {
      setError(err.message);
      setData({ requests: [], total: 0 });
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl font-bold text-ink-900">
          {isStaff ? 'Cancellation requests' : 'Cancellations'}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {isStaff
            ? 'Requests raised after the 24-hour direct-cancellation window closed. Approving cancels the booking; rejecting leaves it confirmed.'
            : 'Plans change. Track requests made within 24 hours of check-in here. Earlier cancellations appear in My bookings.'}
        </p>
      </header>

      {notice && (
        <Alert tone={notice.tone} className="animate-fade-up">
          {notice.text}
        </Alert>
      )}
      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex flex-wrap gap-2">
        {[{ key: '', label: 'All' }, ...CANCELLATION_STATUSES.map((s) => ({ key: s, label: s.charAt(0) + s.slice(1).toLowerCase() }))].map(
          (option) => (
            <button
              key={option.key || 'all'}
              type="button"
              aria-pressed={status === option.key}
              onClick={() => setStatus(option.key)}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                status === option.key
                  ? 'bg-ink-900 font-medium text-white'
                  : 'border border-ink-200 bg-white text-ink-600 hover:bg-cream-100'
              }`}
            >
              {option.label}
            </button>
          )
        )}
      </div>

      <Card>
        <CardHeader
          title={status ? `${status.charAt(0)}${status.slice(1).toLowerCase()} requests` : 'All requests'}
          subtitle={data ? `${data.total} total` : undefined}
        />
        {data === null ? (
          <LoadingBlock rows={3} />
        ) : data.requests.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={isStaff ? 'Nothing in this queue' : 'No cancellation requests'}
            action={
              !isStaff && (
                <Link href="/dashboard/my-bookings">
                  <Button variant="outline" size="sm">
                    View my bookings
                  </Button>
                </Link>
              )
            }
          >
            {isStaff
              ? 'Late cancellation requests from guests will appear here for review.'
              : 'You have no requests in this view. Reservations cancelled more than 24 hours before check-in are listed under My bookings.'}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-ink-100">
            {data.requests.map((request) => (
              <li key={request.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink-900">
                        {request.booking?.room?.roomType}
                        {request.booking?.room?.roomNumber
                          ? ` - Room ${request.booking.room.roomNumber}`
                          : ''}
                      </p>
                      <Badge status={request.status} />
                      {request.booking && (
                        <Badge status={request.booking.status}>
                          Booking {request.booking.status.toLowerCase().replace(/_/g, ' ')}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-ink-500">
                      {request.booking?.guestName} &middot;{' '}
                      <span className="font-mono text-xs">{request.booking?.reference}</span>
                    </p>
                    {request.booking && (
                      <p className="mt-0.5 text-xs text-ink-500">
                        {formatDate(request.booking.checkIn)} &rarr;{' '}
                        {formatDate(request.booking.checkOut)} &middot;{' '}
                        {money(request.booking.totalAmount)}
                      </p>
                    )}
                  </div>
                  {isStaff && request.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setReview({ request, decision: 'APPROVED' })}>
                        <CheckCircle2 className="size-4" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setReview({ request, decision: 'REJECTED' })}
                      >
                        <XCircle className="size-4" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>

                <div className="mt-3 rounded-lg bg-ink-50 p-3">
                  <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">
                    Guest&rsquo;s reason
                  </p>
                  <p className="mt-1 text-sm text-ink-700">{request.reason}</p>
                  <p className="mt-1.5 text-xs text-ink-400">
                    Submitted {formatDateTime(request.createdAt)}
                  </p>
                </div>

                {request.status !== 'PENDING' && (
                  <div
                    className={`mt-2 rounded-lg p-3 ${
                      request.status === 'APPROVED' ? 'bg-emerald-50' : 'bg-rose-50'
                    }`}
                  >
                    <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">
                      Decision
                    </p>
                    <p className="mt-1 text-sm text-ink-700">
                      {request.status === 'APPROVED' ? 'Approved' : 'Rejected'}
                      {request.reviewedBy ? ` by ${request.reviewedBy.name}` : ''}
                      {request.reviewedAt ? ` on ${formatDateTime(request.reviewedAt)}` : ''}
                    </p>
                    {request.reviewNote && (
                      <p className="mt-1 text-sm text-ink-600">&ldquo;{request.reviewNote}&rdquo;</p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ReviewDialog
        review={review}
        onClose={() => setReview(null)}
        onDone={(result) => {
          setNotice({
            tone: result.decision === 'APPROVED' ? 'success' : 'info',
            text:
              result.decision === 'APPROVED'
                ? `Approved. Booking ${result.booking.reference} is now cancelled.`
                : `Rejected. Booking ${result.booking.reference} remains confirmed.`,
          });
          load();
        }}
      />
    </div>
  );
}

function ReviewDialog({ review, onClose, onDone }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setNote('');
    setError(null);
  }, [review]);

  const approving = review?.decision === 'APPROVED';

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const result = await api.cancellations.review(review.request.id, {
        decision: review.decision,
        ...(note.trim() ? { reviewNote: note.trim() } : {}),
      });
      onDone?.(result);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={!!review}
      onClose={onClose}
      title={approving ? 'Approve cancellation' : 'Reject cancellation'}
      description={review?.request?.booking?.reference}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Back
          </Button>
          <Button
            variant={approving ? 'primary' : 'danger'}
            onClick={submit}
            loading={submitting}
          >
            {approving ? 'Approve and cancel booking' : 'Reject request'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}

        <Alert tone={approving ? 'warn' : 'info'}>
          {approving
            ? 'This cancels the booking immediately and frees the room for other guests. It cannot be undone.'
            : 'The booking stays confirmed and the guest keeps their reservation.'}
        </Alert>

        {review?.request && (
          <div className="rounded-lg bg-ink-50 p-3 text-sm">
            <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">
              Guest&rsquo;s reason
            </p>
            <p className="mt-1 text-ink-700">{review.request.reason}</p>
          </div>
        )}

        <Field
          label="Note for the record"
          hint="Visible to the guest on their booking."
        >
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              approving
                ? 'e.g. Airline disruption confirmed, charge waived.'
                : 'e.g. Outside policy, no waiver applicable.'
            }
            maxLength={500}
          />
        </Field>
      </div>
    </Modal>
  );
}
