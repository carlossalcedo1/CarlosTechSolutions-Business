"""Code-only listings: private items reachable only by a short code.

For a sale arranged elsewhere (eBay, Marketplace, a text thread) where the
buyer should pay through this site's Stripe checkout instead. `scripts/
gen_code.py` creates one: the item details, a price, and a 4-character code
that expires after a set number of days (default
DEFAULT_LIFETIME_DAYS). The buyer types the code (or opens
/code/<CODE>), sees the listing, and checks out like any other item.

Deliberately NOT in items.json: the catalog is baked into the frontend build
and the API image, so anything there is public and needs a deploy to change.
Codes live in their own JSON file on the API's data volume (next to
sold_state.json), read fresh on every request, so a new code works the
moment it's written — no deploy.

One code, one item, one sale. Every code ever made stays in the file —
sold, expired, and cancelled included — as the record of what was offered
to whom and at what price; nothing is ever deleted.

Also a tiny CLI, run inside the API container by gen_code.py (that's where
the file lives):

    python -m backend.app.codes add [DAYS] < listing.json   # prints the new code
    python -m backend.app.codes list
    python -m backend.app.codes cancel K7PX
"""

from __future__ import annotations

import datetime as dt
import json
import secrets
import sys
import threading
from pathlib import Path

from pydantic import BaseModel, Field

from .models import Condition

# No 0/O, 1/I/L: a code gets read off a phone screen and typed on another,
# so characters that look alike are never generated. Codes are matched
# case-insensitively (stored uppercase), so this is the whole alphabet:
# 31 symbols, 31**4 ≈ 920k codes. That's small enough to guess at, which is
# why lookups are rate-limited (main.py) and codes expire.
CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 4
DEFAULT_LIFETIME_DAYS = 7
MAX_LIFETIME_DAYS = 365


def normalize_code(raw: str) -> str:
    return "".join(ch for ch in raw.upper() if ch.isalnum())


class CodeItem(BaseModel):
    """The listing a code points at. Same public fields as a catalog `Item`
    (models.py) minus what only matters to the shop grid — category,
    quantity, featured, dateAdded — so the product page and both sale
    emails can render either one."""

    model_config = {"extra": "forbid"}

    id: str = Field(min_length=1)
    inventoryId: str = Field(min_length=1)
    name: str = Field(min_length=1)
    brand: str = Field(min_length=1)
    model: str = Field(min_length=1)
    storage: str = Field(min_length=1)
    condition: Condition
    priceCents: int = Field(gt=0)
    specLine: str = Field(min_length=1)
    specs: list[str]
    description: str
    images: list[str]

    @property
    def price_display(self) -> str:
        dollars = self.priceCents / 100
        return f"${dollars:.0f}" if self.priceCents % 100 == 0 else f"${dollars:.2f}"


class CodeRecord(BaseModel):
    code: str
    item: CodeItem
    createdAt: dt.datetime
    expiresAt: dt.datetime
    # "active" | "sold" | "cancelled". Expiry isn't stored — it's derived
    # from expiresAt (see `status`), so there's no sweep job to forget.
    state: str = "active"
    soldAt: dt.datetime | None = None
    checkoutSessionId: str | None = None

    @property
    def status(self) -> str:
        if self.state == "active" and dt.datetime.now(dt.timezone.utc) >= self.expiresAt:
            return "expired"
        return self.state


class CodeStore:
    """Same shape as SoldStore: JSON on disk, write-then-rename, one lock.
    Read fresh on every call so codes added by the CLI (a separate
    process) are visible to the running API immediately."""

    def __init__(self, path: Path):
        self._path = path
        self._lock = threading.Lock()
        self._path.parent.mkdir(parents=True, exist_ok=True)
        if not self._path.exists():
            self._write({})

    def _read(self) -> dict[str, CodeRecord]:
        raw = json.loads(self._path.read_text())
        return {code: CodeRecord.model_validate(rec) for code, rec in raw.items()}

    def _write(self, records: dict[str, CodeRecord]) -> None:
        payload = {code: rec.model_dump(mode="json") for code, rec in records.items()}
        tmp = self._path.with_suffix(".tmp")
        tmp.write_text(json.dumps(payload, indent=2) + "\n")
        tmp.replace(self._path)

    def get(self, raw_code: str) -> CodeRecord | None:
        code = normalize_code(raw_code)
        with self._lock:
            return self._read().get(code)

    def all(self) -> list[CodeRecord]:
        with self._lock:
            return sorted(self._read().values(), key=lambda r: r.createdAt)

    def create(self, item_fields: dict, *, days: int = DEFAULT_LIFETIME_DAYS) -> CodeRecord:
        """`item_fields` is a full CodeItem. Its id is chosen by the caller
        (gen_code.py), not derived from the code, because the photos are
        already in /items/<id>/ by the time a code exists — and an id
        unrelated to the code keeps the photo URLs from being guessable
        from it. `days` is how long until it expires."""
        if not 1 <= days <= MAX_LIFETIME_DAYS:
            raise ValueError(f"days must be 1-{MAX_LIFETIME_DAYS}")
        with self._lock:
            records = self._read()
            # Never reuse a code, even an expired or sold one — an old link
            # still sitting in someone's messages must not open a new item.
            while True:
                code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
                if code not in records:
                    break
            now = dt.datetime.now(dt.timezone.utc)
            record = CodeRecord(
                code=code,
                item=CodeItem(**item_fields),
                createdAt=now,
                expiresAt=now + dt.timedelta(days=days),
            )
            records[code] = record
            self._write(records)
            return record

    def mark_sold(self, raw_code: str, *, session_id: str | None) -> CodeRecord | None:
        code = normalize_code(raw_code)
        with self._lock:
            records = self._read()
            record = records.get(code)
            if record is None:
                return None
            record.state = "sold"
            record.soldAt = dt.datetime.now(dt.timezone.utc)
            record.checkoutSessionId = session_id
            self._write(records)
            return record

    def cancel(self, raw_code: str) -> CodeRecord | None:
        code = normalize_code(raw_code)
        with self._lock:
            records = self._read()
            record = records.get(code)
            if record is None or record.status != "active":
                return record
            record.state = "cancelled"
            self._write(records)
            return record


def _cli(argv: list[str]) -> int:
    from .config import get_settings

    store = CodeStore(get_settings().codes_path)
    command = argv[0] if argv else ""

    if command == "add":
        days = int(argv[1]) if len(argv) > 1 else DEFAULT_LIFETIME_DAYS
        record = store.create(json.loads(sys.stdin.read()), days=days)
        print(json.dumps({"code": record.code, "expiresAt": record.expiresAt.isoformat()}))
        return 0

    if command == "list":
        print(json.dumps([
            {
                "code": r.code,
                "name": r.item.name,
                "price": r.item.price_display,
                "status": r.status,
                "expiresAt": r.expiresAt.isoformat(),
            }
            for r in store.all()
        ]))
        return 0

    if command == "cancel" and len(argv) == 2:
        record = store.cancel(argv[1])
        if record is None:
            print(json.dumps({"error": "no such code"}))
            return 1
        print(json.dumps({"code": record.code, "status": record.status}))
        return 0

    print("usage: python -m backend.app.codes add [DAYS]|list|cancel CODE", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(_cli(sys.argv[1:]))
