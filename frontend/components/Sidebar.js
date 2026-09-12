'use client';

import {
  BedDouble,
  Building2,
  CalendarCheck,
  ConciergeBell,
  LayoutDashboard,
  Search,
  Users,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { ROLES } from '@/lib/constants';

/**
 * Navigation is built from the signed-in role, so a receptionist never sees a
 * link to Hotels or Users. The API enforces the same rules independently - this
 * is for clarity, not security.
 */
const NAV = [
  {
    href: '/dashboard',
    label: 'Overview',
    icon: LayoutDashboard,
    roles: [ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.CUSTOMER],
  },
  {
    href: '/dashboard/front-desk',
    label: 'Front desk',
    icon: ConciergeBell,
    roles: [ROLES.ADMIN, ROLES.RECEPTIONIST],
  },
  {
    href: '/dashboard/bookings',
    label: 'Bookings',
    icon: CalendarCheck,
    roles: [ROLES.ADMIN, ROLES.RECEPTIONIST],
  },
  {
    href: '/dashboard/my-bookings',
    label: 'My bookings',
    icon: CalendarCheck,
    roles: [ROLES.CUSTOMER],
  },
  {
    href: '/dashboard/rooms',
    label: 'Rooms & availability',
    icon: BedDouble,
    roles: [ROLES.ADMIN, ROLES.RECEPTIONIST],
  },
  {
    href: '/dashboard/cancellations',
    label: 'Cancellations',
    icon: XCircle,
    roles: [ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.CUSTOMER],
  },
  { href: '/dashboard/hotels', label: 'Hotels', icon: Building2, roles: [ROLES.ADMIN] },
  { href: '/dashboard/users', label: 'Staff & guests', icon: Users, roles: [ROLES.ADMIN] },
];

export function Sidebar({ onNavigate }) {
  const { user } = useAuth();
  const pathname = usePathname();
  if (!user) return null;

  const items = NAV.filter((item) => item.roles.includes(user.role));

  return (
    <nav className="flex h-full flex-col gap-1 p-3">
      <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-ink-400 uppercase">
        {user.role === ROLES.CUSTOMER ? 'Your stay' : 'Management'}
      </p>

      {items.map((item) => {
        // Exact match on /dashboard so it isn't active for every child route.
        const active =
          item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
              active
                ? 'bg-ink-900 font-medium text-white'
                : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
            }`}
          >
            <item.icon className="size-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}

      <div className="mt-auto border-t border-ink-200 pt-3">
        <Link
          href="/rooms"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-600 hover:bg-ink-100 hover:text-ink-900"
        >
          <Search className="size-4 shrink-0" aria-hidden />
          Browse rooms
        </Link>
      </div>
    </nav>
  );
}
