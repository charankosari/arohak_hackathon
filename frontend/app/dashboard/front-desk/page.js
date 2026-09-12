'use client';

import { LogIn, LogOut, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  LoadingBlock,
  StatTile,
} from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, money } from '@/lib/format';

export default function FrontDeskPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api.bookings.frontDesk());
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function transition(booking, status) {
    setBusyId(booking.id);
    setError(null);
    try {
      await api.bookings.setStatus(booking.id, status);
      setNotice({
        tone: 'success',
        text: `${booking.guestName} ${status === 'CHECKED_IN' ? 'checked in' : status === 'CHECKED_OUT' ? 'checked out' : 'marked no-show'}.`,
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl font-bold text-ink-900">Front desk</h1>
        <p className="mt-1 text-sm text-ink-500">
          {data ? formatDate(data.date, { weekday: 'long', day: 'numeric', month: 'long' }) : 'Today'}
          {' '}&middot; arrivals, departures and in-house guests
        </p>
      </header>

      {notice && (
        <Alert tone={notice.tone} className="animate-fade-up">
          {notice.text}
        </Alert>
      )}
      {error && <Alert tone="error">{error}</Alert>}

      {data === null ? (
        <Card>
          <LoadingBlock rows={4} />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile
              label="Arrivals"
              value={data.arrivals.length}
              icon={LogIn}
              tone="brass"
            />
            <StatTile label="Departures" value={data.departures.length} icon={LogOut} />
            <StatTile
              label="In house"
              value={data.bookingsByStatus?.CHECKED_IN ?? 0}
              icon={Users}
              tone="light"
            />
          </div>

          <Card>
            <CardHeader
              title="Expected arrivals"
              subtitle="Check-in opens at 2:00 PM"
            />
            {data.arrivals.length === 0 ? (
              <EmptyState icon={LogIn} title="No arrivals today" />
            ) : (
              <ul className="divide-y divide-ink-100">
                {data.arrivals.map((booking) => (
                  <li
                    key={booking.id}
                    className="flex flex-wrap items-center gap-3 px-5 py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink-900">{booking.guestName}</p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        Room {booking.room.roomNumber} &middot; {booking.room.roomType} &middot;{' '}
                        {booking.guests} {booking.guests === 1 ? 'guest' : 'guests'} &middot;{' '}
                        {booking.nights} {booking.nights === 1 ? 'night' : 'nights'}
                      </p>
                      {booking.specialRequests && (
                        <p className="mt-1 text-xs text-brass-700">
                          Request: {booking.specialRequests}
                        </p>
                      )}
                    </div>
                    <span className="font-mono text-xs text-ink-400">{booking.reference}</span>
                    <span className="text-sm font-medium text-ink-900">
                      {money(booking.totalAmount)}
                    </span>
                    <Badge status={booking.status} />
                    {booking.status === 'CONFIRMED' && (
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          loading={busyId === booking.id}
                          onClick={() => transition(booking, 'CHECKED_IN')}
                        >
                          Check in
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === booking.id}
                          onClick={() => transition(booking, 'NO_SHOW')}
                        >
                          No-show
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Expected departures" subtitle="Check-out by 12:00 PM" />
            {data.departures.length === 0 ? (
              <EmptyState icon={LogOut} title="No departures today" />
            ) : (
              <ul className="divide-y divide-ink-100">
                {data.departures.map((booking) => (
                  <li key={booking.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink-900">{booking.guestName}</p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        Room {booking.room.roomNumber} &middot; arrived{' '}
                        {formatDate(booking.checkIn)}
                      </p>
                    </div>
                    <span className="font-mono text-xs text-ink-400">{booking.reference}</span>
                    <Badge status={booking.status} />
                    {booking.status === 'CHECKED_IN' && (
                      <Button
                        size="sm"
                        loading={busyId === booking.id}
                        onClick={() => transition(booking, 'CHECKED_OUT')}
                      >
                        Check out
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
