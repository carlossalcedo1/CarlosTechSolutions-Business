"""Stripe checkout session creation and webhook verification.

Two rules matter more than anything else in this file — see
LAUNCH_CHECKLIST.md Phase 1:

1. **Never trust a price from the browser.** `create_checkout_session` takes
   an `Item` looked up server-side by id; nothing here ever reads a price
   off the request.
2. **The webhook needs the *raw* request body.** Stripe's signature is
   computed over the exact bytes it sent. `verify_webhook` must be called
   with those raw bytes — main.py reads `await request.body()` before any
   JSON parsing happens, on purpose.
"""

from __future__ import annotations

import stripe

from .config import Settings
from .models import Item


def create_checkout_session(*, item: Item, settings: Settings) -> stripe.checkout.Session:
    stripe.api_key = settings.stripe_secret_key
    return stripe.checkout.Session.create(
        mode="payment",
        line_items=[
            {
                "price_data": {
                    "currency": "usd",
                    "unit_amount": item.priceCents,
                    "product_data": {
                        "name": item.name,
                        "description": item.specLine,
                    },
                },
                "quantity": 1,
            }
        ],
        shipping_address_collection={"allowed_countries": ["US"]},
        shipping_options=[
            {"shipping_rate": "shr_1UGUBbGR61TDWfEVsaOxjWmh"},
            # Stripe has no separate "local pickup" object — it's just a
            # fixed_amount shipping rate at $0, defined inline so it needs no
            # dashboard entry or ID.
            {
                "shipping_rate_data": {
                    "type": "fixed_amount",
                    "fixed_amount": {"amount": 0, "currency": "usd"},
                    "display_name": "Local Pickup (Free)",
                }
            },
        ],
        allow_promotion_codes=True,
        # Read back in the webhook to know which item to mark sold — never
        # trust anything the client could have sent instead.
        metadata={"item_id": item.id},
        success_url=f"{settings.site_url}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{settings.site_url}/checkout/cancelled",
    )


def verify_webhook(*, payload: bytes, sig_header: str, settings: Settings) -> stripe.Event:
    return stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)
