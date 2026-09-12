"""Runtime configuration, read once at import."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# agent/app/config.py -> agent/
AGENT_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = AGENT_ROOT.parent

load_dotenv(AGENT_ROOT / ".env")


def _path(name: str, fallback: str) -> Path:
    """Resolve a configured path against the agent directory, not the CWD.

    The service is started from several places (agent/, repo root, a compose
    file), and a CWD-relative knowledge base would silently fail in some of
    them and load in others.
    """
    raw = os.getenv(name, "").strip() or fallback
    candidate = Path(raw)
    return candidate if candidate.is_absolute() else (AGENT_ROOT / candidate).resolve()


def _float(name: str, fallback: float) -> float:
    raw = os.getenv(name, "").strip()
    try:
        return float(raw) if raw else fallback
    except ValueError:
        return fallback


def _int(name: str, fallback: int) -> int:
    raw = os.getenv(name, "").strip()
    try:
        return int(raw) if raw else fallback
    except ValueError:
        return fallback


HOST = os.getenv("AGENT_HOST", "").strip() or "0.0.0.0"
PORT = _int("AGENT_PORT", 8001)

PDF_PATH = _path("KB_PDF_PATH", "../AROHAK_Hotel_Information_For_RAG.pdf")
INDEX_PATH = _path("KB_INDEX_PATH", "data/index.json")

# Empty disables live lookups; the agent then answers from the document alone
# and says so when a question needs live inventory.
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:4000").strip().rstrip("/")
BACKEND_TIMEOUT = _float("BACKEND_TIMEOUT_SECONDS", 5.0)

# Retrieval score below which the bot refuses rather than guessing. Tuned
# against tests/test_agent.py; raising it makes the bot more tight-lipped.
MIN_SCORE = _float("MIN_SCORE", 2.5)
