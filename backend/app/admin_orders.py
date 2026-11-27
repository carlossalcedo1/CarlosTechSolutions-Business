"""The admin panel's Orders tab: recent orders, shipping, tracking.

Everything here reads and writes the order store on the API's data volume,
so — unlike inventory editing — it works on the live server as-is. Every
route requires a signed-in admin, applied where main.py includes the router.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from .config import Settings, get_settings
from .emails import order_shipped
from .mailer import send_email
from .orders import OrderStore, public_view, validate_tracking
from .admin_packages import track_package

logger = logging.getLogger("app.admin_orders")

router = APIRouter(prefix="/api/admin/orders")

RECENT = 5


@router.get("")
def recent_orders(request: Request):
    store = request.app.state.order_store
    orders = store.all_newest_first()
    recent, older = orders[:RECENT], orders[RECENT:]
    return {
        "orders": [public_view(o) for o in recent],
        "total": len(orders),
        # Only five are shown, so an unshipped order that's sixth-newest
        # would drop out of sight entirely. Counting them means the panel
        # can say so instead of letting one go unshipped unnoticed.
        "olderUnshipped": sum(1 for o in older if not o.get("shippedAt")),
    }


@router.get("/{order_id}")
def one_order(order_id: str, request: Request):
    order = request.app.state.order_store.get(order_id)
    if order is None:
        raise HTTPException(404, "That order doesn't exist.")
    return public_view(order)


@router.post("/{order_id}/shipped")
def mark_shipped(order_id: str, request: Request):
    order = request.app.state.order_store.mark_shipped(order_id)
    if order is None:
        raise HTTPException(404, "That order doesn't exist.")
    return public_view(order)


class TrackingRequest(BaseModel):
    trackingNumber: str


@router.put("/{order_id}/tracking")
def set_tracking(
    order_id: str,
    body: TrackingRequest,
    request: Request,
    settings: Settings = Depends(get_settings),
):
    """Save the tracking number, then email the buyer that it shipped.

    The number is saved first and stays saved whatever happens to the
    email. A tracking number you've just typed off a label is the thing
    that mustn't be lost; an email that didn't go is something the panel
    can tell you about and you can follow up by text.
    """
    try:
        number = validate_tracking(body.trackingNumber)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from None
    store: OrderStore = request.app.state.order_store
    order = store.set_tracking(order_id, number)
    if order is None:
        raise HTTPException(404, "That order doesn't exist.")

    view = public_view(store.get(order_id) or order)
    view["shippedEmail"] = _send_shipped_email(store, order_id, settings)
    # And watch it on the Packages tab, so you hear when it's delivered.
    # track_package never raises for a Shippo problem; anything else going
    # wrong here still mustn't lose the number just saved.
    try:
        track_package(
            request.app.state.package_store,
            settings,
            number,
            order.get("itemName") or f"Order {order_id}",
            "order",
            order_id,
        )
    except Exception:
        logger.exception("Couldn't add order %s to Packages", order_id)
    return view


def _send_shipped_email(store: OrderStore, order_id: str, settings: Settings) -> str:
    """Email the buyer once. Returns what happened, for the panel to say.

    "sent", "already-sent", "no-email", "not-configured" or "failed".
    """
    order = store.get(order_id) or {}
    if order.get("shippedEmailSentAt"):
        # Saving a corrected number doesn't email again — a second "your
        # order has shipped" reads like a second package. The panel says so,
        # so a fixed typo can be sent by text instead.
        return "already-sent"
    if not order.get("customerEmail"):
        return "no-email"
    if not settings.resend_api_key:
        # Checked here rather than left to mailer.py, which logs and returns
        # as if it had sent. Not marking it sent means that once a key is
        # configured, the next save sends it.
        return "not-configured"

    view = public_view(order)
    subject, html, text = order_shipped(
        item_name=order.get("itemName") or "order",
        tracking_number=order["trackingNumber"],
        tracking_url=view["trackingUrl"],
    )
    try:
        # No reply_to: the email points people to text instead, and sends
        # from noreply@ so a reply doesn't land somewhere unread.
        send_email(settings, to=order["customerEmail"], subject=subject, html=html, text=text)
    except Exception:
        logger.exception("Shipped email failed for order %s", order_id)
        return "failed"
    store.mark_shipped_email_sent(order_id)
    return "sent"
