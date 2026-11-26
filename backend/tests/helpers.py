"""Builders shared by the test modules.

Separate from conftest.py on purpose: conftest holds fixtures, and pytest
doesn't mean for it to be imported by name. These are plain functions, so
they live somewhere importable.
"""

from __future__ import annotations

from backend.app.codes import CodeItem
from backend.app.models import Item


# Enough to build either an Item or a CodeItem — CodeItem is the same public
# fields minus the shop-grid-only ones (category, quantity, featured,
# dateAdded), so the overlap lives here once.
ITEM_FIELDS = {
    "inventoryId": "CTS-0142",
    "name": "iPad Air (4th gen)",
    "brand": "Apple",
    "model": "iPad Air 4",
    "storage": "64GB",
    "condition": "A+ - Excellent",
    "priceCents": 32900,
    "specLine": "10.9-inch · 64GB · Wi-Fi",
    "specs": ["A14 Bionic", "64GB storage", "Wi-Fi"],
    "description": "Clean iPad Air, no scratches.",
    "images": ["/items/ipad-air/1.jpg"],
}


def make_item(item_id: str = "ipad-air", *, quantity: int = 1, **overrides) -> Item:
    return Item(
        id=item_id,
        category="Tablets",
        quantity=quantity,
        featured=False,
        dateAdded="2026-11-20",
        **{**ITEM_FIELDS, **overrides},
    )


def make_code_item(item_id: str = "ipad-air", **overrides) -> CodeItem:
    return CodeItem(id=item_id, **{**ITEM_FIELDS, **overrides})


class FakeStripeObject:
    """Stands in for a stripe.Event's nested object. main.py calls .to_dict()
    on it (stripe's objects support bracket access but not .get()), so that
    one method is the whole contract."""

    def __init__(self, data: dict):
        self._data = data

    def to_dict(self) -> dict:
        return self._data


def make_session(**overrides) -> dict:
    """A checkout.session.completed object, shaped like the real thing.

    Shipping goes under `collected_information`, which is where newer Stripe
    API versions put it — emails.py reads both that and the older
    top-level `shipping_details`.
    """
    session = {
        "id": "cs_test_default",
        "amount_total": 32900,
        "currency": "usd",
        "payment_status": "paid",
        "payment_intent": "pi_test_123",
        "metadata": {"item_id": "ipad-air"},
        "customer_details": {
            "name": "Dana Reyes",
            "email": "dana@example.com",
            "phone": None,
        },
        "collected_information": {
            "shipping_details": {
                "name": "Dana Reyes",
                "address": {
                    "line1": "118 SW 12th St",
                    "line2": "Apt 4",
                    "city": "Gainesville",
                    "state": "FL",
                    "postal_code": "32601",
                    "country": "US",
                },
            }
        },
    }
    session.update(overrides)
    return session


def make_event(session: dict, *, event_id: str = "evt_test_1", event_type: str = "checkout.session.completed") -> dict:
    return {
        "id": event_id,
        "type": event_type,
        "data": {"object": FakeStripeObject(session)},
    }
