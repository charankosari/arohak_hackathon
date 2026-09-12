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
    r"\bcancel\w*\b|\brefunds?\b": ("cancel", "cancellation", "booking"),
    r"\bairports?\b|\btransfers?\b|\bpick ?-? ?ups?\b|\btaxis?\b|\bcabs?\b|\bshuttles?\b": (
        "airport", "transfer", "concierge",
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


def tokenize(text: str) -> list[str]:
    """Lowercase word tokens, with a joined variant for hyphenated terms.

    "check-in" yields check, in, checkin -- so the document matches whether the
    guest writes "check in", "check-in" or "checkin".
    """
    lowered = text.lower()
    tokens = [t for t in _WORD.findall(lowered) if t not in STOPWORDS]
    for joined in re.findall(r"[a-z]+(?:-[a-z]+)+", lowered):
        collapsed = joined.replace("-", "")
        if collapsed not in STOPWORDS:
            tokens.append(collapsed)
    return tokens


def expand_query(query: str) -> list[str]:
    """Tokenize a guest question and add the document's own vocabulary."""
    tokens = tokenize(query)
    lowered = query.lower()
    for pattern, additions in ALIASES.items():
        if re.search(pattern, lowered):
            tokens.extend(additions)
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
