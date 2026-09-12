'use client';

import { ArrowRight, Car, Clock, Dumbbell, MapPin, Utensils, Waves, Wifi } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AvailabilitySearch } from '@/components/AvailabilitySearch';
import { Navbar } from '@/components/Navbar';
import { ScrollReveal } from '@/components/ScrollReveal';
import { ArchImage, SmartImage } from '@/components/SmartImage';
import { SmoothScroll } from '@/components/SmoothScroll';
import { Blob, Wave } from '@/components/Wave';
import { Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { money } from '@/lib/format';

const FACILITIES = [
  { icon: Utensils, name: 'Harbour Table', detail: 'Ground floor · 6:30 AM – 11:00 PM' },
  { icon: Waves, name: 'Swimming pool', detail: '4th floor · 6:00 AM – 9:00 PM' },
  { icon: Dumbbell, name: 'Fitness centre', detail: '3rd floor · open 24 hours' },
  { icon: Wifi, name: 'Complimentary Wi-Fi', detail: 'Rooms and all common areas' },
  { icon: Car, name: 'Basement parking', detail: 'Complimentary for resident guests' },
  { icon: Clock, name: '24-hour reception', detail: 'English, Hindi and Marathi' },
];

const POLICIES = [
  {
    title: 'Check-in & check-out',
    body: 'Arrive from 2:00 PM, depart by noon. Early check-in before 10:00 AM may carry a charge of ₹1,500, subject to availability.',
  },
  {
    title: 'Free cancellation',
    body: 'Cancel directly up to 24 hours before check-in. Later requests go to our staff, and your booking stays confirmed until they decide.',
  },
  {
    title: 'Children & extra beds',
    body: 'Children under 6 stay free in an existing bed. Extra beds are available in selected categories and must be requested in advance.',
  },
  {
    title: 'Breakfast',
    body: 'Served at Harbour Table from 6:30 AM. Included with selected room packages only — check your booking details.',
  },
];

export default function HomePage() {
  const [roomTypes, setRoomTypes] = useState(null);
  const [hotel, setHotel] = useState(null);
  const [featured, setFeatured] = useState([]);

  useEffect(() => {
    api.rooms
      .types()
      .then(({ types }) => setRoomTypes(types))
      .catch(() => setRoomTypes([]));

    api.hotels
      .list({ take: 1 })
      .then(({ hotels }) => setHotel(hotels[0] ?? null))
      .catch(() => setHotel(null));

    api.rooms
      .list({ take: 100 })
      .then(({ rooms }) => setFeatured(rooms.filter((r) => r.coverImage)))
      .catch(() => setFeatured([]));
  }, []);

  /** One representative photographed room per category. */
  const sampleByType = new Map();
  for (const room of featured) {
    if (!sampleByType.has(room.roomType)) sampleByType.set(room.roomType, room);
  }

  const heroImage = hotel?.coverImage ?? featured[0]?.coverImage ?? null;
  const asideImage = [...sampleByType.values()][2]?.coverImage ?? hotel?.images?.[1] ?? null;

  // One photo per category keeps the collage varied rather than showing four
  // near-identical shots of the same room type.
  const galleryImages = [
    ...(hotel?.images ?? []).slice(1),
    ...[...sampleByType.values()].map((r) => r.coverImage),
  ].filter(Boolean);

  return (
    <div className="min-h-screen overflow-x-clip bg-cream-100">
      <SmoothScroll />
      <Navbar />

      {/* ---------------------------------------------------------- Hero */}
      <section className="relative z-20 px-3 pt-4 sm:px-5">
        {/* Photograph band, with the periwinkle shape rising over it */}
        <div className="relative mx-auto max-w-[92rem] overflow-hidden rounded-[2rem]">
          <div className="relative h-[22rem] sm:h-[26rem] lg:h-[30rem]">
            <SmartImage
              image={heroImage}
              alt="The Meridian Grand Mumbai"
              label="The Meridian Grand"
              priority
              sizes="100vw"
            />
          </div>

          {/* The blob: a wave-topped periwinkle field the headline sits on */}
          <div className="relative -mt-44 sm:-mt-52 lg:-mt-56">
            <div className="text-sky-300">
              <Wave variant="swell" />
            </div>
            <div className="relative bg-sky-300 px-5 pb-14 text-center sm:px-8">
              <Blob className="-top-10 right-8 size-40 bg-cream-100/40" />

              <ScrollReveal>
                <span className="marker-honey inline-block -rotate-1 font-serif text-sm text-ink-800">
                  Nariman Point · Marine Drive
                </span>
              </ScrollReveal>

              <ScrollReveal delay={80}>
                <h1 className="mx-auto mt-5 max-w-4xl font-serif text-[2.5rem] leading-[1.05] font-bold text-ink-900 sm:text-6xl lg:text-7xl">
                  A seafront address in the heart of Mumbai
                </h1>
              </ScrollReveal>

              <ScrollReveal delay={160}>
                <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-ink-700">
                  Sea-view suites, a rooftop lounge on the eighteenth floor, and a
                  twenty-four-hour reception. Check in at 2:00 PM, check out at noon.
                </p>
              </ScrollReveal>

              <ScrollReveal delay={240}>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href="/rooms"
                    className="group inline-flex items-center gap-3 rounded-full bg-ink-900 py-2 pr-2 pl-6 font-medium text-cream-100 transition-colors hover:bg-ink-800"
                  >
                    Browse rooms
                    <span className="grid size-9 place-items-center rounded-full bg-cream-100 text-ink-900 transition-transform group-hover:translate-x-0.5">
                      <ArrowRight className="size-4" aria-hidden />
                    </span>
                  </Link>
                  <a
                    href="#rooms"
                    className="rounded-full bg-cream-100/80 px-6 py-3 text-sm font-medium text-ink-800 transition-colors hover:bg-cream-100"
                  >
                    See our suites
                  </a>
                </div>
              </ScrollReveal>
            </div>

            <div className="rotate-180 text-sky-300">
              <Wave variant="calm" />
            </div>
          </div>
        </div>

        {/* Availability search, lifted over the seam */}
        <ScrollReveal delay={300}>
          <div className="relative z-30 mx-auto -mt-7 max-w-5xl drop-shadow-xl">
            <AvailabilitySearch />
          </div>
        </ScrollReveal>
      </section>

      {/* --------------------------------------------------------- Rooms */}
      <section id="rooms" className="scroll-mt-20 px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <ScrollReveal>
              <p className="text-xs tracking-[0.22em] text-ink-400 uppercase">
                Where you will stay
              </p>
              <h2 className="mt-3 font-serif text-4xl font-bold text-ink-900 sm:text-5xl">
                Rooms &amp; suites
              </h2>
              <p className="mt-3 max-w-md text-ink-500">
                Five categories, from a Deluxe King to a two-bedroom Family Suite — every
                one with sea or city views.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={100}>
              <Link
                href="/rooms"
                className="group inline-flex items-center gap-2 rounded-full bg-sky-200 px-5 py-2.5 text-sm font-medium text-ink-800 transition-colors hover:bg-sky-300"
              >
                Check availability
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-1"
                  aria-hidden
                />
              </Link>
            </ScrollReveal>
          </div>

          {roomTypes === null ? (
            <div className="grid place-items-center py-20">
              <Spinner />
            </div>
          ) : roomTypes.length === 0 ? (
            <p className="mt-10 rounded-2xl bg-white p-8 text-center text-sm text-ink-500">
              Room information is unavailable right now. Please make sure the API is running.
            </p>
          ) : (
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {roomTypes.map((type, index) => {
                const sample = sampleByType.get(type.roomType);
                return (
                  <ScrollReveal key={type.roomType} delay={index * 70}>
                    <Link
                      href={`/rooms?roomType=${encodeURIComponent(type.roomType)}`}
                      className="group block overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-cream-300 transition-shadow hover:shadow-xl"
                    >
                      <div className="relative aspect-4/3 overflow-hidden">
                        <SmartImage
                          image={sample?.coverImage}
                          alt={type.roomType}
                          label={type.roomType}
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="transition-transform duration-700 group-hover:scale-105"
                        />
                        <span className="absolute top-4 left-4 rounded-full bg-cream-100/95 px-3 py-1 text-xs font-medium text-ink-800">
                          Sleeps {type.maxGuests}
                        </span>
                      </div>
                      <div className="p-6">
                        <h3 className="font-serif text-2xl font-semibold text-ink-900">
                          {type.roomType}
                        </h3>
                        <div className="mt-4 flex items-end justify-between border-t border-cream-300 pt-4">
                          <span>
                            <span className="text-xl font-semibold text-ink-900">
                              {money(type.minPrice)}
                            </span>
                            <span className="text-sm text-ink-500"> / night</span>
                          </span>
                          <span className="inline-flex size-9 items-center justify-center rounded-full bg-sky-200 text-ink-800 transition-colors group-hover:bg-ink-900 group-hover:text-cream-100">
                            <ArrowRight className="size-4" aria-hidden />
                          </span>
                        </div>
                      </div>
                    </Link>
                  </ScrollReveal>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------- Facilities */}
      <div className="text-sky-200">
        <Wave variant="calm" />
      </div>

      <section className="relative bg-sky-200 px-4 py-16 sm:px-6 lg:py-24">
        <Blob className="top-8 -right-20 size-80 bg-cream-100/50" variant="blob-alt" />

        <div className="relative mx-auto max-w-7xl">
          <ScrollReveal>
            <p className="text-xs tracking-[0.22em] text-ink-500 uppercase">The property</p>
            <h2 className="mt-3 max-w-2xl font-serif text-4xl font-bold text-ink-900 sm:text-5xl">
              Everything within the building
            </h2>
          </ScrollReveal>

          <div className="mt-10 grid items-start gap-10 lg:grid-cols-[minmax(0,20rem)_1fr]">
            {/* Portrait photograph + address */}
            <ScrollReveal>
              <ArchImage
                image={asideImage}
                alt="Inside The Meridian Grand"
                label="The Meridian Grand"
                sizes="(max-width: 1024px) 100vw, 20rem"
                className="aspect-4/5 w-full shadow-lg"
              />

              <p className="mt-6 text-sm leading-relaxed text-ink-700">
                {hotel?.description ??
                  'A 24-hour property on Marine Drive, with a rooftop lounge, spa, pool and a restaurant looking out over the harbour.'}
              </p>

              {hotel && (
                <div className="mt-6 space-y-1 border-t border-sky-300 pt-5 text-sm text-ink-600">
                  <p className="flex items-start gap-2 font-medium text-ink-800">
                    <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {hotel.address}
                  </p>
                  <p className="pl-6">
                    {hotel.city} · {hotel.contactNumber}
                  </p>
                </div>
              )}
            </ScrollReveal>

            {/* Facilities grid */}
            <div className="grid gap-4 sm:grid-cols-2">
              {FACILITIES.map((facility, index) => (
                <ScrollReveal key={facility.name} delay={index * 60} className="h-full">
                  <div className="flex h-full gap-4 rounded-2xl bg-cream-100 p-5 transition-shadow hover:shadow-md">
                    <div className="grid size-11 shrink-0 place-items-center rounded-full bg-ink-900">
                      <facility.icon className="size-5 text-sky-300" aria-hidden />
                    </div>
                    <div>
                      <p className="font-medium text-ink-900">{facility.name}</p>
                      <p className="mt-0.5 text-sm text-ink-600">{facility.detail}</p>
                    </div>
                  </div>
                </ScrollReveal>
              ))}

              {/* Feature panel, filling the column and flagging the lounge */}
              <ScrollReveal delay={360} className="sm:col-span-2">
                <div className="relative overflow-hidden rounded-2xl bg-ink-900 p-7">
                  <Blob className="-top-12 -right-10 size-44 bg-sky-400/20" />
                  <div className="relative flex flex-wrap items-end justify-between gap-5">
                    <div>
                      <p className="text-xs tracking-[0.2em] text-sky-300 uppercase">
                        Eighteenth floor
                      </p>
                      <p className="numerals mt-2 font-serif text-3xl font-bold text-cream-100">
                        Skyline 18
                      </p>
                      <p className="mt-2 max-w-sm text-sm text-ink-300">
                        Our rooftop lounge, open 5:00 PM to midnight. Guests aged 21 and over
                        after 8:00 PM.
                      </p>
                    </div>
                    <Link
                      href="/rooms"
                      className="group inline-flex items-center gap-2.5 rounded-full bg-sky-300 py-1.5 pr-1.5 pl-5 text-sm font-medium text-ink-900 transition-colors hover:bg-sky-200"
                    >
                      Stay with us
                      <span className="grid size-8 place-items-center rounded-full bg-ink-900 text-sky-300 transition-transform group-hover:translate-x-0.5">
                        <ArrowRight className="size-3.5" aria-hidden />
                      </span>
                    </Link>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </div>
      </section>

      <div className="rotate-180 text-sky-200">
        <Wave variant="calm" />
      </div>

      {/* ------------------------------------------------------- Gallery */}
      {galleryImages.length >= 3 && (
        <section className="px-4 py-12 sm:px-6 lg:py-16">
          <div className="mx-auto max-w-7xl">
            <ScrollReveal>
              <h2 className="font-serif text-3xl font-bold text-ink-900 sm:text-4xl">
                A closer look
              </h2>
            </ScrollReveal>
            <div className="mt-8 grid auto-rows-[11rem] grid-cols-2 gap-4 sm:auto-rows-[13rem] lg:grid-cols-4">
              {galleryImages.slice(0, 6).map((image, index) => (
                <ScrollReveal
                  key={image.id}
                  delay={index * 60}
                  className={
                    index === 0 ? 'col-span-2 row-span-2' : index === 3 ? 'col-span-2' : ''
                  }
                >
                  <div className="relative h-full overflow-hidden rounded-2xl bg-ink-900">
                    <SmartImage
                      image={image}
                      alt={image.alt || 'The Meridian Grand'}
                      sizes="(max-width: 1024px) 50vw, 25vw"
                      className="transition-transform duration-700 hover:scale-105"
                    />
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------ Policies */}
      <section className="px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-3">
            <ScrollReveal>
              <p className="text-xs tracking-[0.22em] text-ink-400 uppercase">Before you book</p>
              <h2 className="mt-3 font-serif text-4xl font-bold text-ink-900">Good to know</h2>
              <p className="mt-3 text-ink-500">
                The essentials. Reception is happy to help with anything else on{' '}
                <span className="whitespace-nowrap text-ink-800">+91 22 4567 8900</span>.
              </p>
            </ScrollReveal>

            <div className="grid gap-5 sm:grid-cols-2 lg:col-span-2">
              {POLICIES.map((policy, index) => (
                <ScrollReveal key={policy.title} delay={index * 70}>
                  <div className="h-full rounded-2xl bg-white p-6 shadow-sm ring-1 ring-cream-300">
                    <p className="font-serif text-lg font-semibold text-ink-900">
                      {policy.title}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-ink-500">{policy.body}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- CTA */}
      <section className="px-4 pb-16 sm:px-6">
        <ScrollReveal>
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-ink-900 px-6 py-16 text-center sm:px-12">
            <Blob className="-top-20 -left-16 size-72 bg-sky-400/20" />
            <Blob className="-right-16 -bottom-24 size-80 bg-sky-300/15" variant="blob-alt" />
            <div className="relative">
              <h2 className="font-serif text-3xl font-bold text-cream-100 sm:text-4xl">
                Your room is waiting
              </h2>
              <p className="mx-auto mt-3 max-w-md text-ink-300">
                Free cancellation up to 24 hours before you arrive.
              </p>
              <Link
                href="/rooms"
                className="group mt-8 inline-flex items-center gap-3 rounded-full bg-sky-300 py-2 pr-2 pl-6 font-medium text-ink-900 transition-colors hover:bg-sky-200"
              >
                Check availability
                <span className="grid size-9 place-items-center rounded-full bg-ink-900 text-sky-300 transition-transform group-hover:translate-x-0.5">
                  <ArrowRight className="size-4" aria-hidden />
                </span>
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* -------------------------------------------------------- Footer */}
      <footer className="border-t border-cream-300 px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 sm:flex-row">
          <div>
            <p className="font-serif text-lg font-semibold text-ink-900">The Meridian Grand</p>
            <p className="mt-1 text-sm text-ink-500">
              18 Marine View Road, Nariman Point, Mumbai 400021
            </p>
          </div>
          <div className="text-sm text-ink-500">
            <p>+91 22 4567 8900</p>
            <p className="mt-1">reservations@meridiangrand.example</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
