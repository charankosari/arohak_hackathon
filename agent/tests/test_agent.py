"""Grounding and accuracy checks for the hotel chatbot.

Doubles as the eval set. Questions are written the way a guest would type them
-- paraphrased, lowercase, sometimes terse -- rather than copied from the PDF,
because matching the document's own wording is the easy case.

Run:  python -m pytest -q          (from the agent/ directory)
"""

from __future__ import annotations

import asyncio
from datetime import date

import pytest

from app.answering import REFUSAL, Answerer
from app.dates import parse_guests, parse_stay
from app.ingest import build
from app.live import LiveBackend
from app import config

TODAY = date(2026, 9, 12)  # A Saturday, matching the document's "last updated".


@pytest.fixture(scope="module")
def kb():
    return build(config.PDF_PATH)


@pytest.fixture(scope="module")
def bot(kb):
    # Empty base URL disables live lookups, so document answers are tested in
    # isolation and no test touches the network.
    return Answerer(kb, LiveBackend(base_url=""))


def ask(bot: Answerer, question: str, today: date | None = TODAY):
    return asyncio.run(bot.answer(question, today=today))


# ---------------------------------------------------------------------------
# Ingestion
# ---------------------------------------------------------------------------


def test_pdf_parses_into_expected_records(kb):
    assert len(kb.rooms) == 5
    assert len(kb.faqs) == 14
    assert len(kb.facilities) == 6
    assert kb.overview["Hotel Name"] == "The Meridian Grand Mumbai"
    assert kb.overview["Hotel ID"] == "HGMUM001"


def test_room_table_values(kb):
    rooms = {r.room_type: r for r in kb.rooms}
    assert rooms["Deluxe King"].capacity == 2
    assert rooms["Deluxe King"].price_per_night == 8500
    assert rooms["Family Suite"].capacity == 4
    assert rooms["Family Suite"].price_per_night == 22000
    assert rooms["Premier Sea View"].price_per_night == 12500


def test_every_chunk_is_citable(kb):
    assert all(c.citation.startswith("Section ") for c in kb.chunks)


def test_room_table_cells_are_not_indexed_raw(kb):
    """The table's cells are not answers.

    "4 guests" on its own retrieves and reads like a reply; the row is only
    meaningful re-emitted as a sentence.
    """
    section_four = [c for c in kb.chunks if c.section == 4]
    assert section_four, "room rows should still be retrievable"
    assert all(c.kind == "room" for c in section_four)
    assert all(len(c.text) > 40 for c in section_four)


def test_amenity_bullets_survive_parsing(kb):
    """Guards the bullet-vs-heading rule in ingest.extract_lines.

    These are short, capitalised and unpunctuated -- indistinguishable from a
    subsection heading except for the bullet marker.
    """
    amenities = {c.text for c in kb.chunks if c.section == 5}
    for expected in [
        "Complimentary Wi-Fi",
        "Air conditioning",
        "In-room safe",
        "Hair dryer",
        "Mini refrigerator",
        "Daily housekeeping",
        "Bathrobe and slippers",
        "Evening turndown service",
    ]:
        assert expected in amenities, f"amenity lost during ingestion: {expected!r}"


# ---------------------------------------------------------------------------
# Core facts -- (question, substrings that must appear in the answer)
# ---------------------------------------------------------------------------

FACT_CASES = [
    ("what time is check in?", ["2:00 PM"]),
    ("when can I check out", ["12:00 PM"]),
    ("is wifi free", ["Wi-Fi"]),
    ("what's the wifi network called", ["MeridianGuest"]),
    ("do you have parking", ["parking"]),
    ("is parking free", ["omplimentary"]),
    ("can i cancel my booking", ["24 hours"]),
    ("is breakfast included", ["selected room packages"]),
    ("do you have a swimming pool", ["4th floor", "6:00 AM"]),
    ("is the gym open 24 hours", ["24 hours"]),
    ("can I request early check-in", ["1,500"]),
    ("can i add an extra bed", ["extra bed"]),
    ("do you do airport transfers", ["concierge"]),
    ("how far is the airport", ["25 km"]),
    ("what's your phone number", ["+91 22 4567 8900"]),
    ("where are you located", ["Nariman Point"]),
    ("what languages does reception speak", ["Marathi"]),
    ("when does the spa open", ["10:00 AM"]),
    ("what floor is the business centre on", ["2nd floor"]),
    ("what time does the rooftop bar open", ["5:00 PM"]),
    ("do i need id at check in", ["photo ID"]),
    ("are vegan meals available", ["vegan"]),
    ("do you have accessible rooms", ["ccessible"]),
    ("what time is breakfast served", ["6:30 AM"]),
    ("is there room service", ["24-hour in-room dining"]),
    # Section 5 amenities: short title-case bullets that the parser once
    # mistook for subsection headings and dropped entirely.
    ("is housekeeping included", ["housekeeping"]),
    ("is there a safe in the room", ["safe"]),
    ("do the rooms have a kettle", ["kettle"]),
    ("how much bottled water do i get", ["2 bottles"]),
    ("do suites have bathrobes", ["athrobe"]),
    ("is there a hair dryer", ["air dryer"]),
]


@pytest.mark.parametrize("question,expected", FACT_CASES)
def test_documented_facts(bot, question, expected):
    result = ask(bot, question)
    for fragment in expected:
        assert fragment.lower() in result.text.lower(), (
            f"{question!r} -> {result.text!r} (missing {fragment!r})"
        )
    assert result.sources, f"{question!r} answered without a citation"


# ---------------------------------------------------------------------------
# Room table reasoning
# ---------------------------------------------------------------------------


def test_room_price(bot):
    result = ask(bot, "how much is the family suite per night")
    assert "22,000" in result.text
    assert "4" in result.text


def test_room_capacity_rejects_oversize_party(bot):
    result = ask(bot, "can four guests stay in a deluxe king room?")
    assert result.text.lower().startswith("no")
    assert "2" in result.text


def test_suggests_room_for_party_size(bot):
    result = ask(bot, "which room is suitable for four guests")
    assert "Family Suite" in result.text


def test_lists_all_room_types(bot):
    result = ask(bot, "what room types do you have")
    for name in ["Deluxe King", "Deluxe Twin", "Premier Sea View",
                 "Executive Suite", "Family Suite"]:
        assert name in result.text


def test_late_checkout_returns_the_whole_policy(bot):
    """A policy clause alone is a misleading answer; the subsection is not.

    "Check-out is 12:00 PM" would technically be grounded but would hide the
    50% charge that actually answers the question.
    """
    result = ask(bot, "what happens if i check out at 4pm")
    assert "50%" in result.text
    assert "12:00 PM" in result.text
    assert "6:00 PM" in result.text


def test_ambiguous_suite_lists_rather_than_guesses(bot):
    """"suite" matches two categories, so the bot must not pick one."""
    result = ask(bot, "tell me about your suites")
    assert "Executive Suite" in result.text and "Family Suite" in result.text


# ---------------------------------------------------------------------------
# Grounding -- the bot must refuse what the PDF does not cover (section 12)
# ---------------------------------------------------------------------------

OUT_OF_SCOPE = [
    "do you allow pets",
    "is smoking allowed in the rooms",
    "do you have a casino",
    "can I get a helicopter transfer",
    "what is the wifi password",
    "do you offer visa assistance",
    "is there a kids club",
]


@pytest.mark.parametrize("question", OUT_OF_SCOPE)
def test_refuses_undocumented_questions(bot, question):
    result = ask(bot, question)
    assert result.text == REFUSAL, f"{question!r} should refuse, got {result.text!r}"
    assert result.origin == "none"


@pytest.mark.parametrize(
    "question",
    [
        "if i cancel now can i get the money back",
        "will i get a refund",
        "is the deposit refundable",
    ],
)
def test_refund_questions_go_to_reception(bot, question):
    """The document has a cancellation policy but no refund terms.

    Answering these with the cancellation timings would invite a guest to read
    refund terms into them, and two phrasings of the same question would get
    different answers.
    """
    assert ask(bot, question).text == REFUSAL


def test_guest_copy_never_mentions_the_knowledge_base(bot):
    """A guest is talking to a concierge, not watching a lookup fail.

    The refusal offers reception instead of reporting a missing document, and
    no answer the bot produces refers to the source it was grounded in.
    """
    assert "reception" in REFUSAL.lower()
    assert "+91 22 4567 8900" in REFUSAL

    leaks = ("document", "pdf", "knowledge base", "section ", "source")
    questions = [q for q, _ in FACT_CASES] + OUT_OF_SCOPE + [
        "hello",
        "which room suits 4 guests?",
        "can I cancel now and get my money back",
        "any rooms available on 20 September for 4 guests?",
    ]
    for question in questions:
        text = ask(bot, question).text.lower()
        for leak in leaks:
            assert leak not in text, f"{question!r} leaked {leak!r}: {text!r}"


def test_answers_are_never_invented(bot):
    """Every documented answer must carry a citation back to the PDF."""
    for question, _ in FACT_CASES:
        result = ask(bot, question)
        assert result.origin in {"document", "live", "live+document"}
        assert result.sources


# ---------------------------------------------------------------------------
# Conversational handling
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("greeting", ["hello", "Hi!", "hey there", "good morning"])
def test_greeting(bot, greeting):
    result = ask(bot, greeting)
    assert "Meridian Grand" in result.text
    assert result.suggestions


def test_greeting_prefix_does_not_swallow_the_question(bot):
    """"hi, what time is check-in?" is a question, not a greeting."""
    result = ask(bot, "hi, what time is check-in?")
    assert "2:00 PM" in result.text


def test_thanks(bot):
    assert "Enjoy your stay" in ask(bot, "thanks!").text


def test_empty_question(bot):
    result = ask(bot, "   ")
    assert result.origin == "none"


def test_follow_up_keeps_its_own_subject(bot):
    """A follow-up that names a subject must not inherit the previous one."""
    result = asyncio.run(
        bot.answer("and the spa?", today=TODAY, context="what time does the pool open")
    )
    assert "Spa" in result.text
    assert "Swimming Pool" not in result.text


@pytest.mark.parametrize(
    "question,context",
    [
        # The bug this guards: the merged text still holds dates and a room
        # noun, so the guest got the previous availability answer.
        ("do you allow pets?", "any rooms from 25 to 27 October for 3 guests?"),
        ("are pets allowed", "which room suits 2 guests"),
        ("is there a casino", "what time does the pool open"),
    ],
)
def test_out_of_scope_question_is_not_rescued_by_context(bot, question, context):
    """Context must never turn "not in the document" into someone else's answer."""
    result = asyncio.run(bot.answer(question, today=TODAY, context=context))
    assert result.text == REFUSAL, f"{question!r} after {context!r} -> {result.text!r}"


def test_follow_up_borrows_context_only_when_it_must(bot):
    """"what about 4 guests" cannot stand alone, so the prior turn is used."""
    result = asyncio.run(
        bot.answer(
            "what about for 4 guests",
            today=TODAY,
            context="which room is suitable for 2 guests",
        )
    )
    assert "Family Suite" in result.text


def test_availability_without_dates_asks_for_them(bot):
    result = ask(bot, "do you have any rooms available?")
    assert "date" in result.text.lower()


def test_availability_falls_back_to_document_when_backend_down(bot):
    """Live lookups are disabled in this fixture, so this exercises the fallback."""
    result = ask(bot, "any rooms available on 20 September for 4 guests?")
    assert "Family Suite" in result.text
    assert result.origin == "document"


# ---------------------------------------------------------------------------
# Date and party-size parsing
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "text,check_in,check_out",
    [
        ("any rooms tonight", date(2026, 9, 12), date(2026, 9, 13)),
        ("a room tomorrow", date(2026, 9, 13), date(2026, 9, 14)),
        ("rooms from 20 September to 22 September", date(2026, 9, 20), date(2026, 9, 22)),
        ("book 20 Sept for 3 nights", date(2026, 9, 20), date(2026, 9, 23)),
        ("stay on 2026-10-02", date(2026, 10, 2), date(2026, 10, 3)),
        ("September 20 to September 25", date(2026, 9, 20), date(2026, 9, 25)),
        ("rooms on 05/10 for 2 nights", date(2026, 10, 5), date(2026, 10, 7)),
    ],
)
def test_parse_stay(text, check_in, check_out):
    stay = parse_stay(text, TODAY)
    assert stay is not None, f"failed to parse {text!r}"
    assert stay.check_in == check_in
    assert stay.check_out == check_out


def test_parse_stay_rolls_past_dates_to_next_year():
    """"20 January" asked in September means next January, not last."""
    stay = parse_stay("rooms on 20 January", TODAY)
    assert stay is not None
    assert stay.check_in == date(2027, 1, 20)


def test_parse_stay_returns_none_without_dates():
    assert parse_stay("what time is check-in?", TODAY) is None


@pytest.mark.parametrize(
    "text,expected",
    [
        ("a room for 4 guests", 4),
        ("rooms for two people", 2),
        ("booking for 3 adults", 3),
        ("what time is check-in", None),
    ],
)
def test_parse_guests(text, expected):
    assert parse_guests(text) == expected


# ---------------------------------------------------------------------------
# Live availability (stubbed backend -- no network)
# ---------------------------------------------------------------------------


class StubBackend(LiveBackend):
    def __init__(self, payload):
        super().__init__(base_url="http://stub")
        self.payload = payload
        self.calls = []

    async def search_availability(self, check_in, check_out, guests=1, room_type=None):
        self.calls.append((check_in, check_out, guests, room_type))
        return self.payload


def test_live_availability_is_used_for_date_questions(kb):
    backend = StubBackend(
        {
            "stay": {"checkIn": "2026-09-20", "checkOut": "2026-09-22", "nights": 2},
            "count": 2,
            "rooms": [
                {
                    "roomType": "Deluxe King", "roomNumber": "1201",
                    "pricePerNight": 8500, "maxGuests": 2,
                    "quote": {"nights": 2, "nightlyRate": 8500, "totalAmount": 17000},
                },
                {
                    "roomType": "Family Suite", "roomNumber": "1801",
                    "pricePerNight": 22000, "maxGuests": 4,
                    "quote": {"nights": 2, "nightlyRate": 22000, "totalAmount": 44000},
                },
            ],
        }
    )
    bot = Answerer(kb, backend)
    result = ask(bot, "any rooms available from 20 to 22 September for 2 guests?")

    assert backend.calls == [(date(2026, 9, 20), date(2026, 9, 22), 2, None)]
    assert result.origin == "live+document"
    assert "Deluxe King" in result.text and "8,500" in result.text
    assert "17,000" in result.text  # the two-night quote


def test_dates_alone_route_to_live_availability(kb):
    """No availability verb, but concrete dates still mean "search"."""
    backend = StubBackend({"count": 0, "rooms": []})
    bot = Answerer(kb, backend)
    result = ask(bot, "any rooms from 25 to 27 October for 3 guests")

    assert backend.calls == [(date(2026, 10, 25), date(2026, 10, 27), 3, None)]
    assert result.origin == "live"


def test_live_availability_reports_sold_out(kb):
    bot = Answerer(kb, StubBackend({"count": 0, "rooms": []}))
    result = ask(bot, "any rooms free tomorrow?")
    assert "No rooms are available" in result.text
    assert result.origin == "live"


def test_policy_questions_never_hit_the_backend(kb):
    backend = StubBackend({"count": 0, "rooms": []})
    bot = Answerer(kb, backend)
    ask(bot, "what time is check-in?")
    ask(bot, "how much is the family suite?")
    assert backend.calls == [], "policy questions must be answered from the document"

@pytest.mark.parametrize('question, start, end', [
    ('can you search rooms for tommorow', date(2026, 9, 13), date(2026, 9, 14)),
    ('i want to book from 13 september to 15 september', date(2026, 9, 13), date(2026, 9, 15)),
    ('reserve a deluxe twin tomorrow', date(2026, 9, 13), date(2026, 9, 14)),
])
def test_conversational_searches(kb, question, start, end):
    backend = StubBackend({'rooms': []})
    result = ask(Answerer(kb, backend), question)
    assert len(backend.calls) == 1
    assert backend.calls[0][:2] == (start, end)
    assert result.origin == 'live'


def test_pricing_word(bot):
    result = ask(bot, 'can you say the pricing of deluxe twin')
    assert '8,500' in result.text
    assert 'per night' in result.text
    assert result.sources


def test_arrival_after_checkin(bot):
    result = ask(bot, 'if i come at 3 pm can i check in')
    assert result.text.startswith('Yes, 3:00 PM')
    assert '2:00 PM' in result.text


def test_early_arrival_is_not_guaranteed(bot):
    result = ask(bot, 'if i come at 9 am can i check in')
    assert 'subject to availability' in result.text
    assert '1,500' in result.text


@pytest.mark.parametrize('question', ['can I book a spa treatment tomorrow', 'can I cancel my reservation from 13 september to 15 september'])
def test_other_booking_intents_are_not_room_searches(kb, question):
    backend = StubBackend({'rooms': []})
    ask(Answerer(kb, backend), question)
    assert not backend.calls
