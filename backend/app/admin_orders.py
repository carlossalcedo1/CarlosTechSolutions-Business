"""The admin panel's Orders tab: recent orders, shipping, tracking.

Everything here reads and writes the order store on the API's data volume,
so — unlike inventory editing — it works on the live server as-is. Every
route requires a signed-in admin, applied where main.py includes the router.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from .orders import public_view, validate_tracking

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
def set_tracking(order_id: str, body: TrackingRequest, request: Request):
    try:
        number = validate_tracking(body.trackingNumber)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from None
    order = request.app.state.order_store.set_tracking(order_id, number)
    if order is None:
        raise HTTPException(404, "That order doesn't exist.")
    return public_view(order)
