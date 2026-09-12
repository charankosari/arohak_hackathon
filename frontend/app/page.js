'use client';

import {
  BedDouble,
  Car,
  Clock,
  Dumbbell,
  Utensils,
  Waves,
  Wifi,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AvailabilitySearch } from '@/components/AvailabilitySearch';
import { Navbar } from '@/components/Navbar';
import { Card, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { money } from '@/lib/format';

const FACILITIES = [
  { icon: Utensils, name: 'Harbour Table', detail: 'Ground floor - 6:30 AM to 11:00 PM' },
  { icon: Waves, name: 'Swimming pool', detail: '4th floor - 6:00 AM to 9:00 PM' },
  { icon: Dumbbell, name: 'Fitness centre', detail: '3rd floor - open 24 hours' },
  { icon: Wifi, name: 'Complimentary Wi-Fi', detail: 'Rooms and all common areas' },
  { icon: Car, name: 'Basement parking', detail: 'Complimentary for resident guests' },
  { icon: Clock, name: '24-hour reception', detail: 'English, Hindi and Marathi' },
];

export default function HomePage() {
  const [roomTypes, setRoomTypes] = useState(null);

  useEffect(() => {
    api.rooms
      .types()
      .then(({ types }) => setRoomTypes(types))
      .catch(() => setRoomTypes([]));
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden bg-ink-950">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--color-ink-800),transparent_60%)]"
        />
        <div className="relative mx-auto max-w-7xl px-4 pt-16 pb-24 sm:px-6 lg:pt-24">
          <p className="text-xs tracking-[0.2em] text-brass-300 uppercase">
            Nariman Point &middot; Marine Drive
          </p>
          <h1 className="mt-4 max-w-3xl font-serif text-4xl leading-tight font-bold text-white sm:text-5xl lg:text-6xl">
            A seafront address in the heart of Mumbai
          </h1>
          <p className="mt-5 max-w-xl text-base text-ink-300">
            Sea-view suites, a rooftop lounge on the eighteenth floor, and a
            twenty-four-hour reception. Check in at 2:00 PM, check out at noon.
          </p>

          <div className="mt-10 max-w-4xl">
            <AvailabilitySearch />
          </div>
        </div>
      </section>

      {/* Room categories */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-3xl font-bold text-ink-900">Rooms &amp; suites</h2>
            <p className="mt-2 text-sm text-ink-500">
              Five categories, from a Deluxe King to a two-bedroom Family Suite.
            </p>
          </div>
          <Link
            href="/rooms"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brass-600 hover:text-brass-700"
          >
            Browse all rooms
            <ArrowRight className="size-4" />
          </Link>
        </div>

        {roomTypes === null ? (
          <div className="grid place-items-center py-16">
            <Spinner />
          </div>
        ) : roomTypes.length === 0 ? (
          <Card className="mt-8 p-8 text-center text-sm text-ink-500">
            Room information is unavailable right now. Please make sure the API is running.
          </Card>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {roomTypes.map((type) => (
              <Card key={type.roomType} className="flex flex-col overflow-hidden">
                <div className="flex h-28 items-center justify-center bg-ink-900">
                  <BedDouble className="size-8 text-brass-400" aria-hidden />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="font-serif text-xl font-semibold text-ink-900">
                    {type.roomType}
                  </h3>
                  <p className="mt-1 text-sm text-ink-500">
                    Sleeps up to {type.maxGuests} {type.maxGuests === 1 ? 'guest' : 'guests'}
                  </p>
                  <div className="mt-4 flex items-end justify-between border-t border-ink-100 pt-4">
                    <span>
                      <span className="text-lg font-semibold text-ink-900">
                        {money(type.minPrice)}
                      </span>
                      <span className="text-sm text-ink-500"> / night</span>
                    </span>
                    <Link
                      href={`/rooms?roomType=${encodeURIComponent(type.roomType)}`}
                      className="text-sm font-medium text-brass-600 hover:text-brass-700"
                    >
                      View
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Facilities */}
      <section className="border-y border-ink-200 bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="font-serif text-3xl font-bold text-ink-900">Hotel facilities</h2>
          <div className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {FACILITIES.map((facility) => (
              <div key={facility.name} className="flex gap-4">
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-ink-50 ring-1 ring-ink-200">
                  <facility.icon className="size-5 text-ink-700" aria-hidden />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-900">{facility.name}</p>
                  <p className="mt-0.5 text-sm text-ink-500">{facility.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Policies */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div>
            <h2 className="font-serif text-3xl font-bold text-ink-900">Good to know</h2>
            <p className="mt-3 text-sm text-ink-500">
              The essentials before you book. Reception is happy to help with anything
              else on +91 22 4567 8900.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
            {[
              {
                title: 'Check-in & check-out',
                body: 'Check-in from 2:00 PM, check-out by 12:00 PM. Early check-in before 10:00 AM may incur a charge of INR 1,500, subject to availability.',
              },
              {
                title: 'Free cancellation',
                body: 'Cancel directly up to 24 hours before check-in. Later requests are reviewed by our staff, and your booking stays confirmed until a decision is made.',
              },
              {
                title: 'Children & extra beds',
                body: 'Children under 6 stay free in an existing bed. Extra beds are available in selected categories and must be requested in advance.',
              },
              {
                title: 'Breakfast',
                body: 'Served at Harbour Table from 6:30 AM to 10:30 AM. Included only with selected room packages - check your booking details.',
              },
            ].map((policy) => (
              <Card key={policy.title} className="p-5">
                <p className="text-sm font-semibold text-ink-900">{policy.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{policy.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-800 bg-ink-950 py-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-4 sm:flex-row sm:px-6">
          <div>
            <p className="font-serif text-lg font-semibold text-white">The Meridian Grand</p>
            <p className="mt-1 text-sm text-ink-400">
              18 Marine View Road, Nariman Point, Mumbai 400021
            </p>
          </div>
          <div className="text-sm text-ink-400">
            <p>+91 22 4567 8900</p>
            <p className="mt-1">reservations@meridiangrand.example</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
