"""Turn AROHAK_Hotel_Information_For_RAG.pdf into a retrievable knowledge base.

The PDF is highly structured -- numbered sections, bullet lists, a room table
and an explicit FAQ -- so parsing it into typed records beats treating it as a
wall of text. Two things come out of here:

  chunks      one retrievable fact each, carrying the citation it came from
  structured  the room table, facility hours, overview fields and FAQ pairs,
              parsed into records the answerer can read fields off directly

Chunking at the bullet level matters for answer quality: "Early check-in before
10:00 AM may incur a charge of INR 1,500" is its own retrievable unit, so a
question about early check-in fees returns that line and not the whole of
section 2.
"""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path

from pypdf import PdfReader

# pypdf renders this PDF's bullet glyph as DEL; the others are here so a
# re-exported or edited source file still parses.
BULLET_CHARS = "\x7f\u2022\u25cf\u25aa\u2023-"

# Repeated on every page by the template, and meaningless as knowledge.
PAGE_NOISE = re.compile(r"^(AROHAK Hackathon Hiring|Page \d+)\s*$", re.IGNORECASE)

SECTION_HEADING = re.compile(r"^(\d{1,2})\.\s+(\S.*)$")
FAQ_QUESTION = re.compile(r"^Q:\s*(.+)$")
FAQ_ANSWER = re.compile(r"^A:\s*(.+)$")
KEY_VALUE = re.compile(r"^([A-Z][A-Za-z/ \-]{2,45}):\s*(\S.*)$")


@dataclass
class Chunk:
    """One retrievable statement plus the citation that makes it traceable."""

    id: str
    text: str
    section: int
    section_title: str
    subsection: str | None
    kind: str  # fact | faq | overview | room | intro

    @property
    def citation(self) -> str:
        base = f"Section {self.section} - {self.section_title}"
        return f"{base} > {self.subsection}" if self.subsection else base


@dataclass
class Room:
    room_type: str
    capacity: int
    price_per_night: int
    currency: str
    features: str


@dataclass
class Facility:
    name: str
    detail: str


@dataclass
class Faq:
    question: str
    answer: str


@dataclass
class KnowledgeBase:
    chunks: list[Chunk] = field(default_factory=list)
    rooms: list[Room] = field(default_factory=list)
    facilities: list[Facility] = field(default_factory=list)
    faqs: list[Faq] = field(default_factory=list)
    overview: dict[str, str] = field(default_factory=dict)
    source: str = ""

    def to_dict(self) -> dict:
        return {
            "source": self.source,
            "overview": self.overview,
            "rooms": [asdict(r) for r in self.rooms],
            "facilities": [asdict(f) for f in self.facilities],
            "faqs": [asdict(f) for f in self.faqs],
            "chunks": [
                {**asdict(c), "citation": c.citation} for c in self.chunks
            ],
        }

    @classmethod
    def from_dict(cls, raw: dict) -> "KnowledgeBase":
        return cls(
            source=raw.get("source", ""),
            overview=raw.get("overview", {}),
            rooms=[Room(**r) for r in raw.get("rooms", [])],
            facilities=[Facility(**f) for f in raw.get("facilities", [])],
            faqs=[Faq(**f) for f in raw.get("faqs", [])],
            chunks=[
                Chunk(
                    id=c["id"],
                    text=c["text"],
                    section=c["section"],
                    section_title=c["section_title"],
                    subsection=c.get("subsection"),
                    kind=c["kind"],
                )
                for c in raw.get("chunks", [])
            ],
        )


# ---------------------------------------------------------------------------
# Text extraction
# ---------------------------------------------------------------------------


def _normalise(text: str) -> str:
    """Fold the PDF's typographic characters down to ASCII equivalents.

    Retrieval tokenises on word characters, but the answer text is shown to the
    user verbatim -- an en-dash surviving into "6:30 AM-10:30 AM" is fine, a
    mojibake byte is not.
    """
    replacements = {
        "\u2013": "-",  # en dash, used in time ranges
        "\u2014": "-",  # em dash, used in "Restaurant - Harbour Table"
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u00a0": " ",
        "\ufb01": "fi",
        "\ufb02": "fl",
    }
    for bad, good in replacements.items():
        text = text.replace(bad, good)
    return text


def extract_lines(pdf_path: Path) -> list[str]:
    """Read the PDF into logical lines: page furniture dropped, bullets joined.

    A bullet's text often wraps onto following lines with no marker, so an
    unmarked line is treated as a continuation of the bullet above it rather
    than as a statement of its own.
    """
    reader = PdfReader(str(pdf_path))
    raw_lines: list[str] = []
    for page in reader.pages:
        raw_lines.extend(_normalise(page.extract_text() or "").split("\n"))

    lines: list[str] = []
    for raw in raw_lines:
        stripped = raw.strip().strip(BULLET_CHARS).strip()
        if not stripped or PAGE_NOISE.match(stripped):
            continue

        had_bullet = any(ch in raw for ch in "\x7f\u2022\u25cf\u25aa\u2023")
        # A wrapped bullet continues the previous line. Detected from sentence
        # shape rather than indentation: pypdf's leading whitespace for wrapped
        # lines varies between versions, but "previous line has no terminal
        # punctuation and this one starts lowercase" holds regardless.
        # Headings, key: value pairs and FAQ turns always start fresh.
        continues = (
            lines
            and not had_bullet
            and stripped[0].islower()
            and not lines[-1].endswith((".", ":", "?", "!"))
            and not SECTION_HEADING.match(stripped)
            and not FAQ_QUESTION.match(stripped)
            and not FAQ_ANSWER.match(stripped)
        )
        if continues:
            lines[-1] = f"{lines[-1]} {stripped}"
        else:
            lines.append(stripped)

    return lines


# ---------------------------------------------------------------------------
# Section parsing
# ---------------------------------------------------------------------------


def _is_subheading(line: str) -> bool:
    """A bare title line inside a section, e.g. "Check-in Policy"."""
    if len(line) > 60 or line.endswith((".", ":", "?")):
        return False
    words = line.split()
    if not (1 <= len(words) <= 6):
        return False
    return line[0].isupper() and not KEY_VALUE.match(line)


def _parse_room_table(lines: list[str]) -> list[Room]:
    """Section 4's table extracts as one cell per line, row-major.

    Header cells come first ("Room Type", "Capacity", "Price / Night", "Key
    Features"), then each room contributes exactly four lines.
    """
    try:
        start = lines.index("Key Features") + 1
    except ValueError:
        return []

    rooms: list[Room] = []
    cells = lines[start:]
    for i in range(0, len(cells) - 3, 4):
        name, capacity, price, features = (c.strip() for c in cells[i : i + 4])

        cap_match = re.search(r"(\d+)", capacity)
        price_match = re.search(r"([A-Z]{3})\s*([\d,]+)", price)
        if not cap_match or not price_match or "guest" not in capacity.lower():
            # Not a data row -- the table has ended.
            break

        rooms.append(
            Room(
                room_type=name,
                capacity=int(cap_match.group(1)),
                price_per_night=int(price_match.group(2).replace(",", "")),
                currency=price_match.group(1),
                features=features,
            )
        )
    return rooms


def _parse_facilities(lines: list[str]) -> list[Facility]:
    """Section 6 bullets read "Name: detail" or "Name - Brand: detail"."""
    facilities: list[Facility] = []
    for line in lines:
        if ":" not in line:
            continue
        name, detail = line.split(":", 1)
        facilities.append(Facility(name=name.strip(), detail=detail.strip()))
    return facilities


def _parse_faqs(lines: list[str]) -> list[Faq]:
    faqs: list[Faq] = []
    pending: str | None = None
    for line in lines:
        if q := FAQ_QUESTION.match(line):
            pending = q.group(1).strip()
        elif (a := FAQ_ANSWER.match(line)) and pending:
            faqs.append(Faq(question=pending, answer=a.group(1).strip()))
            pending = None
    return faqs


def parse(lines: list[str], source: str = "") -> KnowledgeBase:
    """Group lines under their section heading and build typed records."""
    kb = KnowledgeBase(source=source)

    # Split into sections first; every downstream parser works on one section.
    sections: list[tuple[int, str, list[str]]] = []
    current: tuple[int, str, list[str]] | None = None
    for line in lines:
        if heading := SECTION_HEADING.match(line):
            current = (int(heading.group(1)), heading.group(2).strip(), [])
            sections.append(current)
        elif current is not None:
            current[2].append(line)

    for number, title, body in sections:
        if number == 4:
            kb.rooms = _parse_room_table(body)
        elif number == 6:
            kb.facilities = _parse_facilities(body)
        elif number == 11:
            kb.faqs = _parse_faqs(body)

        subsection: str | None = None
        for line in body:
            if _is_subheading(line):
                subsection = line
                continue
            if FAQ_QUESTION.match(line) or FAQ_ANSWER.match(line):
                continue  # FAQ pairs are emitted as single chunks below.

            if kv := KEY_VALUE.match(line):
                if number == 1:
                    kb.overview[kv.group(1).strip()] = kv.group(2).strip()

            kb.chunks.append(
                Chunk(
                    id=f"s{number}-c{len(kb.chunks)}",
                    text=line,
                    section=number,
                    section_title=title,
                    subsection=subsection,
                    kind="overview" if number == 1 else "fact",
                )
            )

    # An FAQ answer is only meaningful next to its question, so the pair is one
    # chunk -- that also lets a question-shaped query match question text.
    faq_section = next((s for s in sections if s[0] == 11), None)
    for i, faq in enumerate(kb.faqs):
        kb.chunks.append(
            Chunk(
                id=f"faq-{i}",
                text=f"{faq.question} {faq.answer}",
                section=11,
                section_title=faq_section[1] if faq_section else "Frequently Asked Questions",
                subsection=None,
                kind="faq",
            )
        )

    # Room rows as sentences, so "how much is a family suite" retrieves one.
    for i, room in enumerate(kb.rooms):
        kb.chunks.append(
            Chunk(
                id=f"room-{i}",
                text=(
                    f"{room.room_type} room: sleeps {room.capacity} guests, "
                    f"{room.currency} {room.price_per_night:,} per night. {room.features}."
                ),
                section=4,
                section_title="Room Categories",
                subsection=room.room_type,
                kind="room",
            )
        )

    return kb


# ---------------------------------------------------------------------------
# Build / load
# ---------------------------------------------------------------------------


def build(pdf_path: Path) -> KnowledgeBase:
    return parse(extract_lines(pdf_path), source=pdf_path.name)


def save(kb: KnowledgeBase, index_path: Path) -> None:
    index_path.parent.mkdir(parents=True, exist_ok=True)
    index_path.write_text(
        json.dumps(kb.to_dict(), indent=2, ensure_ascii=False), encoding="utf-8"
    )


def load(index_path: Path, pdf_path: Path) -> KnowledgeBase:
    """Load the built index, falling back to parsing the PDF on the fly.

    The fallback means a fresh clone serves correct answers before anyone
    remembers to run the ingest script.
    """
    if index_path.exists():
        return KnowledgeBase.from_dict(
            json.loads(index_path.read_text(encoding="utf-8"))
        )
    return build(pdf_path)
