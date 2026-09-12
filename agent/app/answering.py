"""Compose a grounded answer from retrieved knowledge -- no language model.

The generation step of a classic RAG pipeline is replaced by a ladder of
composers, tried most-precise first:

    greeting -> live availability -> FAQ (strong) -> room facts ->
    facility facts -> FAQ (moderate) -> retrieved passages -> refusal

Everything returned is either copied from the PDF or computed from fields
parsed out of it, so the bot cannot invent a policy, price or timing -- which
is exactly what PDF section 12 asks for. When nothing clears the retrieval
threshold it says the document does not cover the question instead of guessing.
"""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field
from datetime import date

from . import config
from .dates import parse_guests, parse_stay
from .conversation import normalize
from .ingest import Facility, KnowledgeBase, Room
from .live import LiveBackend
from .retrieval import Retriever, tokenize

# FAQ question overlap above which the authored answer is served verbatim.
FAQ_STRONG = 0.72
FAQ_MODERATE = 0.5

# Refuse once this share of the question's content words are foreign to the
# document. Measured, not guessed: at 0.5 every out-of-scope probe in
# tests/test_agent.py refuses and every documented question still answers.
UNKNOWN_LIMIT = 0.5

# Openers that mark a message as continuing the previous turn rather than
# starting a new subject: "and the spa?", "what about 4 guests".
CONTINUATION = re.compile(
    r"^(and|or|also|but|then|what about|how about|what if|ok|okay)\b", re.IGNORECASE
)

# Guest-facing copy never mentions the document the answers are drawn from --
# a guest is talking to a concierge, not querying a knowledge base. The
# grounding is unchanged; only the wording is.
REFUSAL = (
    "I could not find an answer to that one. Would you like to speak with our "
    "reception? They are available 24 hours on +91 22 4567 8900, or at "
    "reservations@meridiangrand.example."
)


@dataclass
class Source:
    citation: str
    text: str


@dataclass
class Answer:
    text: str
    sources: list[Source] = field(default_factory=list)
    confidence: float = 0.0
    # document | live | live+document | none -- lets the UI badge the answer.
    origin: str = "document"
    suggestions: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "answer": self.text,
            "origin": self.origin,
            "confidence": round(self.confidence, 3),
            "sources": [{"citation": s.citation, "text": s.text} for s in self.sources],
            "suggestions": self.suggestions,
        }


def _money(amount: float, currency: str = "INR") -> str:
    return f"{currency} {amount:,.0f}"


def _room_lines(rooms: list[Room], features: bool = True) -> str:
    return "\n".join(
        f"- {r.room_type}: sleeps {r.capacity}, "
        f"{_money(r.price_per_night, r.currency)} per night"
        + (f" - {r.features}" if features else "")
        for r in rooms
    )


def _overlap(question: str, target: str) -> float:
    """Share of the target's terms the question covers.

    Anchored on the target so a long, chatty question is not penalised, and
    lightly weighted by coverage of the question so a one-word query does not
    trivially "cover" a short FAQ.
    """
    q, t = set(tokenize(question)), set(tokenize(target))
    if not q or not t:
        return 0.0
    shared = len(q & t)
    return 0.7 * (shared / len(t)) + 0.3 * (shared / len(q))


class Answerer:
    def __init__(self, kb: KnowledgeBase, backend: LiveBackend | None = None) -> None:
        self.kb = kb
        self.retriever = Retriever(kb.chunks)
        self.backend = backend or LiveBackend()

    # -- entry point -------------------------------------------------------

    async def answer(
        self, question: str, today: date | None = None, context: str | None = None
    ) -> Answer:
        question = normalize(question or "")
        if not question:
            return Answer(
                text="Ask me anything about The Meridian Grand Mumbai - policies, "
                "rooms, facilities or availability.",
                origin="none",
                suggestions=_DEFAULT_SUGGESTIONS,
            )

        question = self._resolve_followup(question, normalize(context or ""), today)
        result = await self._respond(question, today)

        # Only if the message cannot stand on its own is the previous turn worth
        # borrowing. Blending it in unconditionally makes "and the spa?" inherit
        # the earlier subject and answer about the pool.
        if result is None and context and self._should_borrow(question):
            result = await self._respond(f"{context} {question}", today)

        return result or Answer(
            text=REFUSAL, origin="none", confidence=0.0,
            suggestions=_DEFAULT_SUGGESTIONS,
        )

    def _resolve_followup(self, question: str, context: str, today: date | None) -> str:
        """Inherit only the missing fields of a clearly scoped follow-up."""
        if not context:
            return question
        previous_stay = parse_stay(context, today)
        previous_room = self._match_room(context)
        # A standalone date or party-size answer continues a room search.
        fragment = re.sub(r"^(?:and|what about|how about|for|okay|ok)\s+", "", question).strip(" ?.")
        party_only = bool(re.fullmatch(r"(?:for )?(?:\d+|one|two|three|four|five|six) (?:guests?|people|adults?)", fragment))
        date_words = set(re.findall(r"[a-z]+", question))
        allowed_date_words = set("and what about how for from to until till through on in of the this next coming tomorrow today tonight weekend night nights guests people adults one two three four five six january february march april may june july august september october november december jan feb mar apr jun jul aug sep sept oct nov dec monday tuesday wednesday thursday friday saturday sunday st nd rd th".split())
        dates_only = date_words <= allowed_date_words and bool(parse_stay(question, today)) and not re.search(
            r"\b(?:cancel|refund|breakfast|spa|pool|parking|airport|check-in|check-out|pets|charge|price)\b", question
        ) and len(question.split()) <= 10
        search_context = bool(re.search(r"\b(?:rooms?|suites?|book|reserve|availability)\b", context))
        if search_context and (dates_only or (party_only and previous_stay)):
            parts = ["available rooms", question]
            if not parse_stay(question, today) and previous_stay:
                parts.append(f"from {previous_stay.check_in} to {previous_stay.check_out}")
            if not parse_guests(question) and (guests := parse_guests(context)):
                parts.append(f"for {guests} guests")
            if previous_room and not self._match_room(question):
                parts.append(previous_room.room_type)
            return " ".join(parts)
        if previous_room and re.fullmatch(r"(?:and |what about )?(?:how much(?: is it)?|(?:the )?(?:price|cost|rate)\??)", question.strip(" ?.")):
            return f"price of {previous_room.room_type}"
        return question

    async def _live_prices(self, question: str, today: date | None) -> Answer | None:
        if not re.search(r"\b(?:price|prices|cost|costs|rates?|cheapest|affordable|budget)\b|how much", question):
            return None
        if parse_stay(question, today) or re.search(r"\b(?:breakfast|bed|transfer|spa|cancel|refund|parking|charge)\b", question):
            return None
        matches = self._match_rooms(question)
        if not matches and not re.search(r"\brooms?\b|\bsuites?\b", question):
            return None
        payload = await self.backend.room_types()
        rows = payload.get("types", []) if isinstance(payload, dict) else []
        if not rows:
            fallback = self._room_facts(question)
            if fallback:
                fallback.text += " These are reference rates; confirm the current price when choosing your dates."
            return fallback
        if matches:
            names = {r.room_type.lower() for r in matches}
            rows = [r for r in rows if r.get("roomType", "").lower() in names]
        if not rows:
            return Answer(text="I could not find a current rate for that category. Please choose another room category or contact reception.", origin="live")
        rows = sorted(rows, key=lambda r: float(r["minPrice"]))
        if re.search(r"\bcheapest\b|\bmost affordable\b", question):
            rows = [r for r in rows if float(r["minPrice"]) == float(rows[0]["minPrice"])]
        lines = []
        for row in rows:
            low, high = float(row["minPrice"]), float(row["maxPrice"])
            rate = _money(low) if low == high else f"{_money(low)}–{_money(high)}"
            lines.append(f"- {row['roomType']}: {rate} per night, up to {row['maxGuests']} guests")
        return Answer(text="Current room rates:\n" + "\n".join(lines) + "\nShare your check-in and check-out dates to check availability and your stay total.",
                      sources=[Source("Live room rates", "Room category price ranges")], origin="live", confidence=0.95,
                      suggestions=["Rooms tomorrow night", "What is included in every room?"])

    def _should_borrow(self, question: str) -> bool:
        """Whether an unanswerable message is a follow-up needing the prior turn.

        This guard matters more than it looks. Without it, "do you allow pets?"
        asked after an availability search falls through to the combined text,
        which still contains dates and a room noun -- and the guest gets the
        previous availability answer to a question about pets. Merging two
        questions dilutes the out-of-scope signal, so the decision has to be
        made on the message alone, before merging.
        """
        # Out of scope on its own terms: context cannot rescue it, and
        # borrowing would answer a question the guest did not ask.
        if self.retriever.unknown_ratio(question) >= UNKNOWN_LIMIT:
            return False
        # A genuine follow-up either opens with a continuation word or is too
        # short to carry a subject.
        return bool(CONTINUATION.match(question.strip())) or len(question.split()) <= 3

    async def _respond(self, question: str, today: date | None) -> Answer | None:
        """One pass down the composer ladder. None means nothing matched."""
        if (result := await self._live_prices(question, today)) is not None:
            return result
        for composer in (
            self._greeting,
            self._arrival_time,
            self._basic_facts,
            self._room_facts,
            self._facility_facts,
        ):
            if (result := composer(question)) is not None:
                return result

        # Live data can answer availability questions the document cannot.
        if (result := await self._live_availability(question, today)) is not None:
            return result

        faq = self._faq(question)
        if faq and faq[1] >= FAQ_STRONG:
            return faq[0]

        # Half or more of the question's content words absent from the document
        # means it is asking about something the document does not cover. Say
        # so rather than returning the loosely-related passages BM25 will
        # always find (PDF section 12).
        if self.retriever.unknown_ratio(question) < UNKNOWN_LIMIT:
            if (result := self._retrieved(question)) is not None:
                return result
            if faq and faq[1] >= FAQ_MODERATE:
                return faq[0]

        return None

    # -- composers ---------------------------------------------------------

    def _greeting(self, question: str) -> Answer | None:
        # Matched whole, not as a prefix: "hi, what time is check-in?" is a
        # question wearing a greeting, and must fall through to be answered.
        lowered = question.lower().strip(" !.?,")
        if re.fullmatch(
            r"(hi|hello|hey|hiya|yo|greetings|good (morning|afternoon|evening))"
            r"([ ,]+there)?",
            lowered,
        ):
            name = self.kb.overview.get("Hotel Name", "The Meridian Grand Mumbai")
            return Answer(
                text=(
                    f"Hello, and welcome to {name}. I can answer questions about "
                    "our policies, rooms, facilities and live room availability."
                ),
                origin="none",
                confidence=1.0,
                suggestions=_DEFAULT_SUGGESTIONS,
            )
        if re.fullmatch(
            r"(thanks|thank you|thankyou|ty|cheers|bye|goodbye)"
            r"( so much| a lot| very much)?",
            lowered,
        ):
            return Answer(
                text="Happy to help. Enjoy your stay at The Meridian Grand Mumbai.",
                origin="none",
                confidence=1.0,
            )
        return None

    async def _live_availability(self, question: str, today: date | None) -> Answer | None:
        """Availability questions go to the live API, never to the PDF."""
        lowered = question.lower()

        # Availability needs a room noun plus either an availability verb or
        # concrete dates. Without that pairing, "is wifi free", "are vegan
        # meals available" and "can I cancel my booking" all read as
        # availability questions; with it, "any rooms from 25 to 27 October"
        # still does even though it names no verb.
        subject = re.search(r"\brooms?\b|\bsuites?\b|\bnights?\b|\baccommodations?\b", lowered)
        verb = re.search(
            r"\bavailab\w+\b|\bvacan\w+\b|\bfree\b|\bopen\b|\bbook\w*\b|\breserv\w+\b|"
            r"\bstay\b|\bget\b|\bwant\b|\blooking for\b|\bsearch\b|\bfind\b",
            lowered,
        )
        # A cancellation or policy question mentioning rooms is not a search.
        excluded = re.search(r"\bcancel\w*\b|\brefund\w*\b|\bpolic\w+\b|\bmodif\w+\b", lowered)
        stay = parse_stay(question, today)

        booking_intent = re.search(r"\b(?:book|reserve|reservation|stay)\b", lowered)
        other_service = re.search(r"\b(?:spa|massage|restaurant|table|taxi|transfer|treatment)\b", lowered)
        if other_service or excluded or not (subject or booking_intent) or not (verb or stay):
            return None

        if stay is None:
            return Answer(
                text=(
                    "I can check live room availability for you - which dates are "
                    "you looking at? For example: \"any rooms from 20 to 22 "
                    "September for 2 guests?\""
                ),
                origin="none",
                confidence=0.5,
                suggestions=["Rooms tomorrow night", "Room for 4 guests this weekend"],
            )

        guests = parse_guests(question) or 1
        room_type = (match.room_type if (match := self._match_room(question)) else None)
        result = await self.backend.search_availability(
            stay.check_in, stay.check_out, guests, room_type
        )

        nights_label = f"{stay.nights} night{'s' if stay.nights != 1 else ''}"
        window = (
            f"{stay.check_in.strftime('%d %b %Y')} to "
            f"{stay.check_out.strftime('%d %b %Y')} ({nights_label}, "
            f"{guests} guest{'s' if guests != 1 else ''})"
        )

        if result is None:
            # Backend down or the stay was rejected: answer from the document
            # and be explicit that this is not a live check.
            options = [r for r in self.kb.rooms if r.capacity >= guests]
            listing = _room_lines(options, features=False) or (
                "- None of our room categories seats that many guests."
            )
            return Answer(
                text=(
                    f"I could not check live availability for {window} just now. "
                    f"These room categories seat {guests} "
                    f"guest{'s' if guests != 1 else ''}:\n{listing}\n"
                    "Please confirm with reception on +91 22 4567 8900."
                ),
                sources=[
                    Source("Section 4 - Room Categories", "Room category table")
                ],
                origin="document",
                confidence=0.4,
            )

        rooms = result.get("rooms", [])
        if not rooms:
            return Answer(
                text=(
                    f"No rooms are available for {window}. Try shifting the dates "
                    "or reducing the party size, and I will check again."
                ),
                origin="live",
                confidence=0.9,
                suggestions=["Rooms next weekend", "What room suits 4 guests?"],
            )

        # One line per category, cheapest first -- a guest wants the choice,
        # not fifteen near-identical door numbers.
        by_type: dict[str, dict] = {}
        for room in rooms:
            existing = by_type.get(room["roomType"])
            if not existing or room["pricePerNight"] < existing["pricePerNight"]:
                by_type[room["roomType"]] = room

        lines = []
        for room in sorted(by_type.values(), key=lambda r: r["pricePerNight"]):
            quote = room.get("quote") or {}
            total = quote.get("totalAmount")
            total_label = f", {_money(total)} total for {nights_label}" if total else ""
            lines.append(
                f"- {room['roomType']}: sleeps {room['maxGuests']}, "
                f"{_money(room['pricePerNight'])} per night{total_label}"
            )

        plural = "s" if len(rooms) != 1 else ""
        return Answer(
            text=(
                f"Yes - {len(rooms)} room{plural} available for {window}, "
                f"across {len(by_type)} categor{'ies' if len(by_type) != 1 else 'y'}:\n"
                + "\n".join(lines)
                + "\n\nCheck-in is 2:00 PM and check-out is 12:00 PM."
            ),
            sources=[Source("Live availability", f"{self.backend.base_url}/api/rooms/availability")],
            origin="live+document",
            confidence=0.95,
            suggestions=["What is the cancellation policy?", "Is breakfast included?"],
        )

    def _basic_facts(self, question: str) -> Answer | None:
        """Common short questions with unambiguous, structured hotel answers."""
        clean = re.sub(r"^(?:hi[, ]+|please |can you tell me |tell me |what is |what's )", "", question).strip(" ?.")
        overview_keys = {
            "address": "Address", "hotel address": "Address", "location": "Address",
            "phone number": "Contact Number", "contact number": "Contact Number",
            "email": "Email", "email address": "Email", "contact email": "Email",
            "reception hours": "Reception", "languages spoken": "Languages Supported at Reception",
        }
        key = overview_keys.get(clean)
        if key and (value := self.kb.overview.get(key)):
            return Answer(text=f"{key}: {value}", sources=[Source("Section 1 - Hotel Overview", f"{key}: {value}")], confidence=1.0)
        aliases = {
            "check-in time": "What time is check-in?",
            "check-out time": "What time is check-out?",
            "free wifi": "Is Wi-Fi free?",
            "wifi included": "Is Wi-Fi free?",
            "parking": "Does the hotel have parking?",
            "free parking": "Does the hotel have parking?",
            "breakfast included": "Is breakfast included?",
            "early check-in": "Can I request early check-in?",
            "extra bed": "Can I add an extra bed?",
            "airport pickup": "Does the hotel provide airport transfers?",
            "cancellation policy": "Can I cancel my booking?",
        }
        target = aliases.get(clean)
        if target:
            faq = next((f for f in self.kb.faqs if f.question == target), None)
            if faq:
                return Answer(text=faq.answer, sources=[Source("Section 11 - Frequently Asked Questions", faq.question)], confidence=1.0)
        facilities = {"gym": "Fitness Centre", "pool": "Swimming Pool", "spa": "Spa", "restaurant": "Restaurant - Harbour Table", "rooftop lounge": "Rooftop Lounge - Skyline 18"}
        facility_name = facilities.get(clean.removesuffix(" timings").removesuffix(" hours"))
        if facility_name:
            facility = next((f for f in self.kb.facilities if f.name == facility_name), None)
            if facility:
                return Answer(text=f"{facility.name}: {facility.detail}", sources=[Source("Section 6 - Hotel Facilities", facility.detail)], confidence=1.0)
        return None

    def _arrival_time(self, question: str) -> Answer | None:
        """Compare an explicit arrival time with the documented check-in time."""
        lowered = question.lower()
        if not re.search(r"\bcheck[ -]?in\b", lowered):
            return None
        # Do not turn checkout, date changes, or an early-arrival exception
        # into a promise that a room will be ready.
        if re.search(r"\bcheck[ -]?out\b|\bcancel|\brefund|\bearly\b", lowered):
            return None
        clock = re.search(r"\b(1[0-2]|[1-9])(?::([0-5]\d))?\s*(am|pm)\b", lowered)
        if not clock:
            return None
        standard = next((f for f in self.kb.faqs if f.question.lower() == "what time is check-in?"), None)
        if not standard:
            return None
        policy_clock = re.search(r"(1[0-2]|[1-9]):([0-5]\d)\s*(AM|PM)", standard.answer)
        if not policy_clock:
            return None

        def minutes(match):
            return (int(match[1]) % 12 + (12 if match[3].lower() == "pm" else 0)) * 60 + int(match[2] or 0)

        arrival = minutes(clock)
        label = f"{int(clock[1])}:{clock[2] or '00'} {clock[3].upper()}"
        sources = [Source("Section 11 - Frequently Asked Questions", standard.answer)]
        if arrival >= minutes(policy_clock):
            return Answer(
                text=f"Yes, {label} is after the standard check-in time. {standard.answer} Please make sure your reservation starts on your arrival date.",
                sources=sources, confidence=0.95,
            )
        early = next((f for f in self.kb.faqs if f.question.lower() == "can i request early check-in?"), None)
        if early:
            sources.append(Source("Section 11 - Frequently Asked Questions", early.answer))
        return Answer(
            text=f"{label} is before standard check-in. {standard.answer} " + (early.answer if early else "Please contact reception to confirm whether early check-in can be arranged."),
            sources=sources, confidence=0.9,
        )

    def _faq(self, question: str) -> tuple[Answer, float] | None:
        """Best match against the authored FAQ, with its score."""
        if not self.kb.faqs:
            return None
        best = max(self.kb.faqs, key=lambda f: _overlap(question, f.question))
        score = _overlap(question, best.question)
        if score <= 0:
            return None
        return (
            Answer(
                text=best.answer,
                sources=[
                    Source("Section 11 - Frequently Asked Questions", best.question)
                ],
                origin="document",
                confidence=round(score, 3),
            ),
            score,
        )

    def _match_rooms(self, question: str) -> list[Room]:
        """Room categories named in the question, best-matching tier only.

        "family suite" resolves to one room; a bare "suite" matches Executive
        and Family equally and returns both, so the caller can list them
        instead of silently picking one.
        """
        lowered = question.lower()
        scored: list[tuple[int, Room]] = []
        for room in self.kb.rooms:
            words = tokenize(room.room_type)
            # Trailing s? so "your suites" matches the Suite categories.
            hits = sum(1 for w in words if re.search(rf"\b{re.escape(w)}s?\b", lowered))
            if hits:
                scored.append((hits, room))
        if not scored:
            return []
        best = max(hits for hits, _ in scored)
        return [room for hits, room in scored if hits == best]

    def _match_room(self, question: str) -> Room | None:
        """The single room category named, or None when ambiguous."""
        matches = self._match_rooms(question)
        return matches[0] if len(matches) == 1 else None

    def _room_facts(self, question: str) -> Answer | None:
        """Answer price / capacity / suitability from the parsed room table."""
        if not self.kb.rooms:
            return None
        lowered = question.lower()
        source = Source("Section 4 - Room Categories", "Room category table")

        asks_price = re.search(
            r"\bpric(?:e|es|ing)\b|\bcosts?\b|\brates?\b|\bhow much\b|\btariffs?\b|\bper night\b",
            lowered,
        )
        asks_capacity = re.search(
            r"\bcapacit\w+\b|\bhow many\b|\bsleeps?\b|\bfit\b|\bmax\w*\b|\boccupan\w+\b",
            lowered,
        )
        # Availability is the live path's job, not the table's. Concrete dates
        # mean the same thing even without the word: "any rooms from 25 to 27
        # October for 3 guests" is a search, not a request for the brochure.
        if re.search(r"\bavailab\w+\b|\bvacan\w+\b|\bbook\w*\b", lowered):
            return None
        if parse_stay(question) is not None:
            return None

        matches = self._match_rooms(question)
        room = matches[0] if len(matches) == 1 else None
        guests = parse_guests(question)

        # "Can four guests stay in a Deluxe King?" -- a capacity verdict.
        if room and guests:
            fits = guests <= room.capacity
            verdict = "Yes" if fits else "No"
            alternatives = [r for r in self.kb.rooms if r.capacity >= guests]
            tail = ""
            if not fits and alternatives:
                names = ", ".join(
                    f"{r.room_type} (sleeps {r.capacity})" for r in alternatives
                )
                tail = f" For {guests} guests, consider: {names}."
            elif not fits:
                tail = (
                    f" No room category seats {guests} guests; "
                    "please contact reception to arrange additional rooms."
                )
            return Answer(
                text=(
                    f"{verdict}. The {room.room_type} has a maximum capacity of "
                    f"{room.capacity} guests.{tail}"
                ),
                sources=[source],
                origin="document",
                confidence=0.95,
            )

        if room and asks_price:
            return Answer(
                text=(
                    f"The {room.room_type} is {_money(room.price_per_night, room.currency)} "
                    f"per night. It sleeps up to {room.capacity} guests and includes: "
                    f"{room.features}."
                ),
                sources=[source],
                origin="document",
                confidence=0.95,
            )

        if room and asks_capacity:
            return Answer(
                text=(
                    f"The {room.room_type} has a maximum capacity of "
                    f"{room.capacity} guests. Features: {room.features}."
                ),
                sources=[source],
                origin="document",
                confidence=0.95,
            )

        # "Which room suits four guests?"
        if guests and re.search(r"\brooms?\b|\bsuites?\b|\bcategor\w+\b|\bstay\b", lowered):
            options = [r for r in self.kb.rooms if r.capacity >= guests]
            if not options:
                return Answer(
                    text=(
                        f"No room category seats {guests} guests. The largest is the "
                        f"{max(self.kb.rooms, key=lambda r: r.capacity).room_type}, "
                        f"with a maximum of "
                        f"{max(r.capacity for r in self.kb.rooms)} guests."
                    ),
                    sources=[source],
                    origin="document",
                    confidence=0.9,
                )
            return Answer(
                text=f"These categories seat {guests} guests or more:\n{_room_lines(options)}",
                sources=[source],
                origin="document",
                confidence=0.9,
                suggestions=["Check availability for these dates", "Is breakfast included?"],
            )

        # "What room types do you have?" / "show me your prices"
        wants_listing = re.search(
            r"\broom types?\b|\bcategor\w+\b|\bwhat rooms?\b|\bwhich rooms?\b|"
            r"\ball rooms?\b|\broom options?\b|\brooms? do you\b",
            lowered,
        )
        describes = re.search(
            r"\btell me\b|\bdescribe\b|\bdetails?\b|\bwhat(?:'s| is| are)\b|\bshow me\b",
            lowered,
        )
        # Naming a category is not the same as asking about it: "do suites have
        # bathrobes" is an amenity question that happens to say "suites", and
        # belongs to retrieval, not to the room table.
        about_category = bool(asks_price or asks_capacity or wants_listing or describes)

        # Several categories named at once ("your suites"): list exactly those
        # rather than guessing which one the guest meant.
        if len(matches) > 1 and about_category:
            return Answer(
                text=(
                    f"{len(matches)} categories match that:\n{_room_lines(matches)}"
                ),
                sources=[source],
                origin="document",
                confidence=0.88,
            )
        if wants_listing or (asks_price and re.search(r"\brooms?\b", lowered) and not room):
            return Answer(
                text=(
                    f"The hotel has {len(self.kb.rooms)} room categories:\n"
                    f"{_room_lines(self.kb.rooms)}"
                ),
                sources=[source],
                origin="document",
                confidence=0.9,
                suggestions=["What is included in every room?", "Check availability"],
            )

        if room and about_category:
            return Answer(
                text=(
                    f"The {room.room_type} sleeps up to {room.capacity} guests at "
                    f"{_money(room.price_per_night, room.currency)} per night. "
                    f"Features: {room.features}."
                ),
                sources=[source],
                origin="document",
                confidence=0.85,
            )
        return None

    def _facility_facts(self, question: str) -> Answer | None:
        """Answer "is there a gym / when does the pool open" from section 6."""
        if not self.kb.facilities:
            return None
        lowered = question.lower()

        # Guest wording -> the facility's name in the document.
        keywords: dict[str, tuple[str, ...]] = {
            "Fitness Centre": ("gym", "fitness", "workout", "exercise"),
            "Swimming Pool": ("pool", "swim"),
            "Spa": ("spa", "massage"),
            "Business Centre": ("business centre", "business center", "meeting"),
            "Restaurant - Harbour Table": ("restaurant", "harbour", "dining room", "breakfast"),
            "Rooftop Lounge - Skyline 18": ("rooftop", "lounge", "skyline", "bar"),
        }

        matched: Facility | None = None
        for facility in self.kb.facilities:
            terms = keywords.get(facility.name, ())
            if any(re.search(rf"\b{re.escape(t)}\b", lowered) for t in terms):
                matched = facility
                break
        if matched is None:
            return None

        # Only take this path for facility-shaped questions; "is breakfast
        # included" is a food policy and belongs to the FAQ/retrieval path.
        if not re.search(
            r"\bopen\w*\b|\bhours?\b|\btimings?\b|\bwhen\b|\bwhat time\b|\bclose\w*\b|"
            r"\bwhere\b|\bfloor\b|\bis there\b|\bdo you have\b|\bhave a\b|\bany\b|"
            r"\bappointments?\b|\bwalk ?-? ?ins?\b",
            lowered,
        ):
            return None

        return Answer(
            text=f"{matched.name}: {matched.detail}",
            sources=[Source("Section 6 - Hotel Facilities", f"{matched.name}: {matched.detail}")],
            origin="document",
            confidence=0.92,
        )

    def _retrieved(self, question: str) -> Answer | None:
        """Fall back to the best-matching statements, quoted verbatim."""
        hits = self.retriever.search(question, k=6)
        if not hits or hits[0].score < config.MIN_SCORE:
            return None

        if (block := self._subsection_block(hits)) is not None:
            chunks = block
        else:
            # Keep only hits close to the best one; a long tail of weak matches
            # reads as padding and dilutes a correct top answer.
            cutoff = hits[0].score * 0.65
            chunks = [h.chunk for h in hits if h.score >= cutoff][:3]

        body = (
            chunks[0].text
            if len(chunks) == 1
            else "\n".join(f"- {c.text}" for c in chunks)
        )
        return Answer(
            text=body,
            sources=[Source(c.citation, c.text) for c in chunks],
            origin="document",
            confidence=min(0.9, round(hits[0].score / 12, 3)),
        )

    def _subsection_block(self, hits: list) -> list | None:
        """Return a whole policy subsection when the question lands on one.

        A policy is a set of clauses that only makes sense together: "check-out
        is 12:00 PM" alone is a misleading answer to "what if I leave at 4pm",
        because the 50% late charge lives in a neighbouring bullet. When most
        of the top hits come from one subsection, answer with all of it.
        """
        counts = Counter(
            (h.chunk.section, h.chunk.subsection)
            for h in hits[:5]
            if h.chunk.subsection
        )
        if not counts:
            return None

        (section, subsection), count = counts.most_common(1)[0]
        if count < 3:
            return None

        block = [
            c for c in self.kb.chunks
            if c.section == section and c.subsection == subsection
        ]
        # Too long and it stops being an answer and starts being the document.
        return block if 1 < len(block) <= 6 else None


_DEFAULT_SUGGESTIONS = [
    "What time is check-in?",
    "What is the cancellation policy?",
    "Which room suits 4 guests?",
    "Is there a gym?",
]
