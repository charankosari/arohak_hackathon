"""FastAPI service exposing the hotel RAG chatbot.

Started by uvicorn (see README). The Express API is the intended caller --
it proxies /api/chat here -- but the endpoints are plain JSON and can be
exercised directly with curl while developing.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from datetime import date

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import config
from .answering import Answerer
from .ingest import load
from .live import LiveBackend
from .retrieval import Retriever

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("agent")

state: dict[str, object] = {}


@asynccontextmanager
async def lifespan(_: FastAPI):
    kb = load(config.INDEX_PATH, config.PDF_PATH)
    state["kb"] = kb
    state["answerer"] = Answerer(kb, LiveBackend())
    state["retriever"] = Retriever(kb.chunks)
    log.info(
        "knowledge base ready: %d chunks, %d rooms, %d FAQs (source: %s)",
        len(kb.chunks), len(kb.rooms), len(kb.faqs), kb.source or config.PDF_PATH.name,
    )
    yield
    state.clear()


app = FastAPI(
    title="Meridian Grand RAG Agent",
    version="1.0.0",
    description=(
        "Retrieval-augmented hotel assistant grounded in "
        "AROHAK_Hotel_Information_For_RAG.pdf, with live availability from the "
        "booking API. No language model is used."
    ),
    lifespan=lifespan,
)

# The Express API is the normal caller, but allowing the Next.js origin keeps
# the door open for the browser to talk to the agent directly.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:4000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Turn(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    history: list[Turn] = Field(default_factory=list, max_length=20)
    # Test hook: pins "tomorrow" so date-dependent assertions stay stable.
    today: date | None = None


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=1000)
    k: int = Field(default=5, ge=1, le=20)


def _previous_question(history: list[Turn]) -> str | None:
    """The last thing the guest asked, used only as a fallback for a terse
    follow-up that cannot be answered on its own ("and the spa?").

    Without a language model there is no coreference resolution, so the agent
    tries the message standalone first and reaches for this only if that fails.
    """
    return next((t.content for t in reversed(history) if t.role == "user"), None)


@app.get("/health")
async def health() -> dict:
    kb = state.get("kb")
    backend = LiveBackend()
    return {
        "status": "ok" if kb else "starting",
        "knowledgeBase": {
            "source": getattr(kb, "source", None),
            "chunks": len(getattr(kb, "chunks", [])),
            "rooms": len(getattr(kb, "rooms", [])),
            "faqs": len(getattr(kb, "faqs", [])),
        },
        "liveBackend": {
            "configured": backend.enabled,
            "url": backend.base_url or None,
            "reachable": await backend.health() if backend.enabled else False,
        },
    }


@app.post("/chat")
async def chat(request: ChatRequest) -> dict:
    answerer: Answerer = state["answerer"]  # type: ignore[assignment]
    message = request.message.strip()
    result = await answerer.answer(
        message, today=request.today, context=_previous_question(request.history)
    )
    return {"question": message, **result.to_dict()}


@app.post("/search")
async def search(request: SearchRequest) -> dict:
    """Raw retrieval output -- useful for demoing and tuning what the bot sees."""
    retriever: Retriever = state["retriever"]  # type: ignore[assignment]
    hits = retriever.search(request.query, k=request.k)
    return {
        "query": request.query,
        "hits": [
            {
                "score": round(h.score, 3),
                "citation": h.chunk.citation,
                "kind": h.chunk.kind,
                "text": h.chunk.text,
            }
            for h in hits
        ],
    }


@app.get("/knowledge")
async def knowledge() -> dict:
    """What the bot knows, for the UI and for verifying ingestion."""
    kb = state["kb"]
    return {
        "source": kb.source,  # type: ignore[union-attr]
        "overview": kb.overview,  # type: ignore[union-attr]
        "rooms": [r.__dict__ for r in kb.rooms],  # type: ignore[union-attr]
        "facilities": [f.__dict__ for f in kb.facilities],  # type: ignore[union-attr]
        "faqs": [f.__dict__ for f in kb.faqs],  # type: ignore[union-attr]
    }
