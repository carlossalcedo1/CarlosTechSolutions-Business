"""Request/response wire shapes for the public API.

Kept separate from `app.models`: those are the domain model (what an Item
is — shared with the `add_item` CLI). These are just the bodies for the
five routes in LAUNCH_CHECKLIST.md's Phase 1 table.
"""

from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class CheckoutRequest(BaseModel):
    """Deliberately just an id — see payments.py: the browser never gets to
    say what something costs."""

    item_id: str


class CheckoutResponse(BaseModel):
    url: str


class _Honeypot(BaseModel):
    # Hidden form field real users never see or fill in; bots that fill
    # every field do. A non-empty value here means "silently pretend this
    # succeeded", not "reject" — telling a bot it was caught just teaches
    # it to adapt.
    website: str = ""


class ContactRequest(_Honeypot):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    phone: str = ""
    message: str = Field(min_length=1, max_length=5000)
    repair_type: str = ""
    device_brand: str = ""
    imei: str = ""


class TradeInRequest(_Honeypot):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    phone: str = ""
    device_brand: str = Field(min_length=1, max_length=100)
    device_model: str = Field(min_length=1, max_length=200)
    condition: str = ""
    imei: str = ""
    notes: str = Field(default="", max_length=5000)


class SubscribeRequest(_Honeypot):
    email: EmailStr


class OkResponse(BaseModel):
    ok: bool = True
