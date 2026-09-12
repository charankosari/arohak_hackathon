'use client';

import { LayoutDashboard, LogOut, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Badge, Button } from '@/components/ui';
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
    <header className="sticky top-0 z-40 border-b border-ink-800 bg-ink-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-md bg-brass-500 font-serif text-lg font-bold text-ink-950">
            M
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block font-serif text-base font-semibold text-white">
              The Meridian Grand
            </span>
            <span className="block text-[11px] tracking-widest text-brass-300 uppercase">
              Mumbai
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {PUBLIC_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-3 py-2 text-sm transition-colors ${
                pathname === link.href
                  ? 'bg-ink-800 text-white'
                  : 'text-ink-300 hover:bg-ink-800 hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {loading ? (
            <div className="h-9 w-24 animate-pulse rounded-lg bg-ink-800" />
          ) : user ? (
            <>
              <Link
                href="/dashboard"
                className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-200 hover:bg-ink-800 hover:text-white sm:flex"
              >
                <LayoutDashboard className="size-4" />
                Dashboard
              </Link>
              <div className="hidden items-center gap-2.5 border-l border-ink-800 pl-3 sm:flex">
                <span
                  className="grid size-8 place-items-center rounded-full bg-ink-700 text-xs font-semibold text-white"
                  title={user.name}
                >
                  {initials(user.name)}
                </span>
                <span className="leading-tight">
                  <span className="block max-w-[9rem] truncate text-xs font-medium text-white">
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
                  className="rounded-md p-2 text-ink-400 hover:bg-ink-800 hover:text-white"
                >
                  <LogOut className="size-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link href="/login">
                <Button variant="ghost" className="!text-ink-200 hover:!bg-ink-800">
                  Sign in
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="brass">Create account</Button>
              </Link>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="rounded-md p-2 text-ink-300 hover:bg-ink-800 hover:text-white md:hidden"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-ink-800 px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {PUBLIC_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-ink-200 hover:bg-ink-800 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            {user ? (
              <>
                <Link
                  href="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-md px-3 py-2 text-sm text-ink-200 hover:bg-ink-800 hover:text-white"
                >
                  Dashboard
                </Link>
                <div className="mt-2 flex items-center justify-between border-t border-ink-800 pt-3">
                  <span className="text-sm text-white">
                    {user.name}
                    <Badge status={user.role} className="ml-2 !text-[10px]">
                      {ROLE_LABELS[user.role]}
                    </Badge>
                  </span>
                  <Button variant="quiet" size="sm" onClick={logout}>
                    Sign out
                  </Button>
                </div>
              </>
            ) : (
              <div className="mt-2 flex gap-2 border-t border-ink-800 pt-3">
                <Link href="/login" className="flex-1" onClick={() => setMenuOpen(false)}>
                  <Button variant="quiet" className="w-full">
                    Sign in
                  </Button>
                </Link>
                <Link href="/register" className="flex-1" onClick={() => setMenuOpen(false)}>
                  <Button variant="brass" className="w-full">
                    Create account
                  </Button>
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
