"""Shippo's tracking API — just the one call this app makes.

Same shape as notifier.py and for the same reasons: one place every call
goes through, stdlib only (one form POST isn't worth a dependency), and
errors that say whether anything was attempted.

Registering a number (POST /tracks/) is what makes Shippo watch it and send
updates to the webhook, and it's what Shippo charges for on labels bought
elsewhere. Nothing here ever GETs a status: whether a GET is billable isn't
documented, and the webhook delivers every update anyway.

Docs: https://docs.goshippo.com/tracking/tracking
"""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request

from .config import Settings

_API_URL = "https://api.goshippo.com/tracks/"
_TIMEOUT_SECONDS = 15


class ShippoError(Exception):
    """Base for the ways register_track can fail."""


class ShippoNotConfigured(ShippoError):
    """No API token — nothing was attempted."""


class ShippoFailed(ShippoError):
    """Shippo was asked and didn't accept it."""


# The carriers the Packages tab offers, as Shippo's carrier tokens.
CARRIERS = ("usps", "fedex", "ups")


def carrier_for(number: str, carrier: str = "usps") -> str:
    # Shippo's test mode tracks made-up numbers like SHIPPO_DELIVERED under a
    # pretend carrier, whatever was picked.
    return "shippo" if number.startswith("SHIPPO_") else carrier


def register_track(
    settings: Settings, number: str, metadata: str = "", carrier: str = "usps"
) -> dict:
    """Ask Shippo to watch a tracking number. Returns the Track object,
    which already carries the latest status."""
    if not settings.shippo_api_token:
        raise ShippoNotConfigured("SHIPPO_API_TOKEN is not set")

    fields = {"carrier": carrier_for(number, carrier), "tracking_number": number}
    if metadata:
        fields["metadata"] = metadata[:100]  # Shippo's limit
    request = urllib.request.Request(
        _API_URL,
        data=urllib.parse.urlencode(fields).encode(),
        headers={
            "Authorization": f"ShippoToken {settings.shippo_api_token}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=_TIMEOUT_SECONDS) as response:
            return json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as exc:
        body = exc.read()[:200].decode("utf-8", "replace")
        raise ShippoFailed(f"HTTP {exc.code} {body}") from exc
    except urllib.error.URLError as exc:
        raise ShippoFailed(str(exc.reason)) from exc
    except ValueError as exc:
        raise ShippoFailed("Shippo sent back something that wasn't JSON") from exc
