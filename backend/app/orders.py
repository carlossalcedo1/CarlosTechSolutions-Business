"""Paid orders, and what's happened to them since: shipped, tracking.

Until this existed nothing kept an order. The Stripe webhook had the whole
thing — buyer, amount, address — used it for two emails and a push, and
dropped it; only a "units sold" count survived. That's enough to stop a
sold item selling twice, and not enough to answer "what still needs to go
out?". This is the record that answers it.

Same shape as every other store here: JSON on the data volume, one lock,
write-then-rename. Orders are written by the webhook and read by the admin
panel, both inside the API container, so — unlike the catalog — this works
on the live server with nothing extra to wire up.

History starts when this was deployed. Earlier orders are in Stripe and in
the sale-alert emails, not here.
"""

from __future__ import annotations

import json
import re
import threading
import time
from pathlib import Path
from urllib.parse import quote

# USPS numbers come in a few shapes — 20-22 digits domestic, or two letters,
# nine digits and "US" for international — and people paste them with spaces
# from a label. Checked loosely: wrong-length typos are what this catches,
# not an exhaustive USPS format spec that would reject a valid new one.
_TRACKING_RE = re.compile(r"^[A-Z0-9]{8,40}$")


def normalize_tracking(raw: str) -> str:
    """Spaces and dashes out, uppercased — the form a label prints in groups
    of four is the same number USPS wants run together."""
    return re.sub(r"[\s-]+", "", raw).upper()


def validate_tracking(raw: str) -> str:
    number = normalize_tracking(raw)
    if not _TRACKING_RE.fullmatch(number):
        raise ValueError(
            "That doesn't look like a tracking number — letters and digits only, 8 to 40 of them."
        )
    return number


def usps_tracking_url(number: str) -> str:
    return f"https://tools.usps.com/go/TrackConfirmAction?tLabels={quote(number)}"


def order_from_session(session: dict, item, code: str | None) -> dict:
    """The order as recorded: a snapshot, not a reference.

    The item's name and the buyer's details are copied in rather than looked
    up later, because by the time you're shipping it the listing may be gone
    from the catalog — that's what selling it does.
    """
    details = session.get("customer_details") or {}
    shipping = (
        session.get("shipping_details")
        or (session.get("collected_information") or {}).get("shipping_details")
        or {}
    )
    return {
        "id": session.get("id"),
        # Stripe's own timestamp when it has one: a retried delivery hours
        # later shouldn't make an old order look new.
        "createdAt": float(session.get("created") or time.time()),
        "itemId": getattr(item, "id", None),
        "itemName": getattr(item, "name", None),
        "code": code,
        "customerName": details.get("name") or shipping.get("name"),
        "customerEmail": details.get("email"),
        "amountCents": session.get("amount_total"),
        "currency": session.get("currency") or "usd",
        "shippingName": shipping.get("name"),
        "shippingAddress": shipping.get("address"),
        "paymentIntent": session.get("payment_intent"),
        "shippedAt": None,
        "trackingNumber": None,
    }


def public_view(order: dict) -> dict:
    """What the panel gets: the order plus what's derived from it, so the
    rule for "shipped" and the USPS link format live here once."""
    view = dict(order)
    view["status"] = "shipped" if order.get("shippedAt") else "paid"
    number = order.get("trackingNumber")
    view["trackingUrl"] = usps_tracking_url(number) if number else None
    return view


class OrderStore:
    def __init__(self, path: Path):
        self._path = path
        self._lock = threading.Lock()
        self._path.parent.mkdir(parents=True, exist_ok=True)
        if not self._path.exists():
            self._write({"orders": {}})

    def _read(self) -> dict:
        return json.loads(self._path.read_text())

    def _write(self, data: dict) -> None:
        tmp = self._path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, indent=2) + "\n")
        tmp.replace(self._path)

    def record(self, order: dict) -> dict:
        """Add an order, unless it's already here.

        An existing order is left exactly as it is. Stripe retries webhook
        deliveries, sometimes days later, and overwriting on a retry would
        quietly reset an order you'd already marked shipped back to unshipped
        — and drop its tracking number with it.
        """
        if not order.get("id"):
            raise ValueError("an order needs the checkout session id")
        with self._lock:
            data = self._read()
            orders = data.setdefault("orders", {})
            if order["id"] not in orders:
                orders[order["id"]] = order
                self._write(data)
            return orders[order["id"]]

    def get(self, order_id: str) -> dict | None:
        with self._lock:
            return self._read().get("orders", {}).get(order_id)

    def all_newest_first(self) -> list[dict]:
        with self._lock:
            orders = list(self._read().get("orders", {}).values())
        return sorted(orders, key=lambda o: o.get("createdAt") or 0, reverse=True)

    def _update(self, order_id: str, **changes) -> dict | None:
        with self._lock:
            data = self._read()
            order = data.get("orders", {}).get(order_id)
            if order is None:
                return None
            order.update(changes)
            self._write(data)
            return order

    def mark_shipped(self, order_id: str) -> dict | None:
        """Idempotent: marking it again keeps the original ship time."""
        order = self.get(order_id)
        if order is None:
            return None
        if order.get("shippedAt"):
            return order
        return self._update(order_id, shippedAt=time.time())

    def set_tracking(self, order_id: str, number: str) -> dict | None:
        """Adding a tracking number means it's shipped, so it marks it shipped
        too — keeping the original time if it already was."""
        order = self.get(order_id)
        if order is None:
            return None
        return self._update(
            order_id,
            trackingNumber=number,
            shippedAt=order.get("shippedAt") or time.time(),
        )
