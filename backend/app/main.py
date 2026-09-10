"""The API service: five public routes behind Caddy.

See LAUNCH_CHECKLIST.md Phase 1 for the full spec, and payments.py for the
two rules that matter most (never price from the browser; the webhook needs
the raw body).
"""

from __future__ import annotations

import html
import json
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from .catalog import load_catalog
from .config import Settings, get_settings
from .mailer import send_email
from .payments import create_checkout_session, verify_webhook
from .ratelimit import RateLimiter, client_ip
from .schemas import (
    CheckoutRequest,
    CheckoutResponse,
    ContactRequest,
    OkResponse,
    SubscribeRequest,
    TradeInRequest,
)
from .sold_store import SoldStore

logger = logging.getLogger("app.main")

# Shared across the three form endpoints, not one each — a bot hammering
# /api/subscribe shouldn't get three times the budget just by rotating
# which endpoint it hits.
_form_limiter = RateLimiter(max_requests=5, window_seconds=60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()

    # Loaded once, at boot, on purpose: a corrupt items.json should fail the
    # container's health check, not the first customer's checkout.
    items = load_catalog()
    app.state.catalog = {item.id: item for item in items}
    app.state.sold_store = SoldStore(settings.sold_state_path)
    logger.info("Loaded %d catalog items", len(items))
    yield


app = FastAPI(title="Carlos Tech Solutions API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    # Locked to the one real origin — see LAUNCH_CHECKLIST.md Phase 1. This
    # site is never embedded cross-origin, so there's no case for "*" here.
    allow_origins=[get_settings().site_url],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def _guard(request: Request) -> None:
    """Shared rate-limit check for the three public form endpoints."""
    _form_limiter.check(client_ip(request))


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/checkout", response_model=CheckoutResponse)
def checkout(body: CheckoutRequest, request: Request, settings: Settings = Depends(get_settings)):
    item = request.app.state.catalog.get(body.item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    if request.app.state.sold_store.is_sold(item.id):
        raise HTTPException(status_code=409, detail="This item has already sold")
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=500, detail="Stripe is not configured yet")

    session = create_checkout_session(item=item, settings=settings)
    return CheckoutResponse(url=session.url)


@app.post("/api/stripe-webhook")
async def stripe_webhook(request: Request, settings: Settings = Depends(get_settings)):
    # Rule 2 (payments.py / LAUNCH_CHECKLIST Phase 1): raw bytes, never
    # request.json(). Stripe signs the exact body it sent — re-serialized
    # JSON will not match and verification will fail every single time.
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = verify_webhook(payload=payload, sig_header=sig_header, settings=settings)
    except Exception:
        logger.exception("Stripe webhook signature verification failed")
        raise HTTPException(status_code=400, detail="Invalid signature")

    store = request.app.state.sold_store

    # Idempotency: Stripe retries deliveries, and will occasionally send the
    # same event twice. Without this, a retry means two "sold" emails.
    if store.already_processed(event["id"]):
        return {"received": True, "duplicate": True}

    if event["type"] == "checkout.session.completed":
        # .to_dict() on purpose: stripe.Event's nested objects support bracket
        # access but not .get() (they raise, telling you to convert) — easiest
        # to convert once here rather than bracket-access every field below.
        session = event["data"]["object"].to_dict()
        item_id = (session.get("metadata") or {}).get("item_id")
        item = request.app.state.catalog.get(item_id) if item_id else None

        if item is None:
            logger.warning("checkout.session.completed with unknown item_id=%r", item_id)
        else:
            store.mark_sold(item.id)

            buyer_email = (session.get("customer_details") or {}).get("email")
            if buyer_email:
                send_email(
                    settings,
                    to=buyer_email,
                    subject=f"Your order: {item.name}",
                    html=f"<p>Thanks for your order — {html.escape(item.name)} is confirmed. "
                    "You'll get a separate receipt from Stripe.</p>",
                )
            if settings.notify_email:
                send_email(
                    settings,
                    to=settings.notify_email,
                    subject=f"Sold: {item.name}",
                    html=f"<p>{html.escape(item.name)} ({item.id}) just sold for "
                    f"{item.price_display}.</p>",
                )

    store.mark_processed(event["id"])
    return {"received": True}


@app.post("/api/contact", response_model=OkResponse)
def contact(body: ContactRequest, request: Request, settings: Settings = Depends(get_settings)):
    _guard(request)
    if body.website:
        return OkResponse()  # honeypot tripped — pretend success, send nothing

    lines = [f"Name: {html.escape(body.name)}", f"Email: {html.escape(body.email)}"]
    if body.phone:
        lines.append(f"Phone: {html.escape(body.phone)}")
    if body.repair_type:
        lines.append(f"Repair type: {html.escape(body.repair_type)}")
    if body.device_brand:
        lines.append(f"Device brand: {html.escape(body.device_brand)}")
    if body.imei:
        lines.append(f"IMEI: {html.escape(body.imei)}")
    lines.append(f"Message: {html.escape(body.message)}")

    if settings.notify_email:
        send_email(
            settings,
            to=settings.notify_email,
            subject="New contact form submission",
            html="<p>" + "</p><p>".join(lines) + "</p>",
            reply_to=body.email,
        )
    return OkResponse()


@app.post("/api/trade-in", response_model=OkResponse)
def trade_in(body: TradeInRequest, request: Request, settings: Settings = Depends(get_settings)):
    _guard(request)
    if body.website:
        return OkResponse()

    lines = [f"Name: {html.escape(body.name)}", f"Email: {html.escape(body.email)}"]
    if body.phone:
        lines.append(f"Phone: {html.escape(body.phone)}")
    lines.append(f"Device: {html.escape(body.device_brand)} {html.escape(body.device_model)}")
    if body.condition:
        lines.append(f"Condition: {html.escape(body.condition)}")
    if body.imei:
        lines.append(f"IMEI: {html.escape(body.imei)}")
    if body.notes:
        lines.append(f"Notes: {html.escape(body.notes)}")

    if settings.notify_email:
        send_email(
            settings,
            to=settings.notify_email,
            subject="New trade-in submission",
            html="<p>" + "</p><p>".join(lines) + "</p>",
            reply_to=body.email,
        )
    return OkResponse()


@app.post("/api/subscribe", response_model=OkResponse)
def subscribe(body: SubscribeRequest, request: Request, settings: Settings = Depends(get_settings)):
    _guard(request)
    if body.website:
        return OkResponse()

    # Stretch goal (see LAUNCH_CHECKLIST.md): the real Resend Audience,
    # double opt-in, and unsubscribe handling come later. For now this only
    # has to actually persist the email and return a real success state
    # instead of the frontend faking one.
    path = settings.subscribers_path
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as f:
        f.write(json.dumps({"email": body.email}) + "\n")
    return OkResponse()
