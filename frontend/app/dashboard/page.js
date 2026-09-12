'use client';

import {
  BedDouble,
  Building2,
  CalendarCheck,
  CalendarPlus,
  IndianRupee,
  LogIn,
  LogOut,
  Users,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LoadingBlock, StatTile } from '@/components/ui';
import { api } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/constants';
import { formatDate, money } from '@/lib/format';

export default function DashboardPage() {
  const { user, isAdmin, isStaff, isCustomer } = useAuth();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // Guests have no overview - their bookings are the landing page.
  useEffect(() => {
    if (isCustomer) router.replace('/dashboard/my-bookings');
  }, [isCustomer, router]);

  useEffect(() => {
    if (!user || isCustomer) return;

    async function load() {
      try {
        if (isAdmin) {
          const [dashboard, frontDesk] = await Promise.all([
            api.users.dashboard(),
            api.bookings.frontDesk(),
          ]);
          setData({ dashboard, frontDesk });
        } else {
          const frontDesk = await api.bookings.frontDesk();
          setData({ frontDesk });
        }
      } catch (err) {
        setError(err.message);
      }
    }
    load();
  }, [user, isAdmin, isStaff, isCustomer]);

  // Redirecting; render nothing rather than flashing an empty overview.
  if (!user || isCustomer) return null;

  return (
    <div className="space-y-6">
      <header className="rounded-3xl bg-sky-200 px-6 py-7 sm:px-8">
        <p className="text-xs tracking-[0.2em] text-ink-600 uppercase">
          {ROLE_LABELS[user.role]} dashboard
        </p>
        <h1 className="mt-2 font-serif text-3xl font-bold text-ink-900 sm:text-4xl">
          Welcome back, {user.name.split(' ')[0]}
        </h1>
        <p className="mt-1.5 text-sm text-ink-700">
          {new Intl.DateTimeFormat('en-IN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            timeZone: 'Asia/Kolkata',
          }).format(new Date())}
        </p>
      </header>

      {error && (
        <Alert tone="error" title="Could not load your dashboard">
          {error}
        </Alert>
      )}

      {!data ? (
        <Card>
          <LoadingBlock rows={4} />
        </Card>
      ) : (
        <StaffOverview isAdmin={isAdmin} {...data} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

function StaffOverview({ isAdmin, dashboard, frontDesk }) {
  const byStatus = frontDesk.bookingsByStatus ?? {};

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Arrivals today"
          value={frontDesk.arrivals.length}
          hint={formatDate(frontDesk.date)}
          icon={LogIn}
          tone="brass"
        />
        <StatTile
          label="Departures today"
          value={frontDesk.departures.length}
          hint={formatDate(frontDesk.date)}
          icon={LogOut}
        />
        <StatTile label="In house" value={byStatus.CHECKED_IN ?? 0} icon={BedDouble} tone="light" />
        <StatTile
          label="Pending cancellations"
          value={frontDesk.pendingCancellationRequests}
          hint={frontDesk.pendingCancellationRequests ? 'Needs review' : 'Queue clear'}
          icon={XCircle}
          tone="light"
        />
      </div>

      {isAdmin && dashboard && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Booked revenue" value={money(dashboard.bookedRevenue)} icon={IndianRupee} />
          <StatTile label="Rooms" value={dashboard.totalRooms} icon={BedDouble} />
          <StatTile label="Hotels" value={dashboard.totalHotels} icon={Building2} />
          <StatTile
            label="Accounts"
            value={Object.values(dashboard.users).reduce((a, b) => a + b, 0)}
            hint={`${dashboard.users.CUSTOMER ?? 0} guests, ${
              (dashboard.users.ADMIN ?? 0) + (dashboard.users.RECEPTIONIST ?? 0)
            } staff`}
            icon={Users}
          />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <ArrivalsList
          title="Arrivals today"
          bookings={frontDesk.arrivals}
          empty="No arrivals scheduled for today."
        />
        <ArrivalsList
          title="Departures today"
          bookings={frontDesk.departures}
          empty="No departures scheduled for today."
        />
      </div>

      <Card>
        <CardHeader
          title="Bookings by status"
          action={
            <Link href="/dashboard/bookings">
              <Button variant="outline" size="sm">
                Open bookings
              </Button>
            </Link>
          }
        />
        <div className="flex flex-wrap gap-3 p-5">
          {Object.keys(byStatus).length === 0 ? (
            <p className="text-sm text-ink-500">No bookings yet.</p>
          ) : (
            Object.entries(byStatus).map(([status, count]) => (
              <div
                key={status}
                className="flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2"
              >
                <Badge status={status} />
                <span className="text-sm font-semibold text-ink-900">{count}</span>
              </div>
            ))
          )}
        </div>
      </Card>
    </>
  );
}

function ArrivalsList({ title, bookings, empty }) {
  return (
    <Card>
      <CardHeader title={title} subtitle={`${bookings.length} today`} />
      {bookings.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {bookings.map((booking) => (
            <li key={booking.id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-900">{booking.guestName}</p>
                <p className="mt-0.5 text-xs text-ink-500">
                  Room {booking.room.roomNumber} &middot; {booking.room.roomType} &middot;{' '}
                  {booking.guests} {booking.guests === 1 ? 'guest' : 'guests'}
                </p>
              </div>
              <span className="font-mono text-xs text-ink-400">{booking.reference}</span>
              <Badge status={booking.status} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
