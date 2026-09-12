"""Read-only client for the Express API.

PDF section 12: "Booking availability and actual booking actions should come
from the application's live backend data, not from this PDF." So availability
and real inventory are fetched here, while policies stay grounded in the
document.

Every call degrades to None rather than raising. The backend being down should
cost the guest the live answer, not the whole conversation -- the caller falls
back to the document and says which one it used.
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Any

import httpx

from . import config

log = logging.getLogger(__name__)

# Read-only endpoints only. The agent never books, cancels or modifies -- those
# carry auth and money, and belong in an explicit user action in the UI.
_ROOMS_AVAILABILITY = "/api/rooms/availability"
_ROOM_TYPES = "/api/rooms/types"


class LiveBackend:
    def __init__(self, base_url: str = "", timeout: float | None = None) -> None:
        self.base_url = (base_url or config.BACKEND_URL).rstrip("/")
        self.timeout = timeout if timeout is not None else config.BACKEND_TIMEOUT

    @property
    def enabled(self) -> bool:
        return bool(self.base_url)

    async def _get(self, path: str, params: dict[str, Any] | None = None) -> Any | None:
        if not self.enabled:
            return None
        url = f"{self.base_url}{path}"
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url, params=params)
            if response.status_code >= 400:
                # A 400 here is usually a stay the API rejects (past date, too
                # long). That is information, not a crash: log and fall back.
                log.info("live backend %s -> %s: %s", path, response.status_code, response.text[:200])
                return None
            return response.json()
        except (httpx.HTTPError, ValueError) as exc:
            log.warning("live backend %s unreachable: %s", path, exc)
            return None

    async def health(self) -> bool:
        return await self._get("/health") is not None

    async def search_availability(
        self,
        check_in: date,
        check_out: date,
        guests: int = 1,
        room_type: str | None = None,
    ) -> dict | None:
        params: dict[str, Any] = {
            "checkIn": check_in.isoformat(),
            "checkOut": check_out.isoformat(),
            "guests": guests,
        }
        if room_type:
            params["roomType"] = room_type
        return await self._get(_ROOMS_AVAILABILITY, params)

    async def room_types(self) -> dict | None:
        return await self._get(_ROOM_TYPES)
