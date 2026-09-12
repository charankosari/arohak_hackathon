# Meridian Grand RAG Agent

A retrieval-augmented hotel chatbot for **The Meridian Grand Mumbai**, grounded
in `AROHAK_Hotel_Information_For_RAG.pdf` and wired into the Express booking API
for live room availability.

**No language model is used anywhere.** Retrieval and answer composition are
plain Python. That means no API key, no model download, no per-message cost, no
network dependency for document answers — and every sentence the bot says is
either copied from the PDF or computed from fields parsed out of it, so it
cannot invent a policy, price or timing.

---

## Quick start

```bash
cd agent
python -m venv .venv
.venv/Scripts/activate          # Windows;  source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
cp .env.example .env            # Windows:  copy .env.example .env

python -m scripts.ingest        # optional: build data/index.json and inspect the parse
python -m uvicorn app.main:app --port 8001 --reload
```

Then from the repo root, with the Express API running on `:4000`:

```bash
curl -X POST http://localhost:4000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"what happens if I check out at 4pm?"}'
```

Run the tests with `python -m pytest -q` from this directory.

---

## How it answers

A classic RAG pipeline is *retrieve → generate*. Here the generate step is a
ladder of composers, tried most-precise first, each of which can decline:

| # | Composer | Handles |
|---|----------|---------|
| 1 | greeting | "hi", "thanks" |
| 2 | room facts | price, capacity, "which room for 4 guests", category listings — read off the parsed room table |
| 3 | facility facts | "is there a gym", "when does the pool open" — read off the parsed facility list |
| 4 | **live availability** | "any rooms from 20 to 22 October for 2 guests" — calls the Express API |
| 5 | FAQ (strong match) | the document's own 14 authored Q&A pairs, served verbatim |
| 6 | retrieved passages | BM25 over 96 chunks, quoted verbatim with citations |
| 7 | refusal | says the document does not cover it |

Whatever answers, the response carries `sources` — a citation like
`Section 2 - Hotel Policies > Check-out Policy` — so any claim is traceable back
to the PDF, as PDF section 12 asks.

### Ingestion (`app/ingest.py`)

The PDF is parsed into typed records rather than a wall of text: 5 room
categories, 6 facilities, 14 FAQ pairs, 10 overview fields, and 96
bullet-level chunks. Bullet-level granularity is what makes answers precise —
"Early check-in before 10:00 AM may incur a charge of INR 1,500" is its own
retrievable unit, so an early-check-in question returns that line and not all of
section 2.

Two parsing rules earn their keep:

- **A bulleted line is never a heading.** Section 5's amenities ("Daily
  housekeeping", "In-room safe") are short, capitalised and unpunctuated —
  indistinguishable from a subsection heading except for the bullet marker.
  Without this rule all 15 amenities are silently dropped.
- **Wrapped lines are detected by sentence shape, not indentation.** pypdf's
  leading whitespace for wrapped lines varies between versions; "previous line
  has no terminal punctuation and this one starts lowercase" does not.

### Retrieval (`app/retrieval.py`)

BM25 (k1=1.5, b=0.75) with three layers on top:

- **A hotel vocabulary.** Guests ask "is there a gym?" while the document says
  "Fitness Centre"; they ask "is parking free?" where it says "complimentary".
  `ALIASES` bridges that at query time.
- **Light stemming**, so "bathrobes" finds "Bathrobe and slippers", and time
  splitting, so "4pm" matches "2:00 PM"'s tokens.
- **Phrase bonus**, because a contiguous phrase appearing verbatim is stronger
  evidence than the same words scattered across a chunk.

### Knowing when to shut up

The hardest requirement in PDF section 12 is refusing gracefully. BM25 always
returns *something*: "can I get a helicopter transfer" scores as high as a good
question, because "transfer" matches strongly while "helicopter" — the word that
decides the answer — contributes nothing.

So the gate is not the score. It is `Retriever.unknown_ratio()`: the share of the
question's content words that the document has never heard of, counting a word
as known if it appears in the corpus *or* if one of its aliases does. At or
above 0.5, the bot refuses. Measured on the eval set in `tests/test_agent.py`,
that threshold refuses every out-of-scope probe (pets, smoking, casino, kids
club, Wi-Fi password, luggage storage) while still answering every documented
question.

### Policy blocks

Asked "what happens if I check out at 4pm?", quoting the single best-matching
line — "Standard check-out time is 12:00 PM" — would be grounded but
*misleading*, because the 50% late charge lives in a neighbouring bullet. When
most of the top hits come from one subsection, the whole subsection is returned.

---

## Live data

PDF section 12: *"Booking availability and actual booking actions should come
from the application's live backend data, not from this PDF."*

Availability questions are routed to `GET /api/rooms/availability` on the Express
API, with dates and party size parsed out of the sentence ("from 20 to 22
October for 2 guests", "tomorrow night", "next friday for 3 nights"). The reply
quotes real inventory and real totals, and is tagged `origin: "live+document"`.

The agent is **read-only** — it never books, cancels or modifies. Those carry
auth and money and belong in an explicit user action.

If the backend is unreachable the agent falls back to the document's room table
and says so, rather than failing the conversation.

> Note the services call each other: Express → agent → Express. `AGENT_TIMEOUT_MS`
> on the backend must stay comfortably above `BACKEND_TIMEOUT_SECONDS` here, or a
> slow availability lookup surfaces as a chat timeout.

---

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/chat` | `{message, history?, today?}` → answer, origin, confidence, sources, suggestions |
| `POST` | `/search` | raw retrieval hits — what the bot saw, for tuning and demos |
| `GET`  | `/health` | knowledge base stats and live-backend reachability |
| `GET`  | `/knowledge` | everything parsed out of the PDF |

Reached through the Express API as `POST /api/chat`, `GET /api/chat/health`, and
`POST /api/chat/search` (staff only — it exposes the knowledge base a chunk at a
time).

## Configuration

See `.env.example`. `BACKEND_URL` blank disables live lookups and answers purely
from the document; `MIN_SCORE` raises or lowers how tight-lipped the bot is.

## Layout

```
app/ingest.py      PDF -> typed records + citable chunks
app/retrieval.py   BM25, hotel vocabulary, the out-of-scope gate
app/answering.py   the composer ladder
app/dates.py       "20 to 22 September", "tomorrow", "next friday for 3 nights"
app/live.py        read-only client for the Express API
app/main.py        FastAPI
scripts/ingest.py  build and inspect data/index.json
tests/test_agent.py  78 tests, doubling as the eval set
```
