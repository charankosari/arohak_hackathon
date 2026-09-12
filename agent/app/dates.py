"""Turn the dates in a guest's sentence into a concrete stay.

Availability questions arrive as "any rooms tomorrow night?" or "20 to 22
September for 3 people", and the live API needs checkIn/checkOut. This is a
narrow, explicit parser rather than a fuzzy one: a wrong date silently returns
the wrong availability, so anything not clearly a date is left alone and the
agent asks the guest instead.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, timedelta

MONTHS = {
    "january": 1, "jan": 1,
    "february": 2, "feb": 2,
    "march": 3, "mar": 3,
    "april": 4, "apr": 4,
    "may": 5,
    "june": 6, "jun": 6,
    "july": 7, "jul": 7,
    "august": 8, "aug": 8,
    "september": 9, "sep": 9, "sept": 9,
    "october": 10, "oct": 10,
    "november": 11, "nov": 11,
    "december": 12, "dec": 12,
}

WEEKDAYS = {
    "monday": 0, "mon": 0,
    "tuesday": 1, "tue": 1, "tues": 1,
    "wednesday": 2, "wed": 2,
    "thursday": 3, "thu": 3, "thurs": 3,
    "friday": 4, "fri": 4,
    "saturday": 5, "sat": 5,
    "sunday": 6, "sun": 6,
}

_MONTH_NAMES = "|".join(sorted(MONTHS, key=len, reverse=True))

# Ordered most-specific first; the first pattern to match a span wins.
_ISO = re.compile(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b")
_DAY_MONTH = re.compile(
    rf"\b(\d{{1,2}})(?:st|nd|rd|th)?\s+(?:of\s+)?({_MONTH_NAMES})\b\.?(?:\s*,?\s*(\d{{4}}))?",
    re.IGNORECASE,
)
_MONTH_DAY = re.compile(
    rf"\b({_MONTH_NAMES})\s+(\d{{1,2}})(?:st|nd|rd|th)?\b(?:\s*,?\s*(\d{{4}}))?",
    re.IGNORECASE,
)
# Day-first: Indian convention, and the hotel is in Mumbai.
_NUMERIC = re.compile(r"\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b")

_NIGHTS = re.compile(r"\b(\d{1,2})\s*nights?\b", re.IGNORECASE)
_GUESTS = re.compile(
    r"\b(\d{1,2})\s*(?:guests?|people|persons?|adults?|pax)\b", re.IGNORECASE
)
_WORD_NUMBERS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
}


@dataclass
class Stay:
    check_in: date
    check_out: date

    @property
    def nights(self) -> int:
        return (self.check_out - self.check_in).days


def _roll_forward(day: int, month: int, year: int | None, today: date) -> date | None:
    """Resolve a day/month, choosing the next occurrence when no year is given."""
    if year is not None:
        if year < 100:
            year += 2000
        try:
            return date(year, month, day)
        except ValueError:
            return None
    for candidate_year in (today.year, today.year + 1):
        try:
            resolved = date(candidate_year, month, day)
        except ValueError:
            continue
        if resolved >= today:
            return resolved
    return None


def _explicit_dates(text: str, today: date) -> list[date]:
    """Every explicit calendar date in the text, in the order written."""
    found: list[tuple[int, date]] = []
    claimed: list[tuple[int, int]] = []

    def free(match: re.Match) -> bool:
        return not any(s < match.end() and match.start() < e for s, e in claimed)

    for match in _ISO.finditer(text):
        year, month, day = (int(g) for g in match.groups())
        try:
            found.append((match.start(), date(year, month, day)))
            claimed.append(match.span())
        except ValueError:
            pass

    for pattern, order in ((_DAY_MONTH, "dm"), (_MONTH_DAY, "md")):
        for match in pattern.finditer(text):
            if not free(match):
                continue
            a, b, year = match.groups()
            day, month_name = (a, b) if order == "dm" else (b, a)
            month = MONTHS[month_name.lower()]
            resolved = _roll_forward(int(day), month, int(year) if year else None, today)
            if resolved:
                found.append((match.start(), resolved))
                claimed.append(match.span())

    for match in _NUMERIC.finditer(text):
        if not free(match):
            continue
        day, month, year = match.groups()
        if not 1 <= int(month) <= 12:
            continue
        resolved = _roll_forward(int(day), int(month), int(year) if year else None, today)
        if resolved:
            found.append((match.start(), resolved))
            claimed.append(match.span())

    return [d for _, d in sorted(found)]


def _relative_date(text: str, today: date) -> date | None:
    """Resolve "tonight", "tomorrow", "this weekend", "next friday"."""
    lowered = text.lower()

    if re.search(r"\b(tonight|today)\b", lowered):
        return today
    if re.search(r"\btomorrow\b", lowered):
        return today + timedelta(days=1)
    if re.search(r"\b(this|the|coming)\s+weekend\b|\bweekend\b", lowered):
        # Saturday of the current week, or the next one once it has passed.
        return today + timedelta(days=(5 - today.weekday()) % 7)

    weekday_match = re.search(
        rf"\b(next|this|coming)?\s*({'|'.join(WEEKDAYS)})\b", lowered
    )
    if weekday_match:
        qualifier, name = weekday_match.groups()
        delta = (WEEKDAYS[name] - today.weekday()) % 7
        if delta == 0 or qualifier == "next":
            delta += 7
        return today + timedelta(days=delta)

    if re.search(r"\bnext week\b", lowered):
        return today + timedelta(days=7 - today.weekday())
    return None


def parse_stay(text: str, today: date | None = None) -> Stay | None:
    """Extract a check-in/check-out pair, or None when the text has no dates."""
    today = today or date.today()

    nights_match = _NIGHTS.search(text)
    nights = int(nights_match.group(1)) if nights_match else None

    dates = _explicit_dates(text, today)
    if len(dates) >= 2:
        check_in, check_out = dates[0], dates[1]
        # "20 to 19 September" is a typo or a year boundary; either way the
        # written order is what the guest meant.
        if check_out <= check_in:
            check_out = check_in + timedelta(days=nights or 1)
        return Stay(check_in, check_out)

    anchor = dates[0] if dates else _relative_date(text, today)
    if anchor is None:
        return None
    return Stay(anchor, anchor + timedelta(days=nights or 1))


def parse_guests(text: str) -> int | None:
    """Party size, written as a digit or a word."""
    if match := _GUESTS.search(text):
        return int(match.group(1))
    words = "|".join(_WORD_NUMBERS)
    if match := re.search(
        rf"\b({words})\s*(?:guests?|people|persons?|adults?)\b", text, re.IGNORECASE
    ):
        return _WORD_NUMBERS[match.group(1).lower()]
    return None
