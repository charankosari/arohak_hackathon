'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Field, Modal, Spinner, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

/**
 * Cancellation flow. Fetches the policy for this booking first, so the guest is
 * told upfront whether they are inside the free 24-hour window or whether their
 * request has to go to staff for review.
 */
export function CancelDialog({ booking, open, onClose, onDone }) {
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !booking) return;

    setLoading(true);
    setError(null);
    setReason('');
    setPolicy(null);

    api.bookings
      .cancellationPolicy(booking.id)
      .then(setPolicy)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open, booking]);

  const needsReview = policy?.outcome === 'REVIEW_REQUIRED';
  const blocked = policy && policy.allowed === false;

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const result = await api.bookings.cancel(booking.id, {
        ...(reason.trim() ? { reason: reason.trim() } : {}),
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
      open={open}
      onClose={onClose}
      title={needsReview ? 'Request cancellation' : 'Cancel booking'}
      description={booking ? `Booking ${booking.reference}` : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Keep booking
          </Button>
          <Button
            variant="danger"
            onClick={submit}
            loading={submitting}
            disabled={loading || blocked || (needsReview && !reason.trim())}
          >
            {needsReview ? 'Submit request' : 'Cancel booking'}
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="grid place-items-center py-8">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}

          {blocked ? (
            <Alert tone="warn" title="This booking cannot be cancelled">
              {policy.reason}
            </Alert>
          ) : needsReview ? (
            <Alert tone="warn" title="Staff review required">
              The free cancellation window closed on{' '}
              <strong>{formatDateTime(policy.directCancellationDeadline)}</strong>, 24 hours before
              check-in. Your request will be sent to hotel staff, and the booking stays confirmed
              until they decide.
            </Alert>
          ) : (
            <Alert tone="info" title="Free cancellation">
              You can cancel this booking directly until{' '}
              <strong>{formatDateTime(policy.directCancellationDeadline)}</strong>. It will be
              cancelled immediately.
            </Alert>
          )}

          {!blocked && (
            <Field
              label={needsReview ? 'Reason for cancelling' : 'Reason'}
              required={needsReview}
              hint={
                needsReview
                  ? 'Staff use this to decide - please be specific.'
                  : 'Optional, for our records.'
              }
            >
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  needsReview
                    ? 'e.g. Flight cancelled by the airline'
                    : 'e.g. Change of travel plans'
                }
                maxLength={500}
              />
            </Field>
          )}
        </div>
      )}
    </Modal>
  );
}
