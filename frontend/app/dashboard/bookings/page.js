'use client';

import { CalendarSearch, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { CancelDialog } from '@/components/CancelDialog';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  LoadingBlock,
  Modal,
  Select,
  TableWrap,
  Td,
  Textarea,
  Th,
} from '@/components/ui';
import { api } from '@/lib/api';
import { BOOKING_STATUSES } from '@/lib/constants';
import {
  addDaysISO,
  formatDate,
  formatDateTime,
  money,
  nightsBetween,
  todayISO,
} from '@/lib/format';

export default function StaffBookingsPage() {
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({ status: '', reference: '', from: '', to: '' });
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api.bookings.list({ ...filters, take: 100 }));
    } catch (err) {
      setError(err.message);
      setData({ bookings: [], total: 0 });
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(booking, status) {
    setError(null);
    try {
      await api.bookings.setStatus(booking.id, status);
      setNotice({
        tone: 'success',
        text: `${booking.reference} marked ${status.toLowerCase().replace(/_/g, ' ')}.`,
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink-900">Bookings</h1>
          <p className="mt-1 text-sm text-ink-500">
            Every reservation in the property. Check guests in and out, or book on their behalf.
          </p>
        </div>
        <Button variant="brass" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          New booking
        </Button>
      </header>

      {notice && (
        <Alert tone={notice.tone} className="animate-fade-up">
          {notice.text}
        </Alert>
      )}
      {error && <Alert tone="error">{error}</Alert>}

      <Card>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Status">
            <Select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">All statuses</option>
              {BOOKING_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reference">
            <Input
              placeholder="MG-XXXXXX"
              value={filters.reference}
              onChange={(e) => setFilters((f) => ({ ...f, reference: e.target.value }))}
            />
          </Field>
          <Field label="Arriving from">
            <Input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            />
          </Field>
          <Field label="Arriving to">
            <Input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            />
          </Field>
          <div className="flex items-end">
            <Button
              variant="quiet"
              className="w-full"
              onClick={() => setFilters({ status: '', reference: '', from: '', to: '' })}
            >
              Clear
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="All bookings"
          subtitle={data ? `${data.total} total` : undefined}
        />
        {data === null ? (
          <LoadingBlock rows={5} />
        ) : data.bookings.length === 0 ? (
          <EmptyState icon={CalendarSearch} title="No bookings match these filters">
            Adjust or clear the filters above.
          </EmptyState>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Reference</Th>
                <Th>Guest</Th>
                <Th>Room</Th>
                <Th>Stay</Th>
                <Th>Booked on</Th>
                <Th>Total</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {data.bookings.map((booking) => {
                const pending = booking.cancellationRequests?.some((r) => r.status === 'PENDING');
                return (
                  <tr key={booking.id} className="hover:bg-ink-50">
                    <Td>
                      <span className="font-mono text-xs text-ink-700">{booking.reference}</span>
                      {pending && (
                        <Badge status="PENDING" className="ml-2 !text-[10px]">
                          Cancel requested
                        </Badge>
                      )}
                    </Td>
                    <Td>
                      <p className="font-medium text-ink-900">{booking.guestName}</p>
                      <p className="text-xs text-ink-500">{booking.guestEmail}</p>
                    </Td>
                    <Td>
                      <p className="text-ink-900">{booking.room.roomNumber}</p>
                      <p className="text-xs text-ink-500">{booking.room.roomType}</p>
                    </Td>
                    <Td className="whitespace-nowrap">
                      <p className="text-ink-900">
                        {formatDate(booking.checkIn)} &rarr; {formatDate(booking.checkOut)}
                      </p>
                      <p className="text-xs text-ink-500">
                        {booking.nights}n &middot; {booking.guests}g
                      </p>
                    </Td>
                    <Td className="whitespace-nowrap text-ink-600">
                      <p>{formatDateTime(booking.createdAt)}</p>
                      {booking.cancelledAt && (
                        <p className="text-xs text-rose-600">
                          cancelled {formatDateTime(booking.cancelledAt)}
                        </p>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap font-medium text-ink-900">
                      {money(booking.totalAmount)}
                    </Td>
                    <Td>
                      <Badge status={booking.status} />
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-1.5">
                        {booking.status === 'CONFIRMED' && (
                          <>
                            <Button size="sm" onClick={() => setStatus(booking, 'CHECKED_IN')}>
                              Check in
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setStatus(booking, 'NO_SHOW')}
                            >
                              No-show
                            </Button>
                          </>
                        )}
                        {booking.status === 'CHECKED_IN' && (
                          <Button size="sm" onClick={() => setStatus(booking, 'CHECKED_OUT')}>
                            Check out
                          </Button>
                        )}
                        {['CONFIRMED', 'CHECKED_IN'].includes(booking.status) && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => setCancelTarget(booking)}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <CancelDialog
        booking={cancelTarget}
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onDone={(result) => {
          setNotice({
            tone: 'success',
            text: `Booking ${result.booking.reference} cancelled.`,
          });
          load();
        }}
      />

      <NewBookingDialog
        open={creating}
        onClose={() => setCreating(false)}
        onDone={(result) => {
          setNotice({
            tone: 'success',
            text:
              `Booking ${result.booking.reference} created for ${result.booking.guestName}.` +
              (result.guestAccountCreated ? ' A guest account was created for them.' : ''),
          });
          load();
        }}
      />
    </div>
  );
}

/** Staff booking on behalf of a guest - by email, creating an account if new. */
function NewBookingDialog({ open, onClose, onDone }) {
  const { user } = useAuth();
  const today = todayISO();

  const [form, setForm] = useState({
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    checkIn: addDaysISO(today, 1),
    checkOut: addDaysISO(today, 2),
    guests: 1,
    specialRequests: '',
  });
  const [rooms, setRooms] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const nights = nightsBetween(form.checkIn, form.checkOut);
  const invalidDates = nights < 1;

  // Re-check availability whenever the stay or party size changes.
  useEffect(() => {
    if (!open || invalidDates) return;

    setRooms(null);
    setRoomId('');
    api.rooms
      .availability({ checkIn: form.checkIn, checkOut: form.checkOut, guests: form.guests })
      .then(({ rooms: found }) => setRooms(found))
      .catch((err) => {
        setError(err.message);
        setRooms([]);
      });
  }, [open, form.checkIn, form.checkOut, form.guests, invalidDates]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const selected = rooms?.find((r) => r.id === roomId);

  async function submit() {
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      const result = await api.bookings.create({
        roomId,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        guests: Number(form.guests),
        guestName: form.guestName.trim(),
        guestEmail: form.guestEmail.trim(),
        ...(form.guestPhone.trim() ? { guestPhone: form.guestPhone.trim() } : {}),
        ...(form.specialRequests.trim() ? { specialRequests: form.specialRequests.trim() } : {}),
      });
      onDone?.(result);
      onClose();
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fieldErrors ?? {});
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="New booking"
      description={`Created by ${user?.name}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="brass"
            onClick={submit}
            loading={submitting}
            disabled={!roomId || !form.guestName.trim() || !form.guestEmail.trim() || invalidDates}
          >
            Create booking
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Guest name" required error={fieldErrors.guestName}>
            <Input
              value={form.guestName}
              onChange={set('guestName')}
              placeholder="Rahul Verma"
              error={fieldErrors.guestName}
            />
          </Field>
          <Field
            label="Guest email"
            required
            error={fieldErrors.guestEmail}
            hint="An account is created if this is a new guest"
          >
            <Input
              type="email"
              value={form.guestEmail}
              onChange={set('guestEmail')}
              placeholder="guest@example.com"
              error={fieldErrors.guestEmail}
            />
          </Field>
        </div>

        <Field label="Guest phone" error={fieldErrors.guestPhone}>
          <Input
            type="tel"
            value={form.guestPhone}
            onChange={set('guestPhone')}
            placeholder="+91 98200 10000"
            error={fieldErrors.guestPhone}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Check-in" required>
            <Input
              type="date"
              value={form.checkIn}
              min={today}
              onChange={(e) => {
                const value = e.target.value;
                setForm((f) => ({
                  ...f,
                  checkIn: value,
                  checkOut:
                    nightsBetween(value, f.checkOut) < 1 ? addDaysISO(value, 1) : f.checkOut,
                }));
              }}
            />
          </Field>
          <Field label="Check-out" required error={invalidDates ? 'Invalid' : undefined}>
            <Input
              type="date"
              value={form.checkOut}
              min={addDaysISO(form.checkIn, 1)}
              onChange={set('checkOut')}
              error={invalidDates}
            />
          </Field>
          <Field label="Guests" required>
            <Select value={form.guests} onChange={set('guests')}>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="Available room"
          required
          hint={
            rooms === null
              ? 'Checking availability...'
              : `${rooms.length} room${rooms.length === 1 ? '' : 's'} free for these dates`
          }
        >
          <Select value={roomId} onChange={(e) => setRoomId(e.target.value)} disabled={!rooms?.length}>
            <option value="">
              {rooms === null
                ? 'Loading...'
                : rooms.length
                  ? 'Select a room'
                  : 'No rooms available for these dates'}
            </option>
            {(rooms ?? []).map((room) => (
              <option key={room.id} value={room.id}>
                {room.roomNumber} - {room.roomType} - {money(room.pricePerNight)}/night (max{' '}
                {room.maxGuests})
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Special requests">
          <Textarea
            value={form.specialRequests}
            onChange={set('specialRequests')}
            placeholder="High floor, airport transfer, dietary needs..."
            maxLength={1000}
          />
        </Field>

        {selected && !invalidDates && (
          <div className="space-y-1.5 rounded-lg bg-ink-50 p-4 text-sm">
            <div className="flex justify-between text-ink-600">
              <span>
                {money(selected.pricePerNight)} &times; {nights}{' '}
                {nights === 1 ? 'night' : 'nights'}
              </span>
              <span>{money(selected.quote.totalAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-ink-200 pt-1.5 font-semibold text-ink-900">
              <span>Total</span>
              <span>{money(selected.quote.totalAmount)}</span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
