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
from .codes import CodeStore, normalize_code
from .config import Settings, get_settings
from .emails import buyer_confirmation, sale_alert, sale_push
from .mailer import send_email
from .login_codes import LoginCodeStore, normalize_username
from .notifier import PushError, send_push, send_push_strict
from .passkeys import PasskeyStore
from .payments import create_checkout_session, verify_webhook
from .ratelimit import RateLimiter, client_ip
from .schemas import (
    AdminLoginRequest,
    AdminPasskeyRequest,
    AdminVerifyRequest,
    CheckoutRequest,
    CheckoutResponse,
    CodeLookupResponse,
    ContactRequest,
    OkResponse,
    SoldItemsResponse,
    SubscribeRequest,
    TradeInRequest,
)
from .sold_store import SoldStore

logger = logging.getLogger("app.main")

# Shared across the three form endpoints, not one each — a bot hammering
# /api/subscribe shouldn't get three times the budget just by rotating
# which endpoint it hits.
_form_limiter = RateLimiter(max_requests=5, window_seconds=60)

# Codes are short (see app/codes.py), so guessing is the threat: both the
# lookup and a code checkout spend from this one budget per IP. Generous
# enough for a buyer who mistypes a few times, far too slow to sweep ~920k
# codes before they expire.
_code_limiter = RateLimiter(max_requests=10, window_seconds=60)

# Admin sign-in, deliberately the tightest budget in the file. It guards two
# different things at once: the login route answers whether a username is an
# admin, so an open budget there is a free list of who to target; and the
# verify route is the only thing between a guesser and an 8-digit code. Five
# a minute is unmissable for a real person typing a code off their phone and
# nowhere near enough to sweep anything.
_admin_limiter = RateLimiter(max_requests=5, window_seconds=60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()

    # Loaded once, at boot, on purpose: a corrupt items.json should fail the
    # container's health check, not the first customer's checkout.
    items = load_catalog()
    app.state.catalog = {item.id: item for item in items}
    app.state.sold_store = SoldStore(settings.sold_state_path)
    app.state.code_store = CodeStore(settings.codes_path)
    app.state.login_code_store = LoginCodeStore(settings.login_codes_path)
    app.state.passkey_store = PasskeyStore(settings.passkeys_path)
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


@app.get("/api/sold-items", response_model=SoldItemsResponse)
def sold_items(request: Request):
    # Public and read-only on purpose: the frontend's catalog is a static
    # build (LAUNCH_CHECKLIST.md "Done" list), so it has no way to know a
    # sale happened since the last deploy without asking. This is the only
    # thing it asks for — which ids are sold, nothing else — so a listing
    # marked "Sold" instead of silently vanishing until the next rebuild.
    # An item with quantity > 1 only counts as sold once every unit is gone.
    store = request.app.state.sold_store
    sold_out_ids = [
        item.id
        for item in request.app.state.catalog.values()
        if store.units_sold(item.id) >= item.quantity
    ]
    return SoldItemsResponse(sold_item_ids=sold_out_ids)


@app.get("/api/codes/{code}", response_model=CodeLookupResponse)
def lookup_code(code: str, request: Request):
    _code_limiter.check(client_ip(request))
    record = request.app.state.code_store.get(code)
    # Expired, cancelled, and never-existed all get the same answer, so a
    # guesser can't tell a dead code from a wrong one. Sold stays visible
    # (as Sold) — the buyer who paid may open the link again.
    if record is None or record.status not in ("active", "sold"):
        raise HTTPException(status_code=404, detail="That code doesn't exist or has expired.")
    return CodeLookupResponse(
        code=record.code,
        sold=record.status == "sold",
        expiresAt=record.expiresAt.isoformat(),
        item=record.item,
    )


@app.post("/api/checkout", response_model=CheckoutResponse)
def checkout(body: CheckoutRequest, request: Request, settings: Settings = Depends(get_settings)):
    if body.code:
        return _checkout_code(body.code, request, settings)

    item = request.app.state.catalog.get(body.item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    store = request.app.state.sold_store
    if store.units_sold(item.id) >= item.quantity:
        raise HTTPException(status_code=409, detail="This item has already sold")
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=500, detail="Stripe is not configured yet")

    session = create_checkout_session(item=item, settings=settings)
    return CheckoutResponse(url=session.url)


def _checkout_code(code: str, request: Request, settings: Settings) -> CheckoutResponse:
    _code_limiter.check(client_ip(request))
    record = request.app.state.code_store.get(code)
    if record is None or record.status in ("expired", "cancelled"):
        raise HTTPException(status_code=404, detail="That code doesn't exist or has expired.")
    if record.status == "sold":
        raise HTTPException(status_code=409, detail="This item has already sold")
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=500, detail="Stripe is not configured yet")

    # Priced from the code's own record — rule 1 in payments.py.
    session = create_checkout_session(item=record.item, settings=settings, code=record.code)
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
        metadata = session.get("metadata") or {}
        item_id = metadata.get("item_id")
        code = normalize_code(metadata.get("code") or "") or None

        if code:
            # A code sale: the item lives in the code store, not the
            # catalog, and "sold" is the code's own state, not a count.
            record = request.app.state.code_store.mark_sold(code, session_id=session.get("id"))
            item = record.item if record else None
        else:
            item = request.app.state.catalog.get(item_id) if item_id else None
            if item is not None:
                store.record_sale(item.id)

        if item is None:
            logger.warning("checkout.session.completed with unknown item_id=%r code=%r", item_id, code)
        else:
            buyer_email = (session.get("customer_details") or {}).get("email")
            if buyer_email:
                subject, body_html, body_text = buyer_confirmation(
                    item,
                    # What Stripe actually charged, not the catalog price —
                    # the email says "price paid", so it should be exact.
                    amount_paid_cents=session.get("amount_total") or item.priceCents,
                    site_url=settings.site_url,
                )
                send_email(
                    settings,
                    to=buyer_email,
                    subject=subject,
                    html=body_html,
                    text=body_text,
                    # Sender is noreply@; the email says "reply to this
                    # email", so replies need to land in a real inbox.
                    reply_to=settings.notify_email or None,
                )
            if settings.sale_notify_address:
                subject, body_text = sale_alert(item, session, code=code)
                send_email(settings, to=settings.sale_notify_address, subject=subject, text=body_text)

            # Separate from the email on purpose: this is the one that gets
            # your attention, the email is the one with the shipping address.
            #
            # Belt and braces on the error handling, because of where we are
            # in this handler: the sale is already recorded and both emails
            # are already sent, but mark_processed() hasn't run yet. Anything
            # that escapes here is a 500 to Stripe, Stripe retries, and the
            # retry sails past already_processed() and records the same sale
            # a second time — which for a multi-unit listing quietly eats
            # another unit of stock. send_push swallows its own transport
            # errors; this catches anything sale_push could throw while
            # building the body. A missed notification is the acceptable
            # failure here; a double-counted sale is not.
            if settings.pushover_configured:
                try:
                    push_title, push_message, push_url = sale_push(item, session, code=code)
                    send_push(
                        settings,
                        title=push_title,
                        message=push_message,
                        url=push_url,
                        url_title="Open payment in Stripe" if push_url else None,
                        # High priority: cuts through the phone's quiet
                        # hours. A sale that ships the same business day is
                        # worth a buzz at 7am; see LAUNCH_CHECKLIST's
                        # shipping promise.
                        priority=1,
                    )
                except Exception:
                    logger.exception("Sale push failed for item_id=%r code=%r", item.id, code)

    store.mark_processed(event["id"])
    return {"received": True}


@app.post("/api/contact", response_model=OkResponse)
def contact(body: ContactRequest, request: Request, settings: Settings = Depends(get_settings)):
    _guard(request)
    if body.website:
        return OkResponse()  # honeypot tripped — pretend success, send nothing

    lines = [f"Name: {html.escape(body.name)}"]
    if body.email:
        lines.append(f"Email: {html.escape(body.email)}")
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
    lines.append(f"IMEI: {html.escape(body.imei)}")
    lines.append(f"Condition: {html.escape(body.condition)}")
    lines.append(f"Unlock status: {html.escape(body.unlock_status)}")
    if body.carrier:
        lines.append(f"Carrier: {html.escape(body.carrier)}")
    if body.battery_health:
        lines.append(f"Battery health: {html.escape(body.battery_health)}")
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


@app.post("/api/admin/login", response_model=OkResponse)
def admin_login(
    body: AdminLoginRequest, request: Request, settings: Settings = Depends(get_settings)
):
    """Step one of admin sign-in: push a one-time code to the admin's phone.

    This route tells an anonymous caller whether a username is an admin,
    which is a deliberate choice and not an oversight — it's what makes the
    form usable, and the set of names is small and private. _admin_limiter
    is what keeps that from being an enumerable list.
    """
    _admin_limiter.check(client_ip(request))

    username = normalize_username(body.username)
    # Raises on a malformed ADMIN_USERNAMES rather than admitting the wrong
    # person — see Settings.admin_allowlist. A 500 here means the env is
    # broken, which is the operator's problem and not the caller's.
    try:
        allowlist = settings.admin_allowlist
    except ValueError:
        logger.exception("ADMIN_USERNAMES is malformed — refusing all admin logins")
        raise HTTPException(status_code=500, detail="Admin sign-in is misconfigured.")

    if username not in allowlist:
        raise HTTPException(status_code=400, detail="Username has not been registered.")

    code = request.app.state.login_code_store.issue(username)

    # send_push_strict, not send_push: the quiet one would let this return
    # "sent" for a code that never left the building, and the whole point of
    # the screen the user is looking at is that a code is on its way.
    try:
        send_push_strict(
            settings,
            title="NexFix admin sign-in",
            message=f"Your sign-in code is {code}. It expires in 10 minutes.",
            # High priority: you are standing at a keyboard waiting for it,
            # so this is the one push in the app that should ignore a quiet
            # hours schedule.
            priority=1,
            user_key=allowlist[username] or None,
        )
    except PushError:
        logger.exception("Could not push a sign-in code for %s", username)
        raise HTTPException(
            status_code=503,
            detail="Couldn't send the code right now. Try again in a moment.",
        )

    return OkResponse()


@app.post("/api/admin/passkey/begin", response_model=OkResponse)
def admin_passkey_begin(
    body: AdminPasskeyRequest, request: Request, settings: Settings = Depends(get_settings)
):
    """Start a passkey sign-in, if there's a passkey to start it with.

    Today this only ever refuses, because nothing enrols a passkey yet —
    that's a button in the admin panel's settings, and there's no admin
    panel. The refusal is the real, correct answer rather than a stub: no
    credential on file genuinely means you cannot sign in this way.

    "Not enrolled." is also the answer for a username that isn't an admin
    at all. Deliberately: /api/admin/login already has to distinguish those
    two cases to be usable, but this route doesn't, so it gives away less.
    """
    _admin_limiter.check(client_ip(request))

    username = normalize_username(body.username)
    try:
        allowlist = settings.admin_allowlist
    except ValueError:
        logger.exception("ADMIN_USERNAMES is malformed — refusing all admin logins")
        raise HTTPException(status_code=500, detail="Admin sign-in is misconfigured.")

    if username not in allowlist or not request.app.state.passkey_store.has_credential(
        username
    ):
        raise HTTPException(status_code=400, detail="Not enrolled.")

    # Unreachable until enrolment exists. When it does, this is where the
    # WebAuthn ceremony starts: build a challenge, store it against the
    # username with a short expiry the way login_codes.py does, and return
    # it with the allowed credential ids for the browser to sign.
    raise HTTPException(
        status_code=501,
        detail="Passkey sign-in isn't finished yet. Use a confirmation code.",
    )


@app.post("/api/admin/verify", response_model=OkResponse)
def admin_verify(body: AdminVerifyRequest, request: Request):
    """Step two: trade the pushed code for... nothing, yet.

    The code is checked and burned here, correctly. What's missing is the
    session that should come back with a success — there's no admin panel
    to hold one open yet, so issuing a token now would mean designing its
    lifetime, storage and revocation against no actual use. Returning a
    bare ok keeps the code half honest and leaves that decision where it
    belongs, with the panel.
    """
    _admin_limiter.check(client_ip(request))

    if not request.app.state.login_code_store.verify(body.username, body.code):
        # One message for wrong, expired, already-used and too-many-tries.
        # Telling them which would hand a guesser a progress bar.
        raise HTTPException(status_code=400, detail="That code isn't valid. Request a new one.")

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
