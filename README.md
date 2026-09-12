# The Meridian Grand — Hotel Booking & Management

A full-stack hotel booking and management system built for the AROHAK hackathon.
Role-based access for **administrators**, **receptionists** and **guests**, with the
hotel's real operating rules — including the 24-hour cancellation policy — enforced
in the backend rather than just described in the UI.

Business rules and the seeded property data come from
[`AROHAK_Hotel_Information_For_RAG.pdf`](AROHAK_Hotel_Information_For_RAG.pdf), so the
database and the (upcoming) RAG chatbot describe the same hotel.

---

## Stack

| Layer     | Technology                                                       |
| --------- | ---------------------------------------------------------------- |
| Frontend  | Next.js 16 (App Router), React 19, Tailwind CSS 4, JavaScript     |
| Backend   | Node.js, Express 5, Prisma 6, JavaScript (ESM)                    |
| Database  | PostgreSQL (Railway)                                              |
| Cache     | Redis (Railway) — caching + distributed rate limiting             |
| Auth      | JWT (`jsonwebtoken`) + bcrypt, role-based guards                  |
| Images    | Cloudinary — admin-uploaded hotel and room photography            |
| Chatbot   | Python 3.10+, FastAPI, pypdf — retrieval-augmented, no LLM        |

---

## Quick start

Two terminals. The database and Redis are already provisioned on Railway and
configured in `backend/.env`.

```bash
# Terminal 1 — API on http://localhost:4000
cd backend
npm install
npx prisma generate
npx prisma migrate deploy     # first time only
npm run db:seed               # first time only
npm run dev

# Terminal 2 — web app on http://localhost:3000
cd frontend
npm install
npm run dev
```

Open <http://localhost:3000>.

### Demo accounts

Seeded by `npm run db:seed`. The login page lists these and fills them in on click.

| Role          | Email                            | Password        |
| ------------- | -------------------------------- | --------------- |
| Administrator | `admin@meridiangrand.example`    | `Admin@123`     |
| Receptionist  | `reception@meridiangrand.example`| `Reception@123` |
| Guest         | `guest@example.com`              | `Guest@123`     |
| Guest         | `sneha@example.com`              | `Guest@123`     |

---

## What each role can do

Enforced by route guards in the API (`requireRoles`), and mirrored in the UI so
people are never shown a control they cannot use.

|                                        | Admin | Receptionist | Guest        |
| -------------------------------------- | :---: | :----------: | :----------: |
| Browse rooms, check availability        |  yes  |     yes      | yes (public) |
| Book a room                             |  yes  | yes, for a guest | yes, own |
| View bookings                           |  all  |     all      | own only     |
| Cancel a booking                        |  any  |     any      | per policy   |
| Change booking dates                    |  yes  |     yes      | own only     |
| Check in / check out / no-show          |  yes  |     yes      | no           |
| Review cancellation requests            |  yes  |     yes      | no           |
| Change room **status** and description  |  yes  |     yes      | no           |
| Change room **rate, type, capacity**    |  yes  |    **no**    | no           |
| Create / delete rooms                   |  yes  |    **no**    | no           |
| Create / edit / delete hotels           |  yes  |    **no**    | no           |
| Manage user accounts and roles          |  yes  |    **no**    | no           |

A receptionist runs the floor but is not an administrator: they can move a room to
`MAINTENANCE` and handle every booking, but cannot touch commercial terms, inventory,
or accounts. `POST /api/auth/register` has no `role` field at all, so a self-signup can
only ever create a `CUSTOMER` — staff accounts are created by an admin.

---

## The cancellation policy (PDF section 3)

This is the most interesting rule in the system, and it is implemented as a real
policy engine in [`backend/src/services/cancellationPolicy.js`](backend/src/services/cancellationPolicy.js)
rather than scattered through controllers.

- A guest may cancel **directly** until **24 hours before check-in**.
  Check-in opens at 2:00 PM hotel time (IST), so for a stay beginning
  20 September the deadline is **19 September, 2:00 PM** — matching the worked
  example in the PDF exactly.
- After that deadline the guest's cancellation becomes a **request**: the API
  returns `202` with `outcome: "REVIEW_REQUESTED"`, and **the booking stays
  `CONFIRMED`** until staff decide.
- Staff **approve** → booking becomes `CANCELLED`. Staff **reject** → booking
  stays active. Both sides are written in one transaction.
- A cancelled booking **cannot be cancelled again**, and a reviewed request
  cannot be re-reviewed.
- Staff may cancel at any time, bypassing the guest deadline.

`GET /api/bookings/:id/cancellation-policy` returns the decision without acting on
it, so the UI can warn the guest before they commit — the cancel dialog shows either
"free cancellation until …" or "staff review required".

**Which path you get is the most common point of confusion**, so the UI says so
explicitly: cancel early and the confirmation reads "cancelled immediately … no staff
review is needed, so there is nothing to track under Cancellations"; cancel late and it
reads "sent to hotel staff for review … the booking stays confirmed until they decide".
An empty Cancellations queue likewise explains that a request only ever appears for a
late cancellation.

To make the review path demoable at any hour, the seed includes a reservation
**arriving today** (Sneha Iyer, room 902). Its deadline was 2:00 PM yesterday, so
cancelling it always produces a staff request — whereas the 26 September booking is far
enough out that cancelling it is always immediate.

---

## Other rules worth knowing

- **No double-booking.** Overlap is `checkIn < otherCheckOut AND checkOut > otherCheckIn`,
  so same-day turnover is allowed but any real overlap is rejected. The conflict check and
  the insert run inside a **`Serializable`** transaction, so two simultaneous requests
  cannot both win.
- **Capacity is enforced**, per the PDF's room table — four guests cannot book a
  Deluxe King (max 2); the Family Suite (max 4) is the one that fits.
- **Rates are snapshotted** onto the booking, so changing a room's price later never
  rewrites historical reservations.
- **Nothing with booking history is ever deleted.** Rooms and hotels with reservations
  attached are refused with a `409` explaining to deactivate instead; users are
  deactivated, never deleted. Booking history stays auditable.
- **Rooms under `MAINTENANCE` / `OUT_OF_SERVICE` disappear from guest availability**
  but stay visible to staff.
- **A booked room is never offered as bookable.** `/rooms` is always an availability
  search (dates default to tomorrow for two nights when none are given), so a room
  already taken for those dates is simply not listed. If a guest reaches a room page
  directly, or changes the dates once there, the page re-checks availability live and
  disables booking with the clashing dates named and the next free date offered —
  rather than letting them fill the form and fail on submit.

---

## Project layout

Layered MVC — controllers, models, routes and services each grouped together.

```
backend/
├── prisma/
│   ├── schema.prisma          # User, Hotel, Room, Booking, CancellationRequest
│   └── seed.js                # hotel, 15 rooms, demo accounts and bookings
├── scripts/
│   ├── smoke-test.js          # 85 end-to-end API assertions
│   └── clean-fixtures.js      # removes data left by the smoke test
└── src/
    ├── config/env.js          # env parsing + hotel operating rules
    ├── lib/                   # prisma, redis, cache
    ├── models/                # data access, one module per entity
    ├── services/              # business rules (availability, cancellation policy)
    ├── controllers/           # thin HTTP handlers
    ├── routes/                # routing + role guards
    ├── middlewares/           # auth, validation, rate limiting, errors
    ├── validators/            # Zod schemas
    ├── utils/                 # dates, money, JWT, passwords, serialisers
    ├── app.js
    └── server.js

agent/                         # RAG chatbot (Python, no LLM)
├── app/
│   ├── ingest.py              # PDF -> typed records + citable chunks
│   ├── retrieval.py           # BM25, hotel vocabulary, out-of-scope gate
│   ├── answering.py           # the composer ladder
│   ├── dates.py               # "20 to 22 September", "next friday for 3 nights"
│   ├── live.py                # read-only client for this API
│   └── main.py                # FastAPI
├── scripts/ingest.py          # build and inspect data/index.json
└── tests/test_agent.py        # 81 tests, doubling as the eval set

frontend/
├── app/
│   ├── page.js                # landing + availability search
│   ├── login/, register/
│   ├── rooms/                 # browse, and [id] detail + booking
│   └── dashboard/             # role-gated: overview, bookings, front desk,
│                              #   rooms, cancellations, hotels, users
├── components/                # AuthProvider, Navbar, Sidebar, UI kit
│   ├── ChatWidget.js          # the floating concierge, talks to /api/chat
│   └── ConciergeCharacter.js  # animated SVG character (CSS-driven)
└── lib/                       # api client, formatting, constants
```

---

## API

Base URL `http://localhost:4000`. All authenticated routes take
`Authorization: Bearer <token>`.

| Method | Route | Access |
| ------ | ----- | ------ |
| `POST` | `/api/auth/register` | public (always creates a `CUSTOMER`) |
| `POST` | `/api/auth/login` | public |
| `GET` `PATCH` | `/api/auth/me` | authenticated |
| `POST` | `/api/auth/change-password` | authenticated |
| `GET` | `/api/hotels`, `/api/hotels/:id` | public (guests see `ACTIVE` only) |
| `POST` `PATCH` `DELETE` | `/api/hotels…` | admin |
| `GET` | `/api/rooms`, `/api/rooms/:id`, `/api/rooms/types` | public |
| `GET` | `/api/rooms/availability` | public |
| `GET` | `/api/rooms/:id/availability` | public — is one room free for a stay |
| `GET` | `/api/rooms/:id/calendar` | staff |
| `POST` `DELETE` | `/api/rooms…` | admin |
| `PATCH` | `/api/rooms/:id` | staff (receptionist limited to status + description) |
| `GET` `POST` | `/api/bookings` | authenticated (guests scoped to own) |
| `GET` | `/api/bookings/front-desk` | staff |
| `GET` | `/api/bookings/:id/cancellation-policy` | owner or staff |
| `POST` | `/api/bookings/:id/cancel` | owner or staff |
| `PATCH` | `/api/bookings/:id` | owner or staff (date change) |
| `PATCH` | `/api/bookings/:id/status` | staff |
| `GET` | `/api/cancellation-requests` | staff see all, guests see own |
| `POST` | `/api/cancellation-requests/:id/review` | staff |
| `GET` `POST` `PATCH` `DELETE` | `/api/users…` | admin |
| `POST` | `/api/chat` | public — ask the hotel assistant |
| `GET` | `/api/chat/health` | public — is the agent reachable |
| `POST` | `/api/chat/search` | staff — raw retrieval hits, for debugging |
| `GET` | `/health` | public — reports database and cache status |

---

## Redis, caching and rate limiting

Redis is treated as an **accelerator, never a dependency**. If `REDIS_URL` is unset or
Redis goes down, caching becomes a no-op and rate limiting falls back to an in-process
store — the API keeps serving. `/health` reports `cache: "disabled"` rather than failing.

Cached with short TTLs and invalidated on every relevant write: hotel lists (5 min),
room lists (2 min), availability (30 s), room types (10 min).

Rate limits, shared across instances via Redis when available. The limiters are
constructed when the route tree is imported, which happens before Redis has
connected, so the store is resolved on every call rather than once at
construction — otherwise they would silently stay in-memory forever:

| Scope | Limit |
| ----- | ----- |
| All API traffic | 300 / minute per IP |
| Login, register, password change | 10 / 15 min per IP **and** per email |
| Booking writes | 20 / minute per user |
| Availability search | 120 / minute per user |

Responses carry draft-7 `RateLimit` headers, and a `429` explains when to retry.

---

## Testing

```bash
cd backend
node src/server.js            # in one terminal
node scripts/smoke-test.js    # in another
```

85 assertions covering the permission matrix, the booking engine and every branch of
the cancellation policy — including that a receptionist is refused admin-level actions,
that one guest cannot read another's booking, that overlapping bookings are rejected
while same-day turnover is allowed, that a booked room reports itself unavailable with
the next free date, and that a `PATCH` of one field never clobbers the others.

The suite is idempotent: fixtures are namespaced per run and cleaned up afterwards.
Anything it could not delete (rooms that picked up booking history) is parked
`OUT_OF_SERVICE` so it never leaks into guest availability. To tidy up afterwards:

```bash
node scripts/clean-fixtures.js          # preview
node scripts/clean-fixtures.js --apply  # remove
npm run db:seed -- --reset-bookings     # restore a clean demo state
```

The UI was additionally driven end-to-end in a real browser across all three roles,
at desktop and mobile widths, with console errors treated as failures.

---

## Configuration

`backend/.env` (see `.env.example`):

| Variable | Purpose |
| -------- | ------- |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Optional. Unset → no cache, in-memory rate limits |
| `JWT_SECRET` | Signing secret — **change for anything deployed** |
| `JWT_EXPIRES_IN` | Token lifetime, default `12h` |
| `PORT` | API port, default `4000` |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `CLOUDINARY_CLOUD_NAME` | Optional. Unset → upload disabled, placeholders shown |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |

`frontend/.env.local`:

| Variable | Purpose |
| -------- | ------- |
| `NEXT_PUBLIC_API_URL` | API base URL, default `http://localhost:4000` |

### Running Postgres and Redis locally instead

`docker-compose.yml` at the repo root starts both on non-default ports (5433 / 6380)
so they never collide with an existing local install:

```bash
docker compose up -d
# then point backend/.env at:
#   DATABASE_URL="postgresql://meridian:meridian_dev_pw@localhost:5433/meridian?schema=public"
#   REDIS_URL="redis://localhost:6380"
```

---

## Photography

Hotel and room photographs are uploaded by an **administrator** and hosted on
Cloudinary. Open a hotel or room in the admin panel and use the **Photographs**
panel: drag files in (JPEG/PNG/WebP/AVIF, up to 8 MB each, 8 at a time), set any
image as the cover, or delete one. The cover is what appears on cards, search
results and the landing page.

Files stream straight from the browser through the API to Cloudinary — nothing is
written to the API's disk — and the Cloudinary secret never leaves the server. The
stored `public_id` is what lets a delete remove the remote asset too.

Photography is optional everywhere: with no images, every slot falls back to a
designed placeholder rather than a broken frame, so the site never looks unfinished.

To populate a demo quickly:

```bash
cd backend
node scripts/seed-images.js            # preview
node scripts/seed-images.js --apply    # upload starter photos to your Cloudinary
node scripts/seed-images.js --reset --apply   # replace what is already there
```

---

## Design

The interface follows a five-colour palette:

| Token | Hex | Role |
| ----- | --- | ---- |
| `cream` | `#FDF8F5` | page ground |
| `sky` | `#B4CDF0` | organic shapes, secondary surfaces |
| `ink` | `#132033` | type and dark surfaces |
| `honey` (`brass`) | `#DCA42E` | marker highlights, sparingly |
| `blush` | `#F3B5A8` | small decorative marks |

Sections meet along wave edges rather than hard rules, photography is arch-cropped
(echoing a colonnade), and buttons are pills with a circular arrow. Scrolling uses
Lenis for momentum on the marketing pages — deliberately **not** on the dashboard,
where hijacking the wheel inside a data table is irritating. Content reveals on
scroll via `IntersectionObserver`, unobserved after the first reveal.

All of it respects `prefers-reduced-motion`: Lenis does not initialise, reveals are
immediate, and animations collapse to near-zero duration.

One typographic gotcha worth knowing: the serif (Cormorant Garamond) ships
**old-style figures**, where `1` renders as a small-cap `I`. Any serif number uses
the `numerals` utility to force lining figures.

---

## Known limitations

- **The JWT is stored in `localStorage`**, which is convenient for a hackathon but
  readable by any XSS on the page. An httpOnly, SameSite cookie would be the
  production choice.
- **No payment handling.** Bookings record an amount but nothing is charged, and the
  early check-in and late check-out fees in the PDF are documented rather than billed.
- **Dates are hotel-local (IST, fixed +05:30).** Correct for Mumbai — India observes no
  daylight saving — but a multi-timezone estate would need per-hotel timezones.
- **Single property.** The schema is multi-hotel throughout, but the seed and the guest
  UI assume one.

---

## The RAG chatbot

`agent/` is a Python service that answers guest questions from
`AROHAK_Hotel_Information_For_RAG.pdf`, reached through this API at `POST /api/chat`.
Full detail in [agent/README.md](agent/README.md).

**No language model is involved.** Retrieval is BM25 over the parsed PDF and the
answers are composed from it in plain Python, so there is no API key, no model
download and no per-message cost — and nothing the bot says can be invented: every
sentence is either copied from the document or computed from fields parsed out of it,
and each reply carries a citation such as `Section 2 - Hotel Policies > Check-out
Policy`.

Per the PDF's own section 12, availability comes from this API rather than the
document: an availability question is parsed for dates and party size and routed to
`GET /api/rooms/availability`, so the guest gets real inventory and real totals. The
agent is read-only — it never books, cancels or modifies.

```bash
# Terminal 3 — agent on http://localhost:8001
cd agent
python -m venv .venv
.venv/Scripts/activate         # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m uvicorn app.main:app --port 8001 --reload
```

```bash
curl -X POST http://localhost:4000/api/chat   -H "Content-Type: application/json"   -d '{"message":"what happens if I check out at 4pm?"}'
```

The backend does not require the agent: with `AGENT_URL` unset or the service down,
`/api/chat` reports 503 and everything else runs normally.

### In the app

A floating concierge — **Aarav** — sits bottom-right on every page except sign-in and
registration. He is an inline SVG drawn in the brand palette and animated entirely in
CSS: he breathes and blinks at rest, waves occasionally, glances up with three pulsing
dots while the agent is working, and nods while an answer lands. No animation library,
no timers, nothing re-renders to drive it, and the `prefers-reduced-motion` rule already
in `globals.css` stops all of it — his resting pose is his correct static appearance, so
freezing the animation leaves him composed rather than mid-blink.

Every answer shows its provenance: a green **Live availability** badge when the numbers
came from the database, a **From the hotel document** badge when they came from the PDF,
and a tap-to-expand list of the exact sections behind the claim. The agent is built never
to invent an answer; the badges and citations are what make that legible to a guest.
