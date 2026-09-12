"""Lexical retrieval over the knowledge base: BM25 plus domain vocabulary.

There is no embedding model and no vector store here, by design. The corpus is
~90 short, high-signal statements, where BM25 over a hand-tuned hotel
vocabulary is both more accurate and far more explainable than a small
embedding model -- and it starts instantly with no download.

The vocabulary layer is what makes it work. Guests ask "is there a gym?" while
the document says "Fitness Centre", and they ask "how much" where the document
says "INR 8,500". ALIASES bridges that gap at query time.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass

from .ingest import Chunk

K1 = 1.5
B = 0.75

# Filler that carries no retrieval signal. Deliberately short: dropping a word
# that turns out to be meaningful in a 90-document corpus is expensive.
STOPWORDS = frozenset(
    """
    a an the is are was were be been being am do does did doing have has had
    i me my we our you your it its this that these those there here
    of to for at on in by with from as and or if then than so
    what when where which who whom how why whether
    can could will would shall should may might must
    please tell know about get got give want need like
    """.split()
)

# Guest phrasing -> document vocabulary. Matched as whole words against the
# raw query; the values are appended to the query's token list.
ALIASES: dict[str, tuple[str, ...]] = {
    r"\bgyms?\b|\bwork ?outs?\b|\bexercise\b|\bfitness\b": ("fitness", "centre", "gym"),
    r"\bpools?\b|\bswim\w*\b": ("swimming", "pool"),
    r"\bwi-?fi\b|\binternets?\b|\bnetworks?\b|\bconnectivity\b|\bonline\b": (
        "wifi", "internet", "connectivity", "meridianguest",
    ),
    r"\bpark(ing|s)?\b|\bgarages?\b|\bcars?\b|\bvalet\b": ("parking", "basement"),
    r"\bprices?\b|\bcosts?\b|\brates?\b|\bcharges?\b|\bfees?\b|\btariffs?\b|"
    r"\bhow much\b|\bexpensive\b": ("price", "rate", "charge", "inr"),
    r"\bkids?\b|\bchild(ren)?\b|\btoddlers?\b|\binfants?\b|\bbab(y|ies)\b": ("children",),
    r"\bbreakfasts?\b|\bbuffets?\b": ("breakfast", "harbour", "table"),
    r"\bcheck ?-? ?in\b|\barriv\w+\b": ("check-in", "checkin", "check"),
    r"\bcheck ?-? ?out\b|\bdepart\w+\b|\bleav\w+\b": ("check-out", "checkout", "check"),
    # "refund" is deliberately NOT aliased to cancellation. The document has a
    # cancellation policy but says nothing about money being returned, and
    # answering "will I get a refund" with the cancellation timings invites a
    # guest to read refund terms into it. Left unmapped, refund questions fall
    # through to the refusal, which hands them to reception.
    r"\bcancel\w*\b": ("cancel", "cancellation", "booking"),
    r"\bairports?\b|\btransfers?\b|\bpick ?-? ?ups?\b|\btaxis?\b|\bcabs?\b|\bshuttles?\b": (
        "airport", "transfer", "concierge",
    ),
    # "how far" asks for the distance line, not the transfer-booking line.
    # Each alternative must also match the bare word, because unknown_ratio()
    # tests these patterns one token at a time.
    r"\bfar\b|\bdistances?\b|\bkms?\b|\bkilometres?\b|\bnear\w*\b": (
        "km", "approximately",
    ),
    r"\bspas?\b|\bmassages?\b": ("spa",),
    r"\brestaurants?\b|\bdining\b|\bfoods?\b|\beat\w*\b|\bmeals?\b|\bdinner\b|\blunch\b": (
        "restaurant", "dining", "food", "harbour",
    ),
    r"\broom ?services?\b": ("in-room", "dining", "room"),
    r"\bveg\w*\b|\bvegan\b|\bjain\b|\ballerg\w+\b": (
        "vegetarian", "vegan", "jain", "allergy",
    ),
    r"\baccessib\w+\b|\bwheelchairs?\b|\bdisab\w+\b": ("accessible", "wheelchair"),
    r"\bextra beds?\b|\badditional beds?\b|\bcots?\b": ("extra", "bed"),
    r"\bids?\b|\bpassports?\b|\bidentit\w+\b|\bdocuments?\b|\bproofs?\b": (
        "identification", "photo", "id",
    ),
    r"\blounges?\b|\brooftops?\b|\bbars?\b|\bdrinks?\b": ("rooftop", "lounge", "skyline"),
    r"\bbusiness\b|\bmeetings?\b|\bconference\b|\bwork\b": ("business", "centre"),
    r"\bhousekeep\w*\b|\bclean\w*\b": ("housekeeping",),
    # The document says "complimentary" wherever a guest would say "free",
    # and "open ... AM-PM" wherever they would say "timings".
    r"\bfree\b|\bcomplimentary\b|\bincluded\b|\bno charge\b|\bgratis\b": (
        "complimentary", "included",
    ),
    r"\btimings?\b|\bschedules?\b|\bopening\b|\bhours?\b": ("open", "hours"),
    r"\baddress\b|\blocat\w+\b|\bwhere\b": ("address", "road", "mumbai"),
    r"\bphones?\b|\bcontacts?\b|\bcall\b|\bnumbers?\b|\breach\b": ("contact", "number", "email"),
    r"\bguests?\b|\bpeople\b|\bpersons?\b|\boccupan\w+\b|\bsleeps?\b|\bcapacit\w+\b": (
        "guests", "capacity", "occupancy",
    ),
    r"\blanguages?\b|\bspeak\b": ("languages", "english", "hindi", "marathi"),
    r"\breception\b|\bfront desk\b|\blobby\b": ("reception",),
    r"\bsafes?\b|\blockers?\b": ("safe",),
    r"\blaundry\b|\bironing\b|\bdry clean\w*\b": ("laundry",),
    r"\bpets?\b|\bdogs?\b|\bcats?\b|\banimals?\b": ("pets",),
    r"\bsmok\w+\b": ("smoking",),
}

_WORD = re.compile(r"[a-z0-9]+")


def stem(token: str) -> str:
    """Strip a plural 's', so "bathrobes" finds "Bathrobe and slippers".

    Deliberately the crudest rule that works. It runs over the documents and
    the query alike, so both sides land on the same form and an over-eager
    strip costs nothing as long as it is consistent. "business" and "is" are
    protected because -ss/-us/-is endings are almost never plurals.
    """
    if len(token) > 4 and token.endswith("ies"):
        return f"{token[:-3]}y"
    if len(token) > 3 and token.endswith("s") and not token.endswith(("ss", "us", "is")):
        return token[:-1]
    return token


def tokenize(text: str) -> list[str]:
    """Lowercase, stopword-filtered, stemmed tokens.

    Hyphenated terms also yield a joined variant, so "check-in" produces check,
    in, checkin -- the document matches whether the guest writes "check in",
    "check-in" or "checkin".
    """
    # "4pm" -> "4", "pm": the document writes times as "2:00 PM", so without
    # this split a guest's "4pm" is a word the corpus has never seen.
    lowered = re.sub(r"\b(\d{1,2})\s*(am|pm)\b", r"\1 \2", text.lower())
    tokens = [stem(t) for t in _WORD.findall(lowered) if t not in STOPWORDS]
    for joined in re.findall(r"[a-z]+(?:-[a-z]+)+", lowered):
        collapsed = joined.replace("-", "")
        if collapsed not in STOPWORDS:
            tokens.append(stem(collapsed))
    return tokens


def expand_query(query: str) -> list[str]:
    """Tokenize a guest question and add the document's own vocabulary."""
    tokens = tokenize(query)
    lowered = query.lower()
    for pattern, additions in ALIASES.items():
        if re.search(pattern, lowered):
            tokens.extend(stem(a) for a in additions)
    return tokens


@dataclass
class Hit:
    chunk: Chunk
    score: float


class Retriever:
    """BM25 over the knowledge base chunks."""

    def __init__(self, chunks: list[Chunk]) -> None:
        self.chunks = chunks
        self._docs = [tokenize(c.text) for c in chunks]
        self._freqs = [Counter(d) for d in self._docs]
        self._lengths = [len(d) for d in self._docs]
        self._avg_len = (sum(self._lengths) / len(self._lengths)) if self._lengths else 0.0

        df: Counter[str] = Counter()
        for doc in self._docs:
            df.update(set(doc))
        total = len(self._docs)
        self._idf = {
            term: math.log(1 + (total - count + 0.5) / (count + 0.5))
            for term, count in df.items()
        }

    def score(self, tokens: list[str], index: int) -> float:
        freqs = self._freqs[index]
        length = self._lengths[index]
        norm = K1 * (1 - B + B * (length / self._avg_len if self._avg_len else 1))
        total = 0.0
        # Counter() over query tokens: an alias repeated by two patterns should
        # not double-count, but a term the guest genuinely repeated should.
        for term, qf in Counter(tokens).items():
            f = freqs.get(term, 0)
            if not f:
                continue
            total += self._idf.get(term, 0.0) * (f * (K1 + 1)) / (f + norm) * min(qf, 2)
        return total

    def unknown_ratio(self, query: str) -> float:
        """Share of the question's content words the document has never heard of.

        This is the signal that separates "the document doesn't cover this"
        from "the document covers this in different words". BM25 score alone
        cannot: "can I get a helicopter transfer" scores as high as a good
        question, because "transfer" matches strongly while "helicopter" -- the
        word that actually decides the answer -- contributes nothing.

        A word counts as known if it appears in the corpus or if one of the
        alias expansions it triggers does, so "gym" is known via "fitness" and
        "free" via "complimentary".
        """
        terms = set(tokenize(query))
        if not terms:
            return 0.0

        unknown = 0
        for term in terms:
            if term in self._idf:
                continue
            aliased = any(
                re.search(pattern, term)
                and any(stem(addition) in self._idf for addition in additions)
                for pattern, additions in ALIASES.items()
            )
            if not aliased:
                unknown += 1
        return unknown / len(terms)

    def search(self, query: str, k: int = 5) -> list[Hit]:
        tokens = expand_query(query)
        if not tokens:
            return []

        lowered = query.lower()
        hits: list[Hit] = []
        for i, chunk in enumerate(self.chunks):
            score = self.score(tokens, i)
            if score <= 0:
                continue
            # A contiguous phrase from the question appearing verbatim is much
            # stronger evidence than the same words scattered across a chunk.
            score += 1.5 * _phrase_overlap(lowered, chunk.text.lower())
            hits.append(Hit(chunk=chunk, score=score))

        hits.sort(key=lambda h: h.score, reverse=True)
        return hits[:k]


def _phrase_overlap(query: str, text: str) -> int:
    """Count query bigrams that appear verbatim in the chunk."""
    words = [w for w in _WORD.findall(query) if w not in STOPWORDS]
    return sum(1 for a, b in zip(words, words[1:]) if f"{a} {b}" in text)
