"""Packages being tracked: orders you've shipped, and parts on their way
to you.

Same shape as the other stores — JSON on the data volume, one lock,
write-then-rename. Status arrives from Shippo (app/shippo.py) when a number
is registered and then by webhook; this just keeps the latest of it.
"""

from __future__ import annotations

import json
import secrets
import threading
import time
from pathlib import Path


def month_key(now: float | None = None) -> str:
    return time.strftime("%Y-%m", time.gmtime(now if now is not None else time.time()))


def _place(location: dict | None) -> str:
    if not location:
        return ""
    city, state = location.get("city") or "", location.get("state") or ""
    return ", ".join(part for part in (city, state) if part)


class PackageStore:
    def __init__(self, path: Path):
        self._path = path
        self._lock = threading.Lock()
        self._path.parent.mkdir(parents=True, exist_ok=True)
        if not self._path.exists():
            self._write({"packages": {}, "registrations": {}})

    def _read(self) -> dict:
        data = json.loads(self._path.read_text())
        data.setdefault("packages", {})
        data.setdefault("registrations", {})
        return data

    def _write(self, data: dict) -> None:
        tmp = self._path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, indent=2) + "\n")
        tmp.replace(self._path)

    # --- reading ---------------------------------------------------------------

    def get(self, package_id: str) -> dict | None:
        with self._lock:
            return self._read()["packages"].get(package_id)

    def find_by_tracking(self, number: str) -> dict | None:
        with self._lock:
            for package in self._read()["packages"].values():
                if package["trackingNumber"] == number:
                    return package
        return None

    def all_newest_first(self) -> list[dict]:
        with self._lock:
            packages = list(self._read()["packages"].values())
        return sorted(packages, key=lambda p: p.get("createdAt") or 0, reverse=True)

    def registrations_this_month(self, now: float | None = None) -> int:
        """Kept as its own count rather than worked out from the packages,
        because deleting a package doesn't give back what registering it
        used."""
        with self._lock:
            return self._read()["registrations"].get(month_key(now), 0)

    # --- writing ---------------------------------------------------------------

    def add(
        self,
        number: str,
        label: str,
        kind: str,
        order_id: str | None = None,
        carrier: str = "usps",
    ) -> dict:
        """Add a package, or hand back the one already tracking this number —
        registering the same number twice would pay for it twice and get
        every update twice."""
        with self._lock:
            data = self._read()
            for package in data["packages"].values():
                if package["trackingNumber"] == number:
                    return package
            package = {
                "id": secrets.token_hex(6),
                "trackingNumber": number,
                "carrier": carrier,
                "label": label,
                "kind": kind,
                "orderId": order_id,
                "createdAt": time.time(),
                "registeredAt": None,
                "registerError": None,
                "status": None,
                "substatus": None,
                "statusDetails": None,
                "statusDate": None,
                "location": "",
                "updatedAt": None,
                "deliveredAt": None,
                "deliveredNotifiedAt": None,
            }
            data["packages"][package["id"]] = package
            self._write(data)
            return package

    def _update(self, package_id: str, **changes) -> dict | None:
        with self._lock:
            data = self._read()
            package = data["packages"].get(package_id)
            if package is None:
                return None
            package.update(changes)
            self._write(data)
            return package

    def delete(self, package_id: str) -> bool:
        with self._lock:
            data = self._read()
            if data["packages"].pop(package_id, None) is None:
                return False
            self._write(data)
            return True

    def mark_registered(self, package_id: str, now: float | None = None) -> dict | None:
        with self._lock:
            data = self._read()
            package = data["packages"].get(package_id)
            if package is None:
                return None
            key = month_key(now)
            data["registrations"][key] = data["registrations"].get(key, 0) + 1
            package["registeredAt"] = now if now is not None else time.time()
            package["registerError"] = None
            self._write(data)
            return package

    def mark_register_error(self, package_id: str, message: str) -> dict | None:
        return self._update(package_id, registerError=message)

    def mark_delivered_notified(self, package_id: str) -> dict | None:
        return self._update(package_id, deliveredNotifiedAt=time.time())

    def apply_track(self, package_id: str, track: dict) -> tuple[dict | None, bool]:
        """Take the latest status from a Shippo Track object. Returns the
        package and whether this update is the one that made it delivered."""
        status = track.get("tracking_status") or {}
        if not isinstance(status, dict) or not status.get("status"):
            return self.get(package_id), False
        substatus = status.get("substatus") or {}
        with self._lock:
            data = self._read()
            package = data["packages"].get(package_id)
            if package is None:
                return None, False
            was_delivered = package.get("status") == "DELIVERED"
            package.update(
                status=status.get("status"),
                substatus=substatus.get("code") if isinstance(substatus, dict) else None,
                statusDetails=status.get("status_details"),
                statusDate=status.get("status_date"),
                location=_place(status.get("location")),
                updatedAt=time.time(),
            )
            became_delivered = package["status"] == "DELIVERED" and not was_delivered
            if became_delivered:
                package["deliveredAt"] = time.time()
            self._write(data)
            return package, became_delivered
