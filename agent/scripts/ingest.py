"""Build the knowledge index from the source PDF.

    python -m scripts.ingest

The service falls back to parsing the PDF at startup when no index exists, so
this is an optimisation and an inspection tool rather than a required step --
run it after editing the PDF, or to eyeball what was extracted.
"""

from __future__ import annotations

import sys

from app import config
from app.ingest import build, save


def main() -> int:
    if not config.PDF_PATH.exists():
        print(f"Source PDF not found: {config.PDF_PATH}", file=sys.stderr)
        return 1

    kb = build(config.PDF_PATH)
    save(kb, config.INDEX_PATH)

    print(f"Parsed {config.PDF_PATH.name}")
    print(f"  chunks     {len(kb.chunks)}")
    print(f"  rooms      {len(kb.rooms)}")
    print(f"  facilities {len(kb.facilities)}")
    print(f"  FAQs       {len(kb.faqs)}")
    print(f"  overview   {len(kb.overview)} fields")
    print(f"Wrote {config.INDEX_PATH}")

    if not kb.rooms or not kb.faqs:
        print("Warning: expected room and FAQ records; check the PDF layout.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
