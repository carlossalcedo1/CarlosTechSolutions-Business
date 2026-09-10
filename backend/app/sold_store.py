"""Sold-state store.

A device that sells is gone, not decremented (see the `Item` model
docstring), so this store only ever tracks two things:

- which item ids are sold
- which Stripe event ids have already been processed, so a retried webhook
  delivery (Stripe does retry) can't fire the "sold" emails twice

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
            self._write({"sold_item_ids": [], "processed_event_ids": []})

    def _read(self) -> dict:
        return json.loads(self._path.read_text())

    def _write(self, data: dict) -> None:
        # Write-then-rename so a crash mid-write can't leave a half-written,
        # unparseable file behind.
        tmp = self._path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, indent=2) + "\n")
        tmp.replace(self._path)

    def is_sold(self, item_id: str) -> bool:
        with self._lock:
            return item_id in self._read()["sold_item_ids"]

    def sold_ids(self) -> list[str]:
        with self._lock:
            return list(self._read()["sold_item_ids"])

    def mark_sold(self, item_id: str) -> None:
        with self._lock:
            data = self._read()
            if item_id not in data["sold_item_ids"]:
                data["sold_item_ids"].append(item_id)
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
