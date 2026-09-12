'use client';

import { Menu, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { Spinner } from '@/components/ui';

export default function DashboardLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Send anonymous visitors to sign in, remembering where they were going.
  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, pathname, router]);

  // Close the mobile drawer on navigation.
  useEffect(() => setDrawerOpen(false), [pathname]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-ink-50">
        <Navbar />
        <div className="grid place-items-center py-32">
          <Spinner />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <Navbar />

      <div className="mx-auto flex max-w-7xl">
        {/* Desktop sidebar */}
        <aside className="sticky top-[65px] hidden h-[calc(100vh-65px)] w-60 shrink-0 border-r border-ink-200 bg-white lg:block">
          <Sidebar />
        </aside>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 bg-ink-950/40"
              onClick={() => setDrawerOpen(false)}
            />
            <aside className="animate-fade-up absolute top-0 left-0 h-full w-64 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
                <span className="text-sm font-semibold text-ink-900">Menu</span>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-md p-1 text-ink-400 hover:bg-ink-100"
                  aria-label="Close"
                >
                  <X className="size-4" />
                </button>
              </div>
              <Sidebar onNavigate={() => setDrawerOpen(false)} />
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="m-4 inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700 lg:hidden"
          >
            <Menu className="size-4" />
            Menu
          </button>

          <div className="px-4 pt-2 pb-10 sm:px-6 lg:pt-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
