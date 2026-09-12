'use client';

import { LayoutDashboard, LogOut, Menu, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Badge } from '@/components/ui';
import { ROLE_LABELS } from '@/lib/constants';
import { initials } from '@/lib/format';

const PUBLIC_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/rooms', label: 'Rooms & Suites' },
];

export function Navbar() {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-cream-300/70 bg-cream-100/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo.png"
            alt="The Meridian Grand"
            width={40}
            height={40}
            priority
            className="size-10 rounded-full object-cover"
          />
          <span className="hidden leading-tight sm:block">
            <span className="block font-serif text-base font-semibold text-ink-900">
              The Meridian Grand
            </span>
            <span className="block text-[11px] tracking-[0.18em] text-ink-400 uppercase">
              Mumbai
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {PUBLIC_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${
                pathname === link.href
                  ? 'bg-sky-200 font-medium text-ink-900'
                  : 'text-ink-600 hover:bg-sky-100 hover:text-ink-900'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {loading ? (
            <div className="h-10 w-24 animate-pulse rounded-full bg-cream-200" />
          ) : user ? (
            <>
              <Link
                href="/dashboard"
                className="hidden items-center gap-2 rounded-full px-4 py-2 text-sm text-ink-600 hover:bg-sky-100 hover:text-ink-900 sm:flex"
              >
                <LayoutDashboard className="size-4" />
                Dashboard
              </Link>
              <div className="hidden items-center gap-2.5 border-l border-cream-300 pl-3 sm:flex">
                <span
                  className="grid size-9 place-items-center rounded-full bg-sky-300 text-xs font-semibold text-ink-900"
                  title={user.name}
                >
                  {initials(user.name)}
                </span>
                <span className="leading-tight">
                  <span className="block max-w-[9rem] truncate text-xs font-medium text-ink-900">
                    {user.name}
                  </span>
                  <Badge status={user.role} className="mt-0.5 !py-0 !text-[10px]">
                    {ROLE_LABELS[user.role]}
                  </Badge>
                </span>
                <button
                  type="button"
                  onClick={logout}
                  title="Sign out"
                  aria-label="Sign out"
                  className="rounded-full p-2 text-ink-400 hover:bg-cream-200 hover:text-ink-800"
                >
                  <LogOut className="size-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link
                href="/login"
                className="rounded-full px-4 py-2 text-sm text-ink-700 hover:bg-sky-100"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-ink-900 px-5 py-2.5 text-sm font-medium text-cream-100 transition-colors hover:bg-ink-800"
              >
                Create account
              </Link>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="rounded-full p-2 text-ink-600 hover:bg-sky-100 md:hidden"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-cream-300 bg-cream-100 px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {PUBLIC_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-sm text-ink-700 hover:bg-sky-100"
              >
                {link.label}
              </Link>
            ))}
            {user ? (
              <>
                <Link
                  href="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm text-ink-700 hover:bg-sky-100"
                >
                  Dashboard
                </Link>
                <div className="mt-2 flex items-center justify-between border-t border-cream-300 pt-3">
                  <span className="text-sm text-ink-900">
                    {user.name}
                    <Badge status={user.role} className="ml-2 !text-[10px]">
                      {ROLE_LABELS[user.role]}
                    </Badge>
                  </span>
                  <button
                    type="button"
                    onClick={logout}
                    className="rounded-full border border-cream-300 px-3 py-1.5 text-xs text-ink-700"
                  >
                    Sign out
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-2 flex gap-2 border-t border-cream-300 pt-3">
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="flex-1 rounded-full border border-ink-200 px-4 py-2 text-center text-sm text-ink-800"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMenuOpen(false)}
                  className="flex-1 rounded-full bg-ink-900 px-4 py-2 text-center text-sm font-medium text-cream-100"
                >
                  Create account
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
