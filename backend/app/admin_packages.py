"""The admin panel's Packages tab, and the webhook Shippo reports to.

A package is a tracking number with a label: an order you've shipped (added
automatically when tracking goes on an order) or parts on their way to you
(added by hand). Registering it with Shippo is what gets it watched; after
that, every scan arrives at /api/shippo-webhook, and a package turning
"delivered" pushes to your phone.
"""

from __future__ import annotations

import hmac
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from typing import Literal

from pydantic import BaseModel, Field

from .config import Settings, get_settings
from .notifier import send_push
from .orders import validate_tracking
from .packages import PackageStore
from .shippo import ShippoError, ShippoNotConfigured, register_track

logger = logging.getLogger("app.admin_packages")

router = APIRouter(prefix="/api/admin/packages")
# The webhook can't sit behind admin sign-in — Shippo is the caller.
public_router = APIRouter()


def track_package(
    store: PackageStore,
    settings: Settings,
    number: str,
    label: str,
    kind: str,
    order_id: str | None = None,
    carrier: str = "usps",
) -> dict:
    """Add a package and register it with Shippo, unless it already is.

    Never raises for a Shippo problem: the package is kept with the reason
    it isn't being tracked, and the panel can retry it. Called from the
    Orders tab too, where a Shippo hiccup mustn't stop a tracking number
    being saved.
    """
    package = store.add(number, label, kind, order_id, carrier)
    return register(store, settings, package)


def register(store: PackageStore, settings: Settings, package: dict) -> dict:
    if package.get("registeredAt"):
        return package
    if not settings.shippo_api_token:
        return store.mark_register_error(package["id"], "Shippo isn't set up on this server.")
    # The cap is checked before asking, not after: past the free allowance
    # each registration costs money, and that's a decision, not a default.
    if store.registrations_this_month() >= settings.shippo_monthly_limit:
        return store.mark_register_error(
            package["id"],
            f"This month's {settings.shippo_monthly_limit} free tracking registrations are used up.",
        )
    try:
        track = register_track(
            settings,
            package["trackingNumber"],
            metadata=package["label"],
            # Packages added before carriers were offered were all USPS.
            carrier=package.get("carrier") or "usps",
        )
    except ShippoNotConfigured:
        return store.mark_register_error(package["id"], "Shippo isn't set up on this server.")
    except ShippoError as exc:
        logger.error("Shippo registration failed for %s: %s", package["trackingNumber"], exc)
        return store.mark_register_error(package["id"], "Shippo didn't accept it — try again.")
    store.mark_registered(package["id"])
    updated, _ = store.apply_track(package["id"], track)
    return updated or package


def _store(request: Request) -> PackageStore:
    return request.app.state.package_store


@router.get("")
def list_packages(request: Request, settings: Settings = Depends(get_settings)):
    store = _store(request)
    return {
        "packages": store.all_newest_first(),
        "usedThisMonth": store.registrations_this_month(),
        "monthlyLimit": settings.shippo_monthly_limit,
        "configured": bool(settings.shippo_api_token and settings.shippo_webhook_token),
    }


class AddPackageRequest(BaseModel):
    trackingNumber: str
    label: str = Field(min_length=1, max_length=80)
    # Shippo's carrier tokens. Orders are always USPS, so only parts pick.
    carrier: Literal["usps", "fedex", "ups"] = "usps"


@router.post("")
def add_package(
    body: AddPackageRequest, request: Request, settings: Settings = Depends(get_settings)
):
    try:
        number = validate_tracking(body.trackingNumber)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from None
    return track_package(
        _store(request), settings, number, body.label.strip(), "parts", carrier=body.carrier
    )


@router.post("/{package_id}/register")
def retry_registration(
    package_id: str, request: Request, settings: Settings = Depends(get_settings)
):
    store = _store(request)
    package = store.get(package_id)
    if package is None:
        raise HTTPException(404, "That package doesn't exist.")
    return register(store, settings, package)


@router.delete("/{package_id}")
def delete_package(package_id: str, request: Request):
    if not _store(request).delete(package_id):
        raise HTTPException(404, "That package doesn't exist.")
    return {"ok": True}


@public_router.post("/api/shippo-webhook")
async def shippo_webhook(
    request: Request,
    background: BackgroundTasks,
    settings: Settings = Depends(get_settings),
):
    """Shippo's track_updated alerts.

    Shippo doesn't sign webhooks unless you arrange it with their sales
    team, so the URL carries a secret token instead (?token=...), checked
    in constant time. No token configured means the endpoint doesn't exist
    as far as anyone outside can tell.

    Answers fast and pushes afterwards: Shippo wants a reply within three
    seconds, and a Pushover call can take longer than that.
    """
    expected = settings.shippo_webhook_token
    given = request.query_params.get("token", "")
    if not expected or not hmac.compare_digest(given.encode(), expected.encode()):
        raise HTTPException(404, "Not Found")

    try:
        event = await request.json()
    except ValueError:
        raise HTTPException(400, "Expected JSON.") from None
    if not isinstance(event, dict) or event.get("event") != "track_updated":
        return {"ok": True}
    track = event.get("data") or {}
    number = track.get("tracking_number") if isinstance(track, dict) else None
    if not number:
        return {"ok": True}

    store = _store(request)
    package = store.find_by_tracking(str(number))
    if package is None:
        # Not one of ours (or deleted since) — nothing to update. Still 200,
        # so Shippo doesn't retry something that will never apply.
        return {"ok": True}

    package, became_delivered = store.apply_track(package["id"], track)
    if package and became_delivered and not package.get("deliveredNotifiedAt"):
        store.mark_delivered_notified(package["id"])
        where = f" in {package['location']}" if package.get("location") else ""
        background.add_task(
            send_push,
            settings,
            title=f"Delivered: {package['label']}",
            message=f"{package['trackingNumber']} was delivered{where}.",
        )
    return {"ok": True}
