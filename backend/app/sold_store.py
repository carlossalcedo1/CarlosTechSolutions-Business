"""Sold-state store.

Tracks, per item id, how many units have sold — not a boolean, since an
`Item` can carry a `quantity` above 1 and should stay listed, at a lower
remaining count, until every unit is gone. Also tracks which Stripe event
ids have already been processed, so a retried webhook delivery (Stripe does
retry) can't record the same sale twice.

Deliberately just JSON on disk, per LAUNCH_CHECKLIST.md Phase 1 — this is a
single-container deploy with one writer. If this ever needs concurrent
writers, multiple API replicas, or more than a few hundred items, that's the
signal to move to SQLite, not before.
"""

from __future__ import annotations

import json
import threading
from pathlib import Path


class SoldStore:
    def __init__(self, path: Path):
        self._path = path
        self._lock = threading.Lock()
        self._path.parent.mkdir(parents=True, exist_ok=True)
        if not self._path.exists():
            self._write({"sold_counts": {}, "processed_event_ids": []})
        else:
            self._migrate_if_needed()

    def _migrate_if_needed(self) -> None:
        # Older stores recorded sold-ness as a flat list of ids, back when
        # every item's quantity was implicitly 1 and a checkout always buys
        # exactly 1 unit (see payments.py) — so each id in that list is
        # exactly one sold unit under the new counted scheme.
        with self._lock:
            data = self._read()
            if "sold_counts" not in data:
                old_ids = data.pop("sold_item_ids", [])
                data["sold_counts"] = {item_id: 1 for item_id in old_ids}
                self._write(data)

    def _read(self) -> dict:
        return json.loads(self._path.read_text())

    def _write(self, data: dict) -> None:
        # Write-then-rename so a crash mid-write can't leave a half-written,
        # unparseable file behind.
        tmp = self._path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, indent=2) + "\n")
        tmp.replace(self._path)

    def units_sold(self, item_id: str) -> int:
        with self._lock:
            return self._read()["sold_counts"].get(item_id, 0)

    def record_sale(self, item_id: str) -> None:
        with self._lock:
            data = self._read()
            data["sold_counts"][item_id] = data["sold_counts"].get(item_id, 0) + 1
            self._write(data)

    def already_processed(self, event_id: str) -> bool:
        with self._lock:
            return event_id in self._read()["processed_event_ids"]

    def mark_processed(self, event_id: str) -> None:
        with self._lock:
            data = self._read()
            if event_id not in data["processed_event_ids"]:
                data["processed_event_ids"].append(event_id)
                self._write(data)
