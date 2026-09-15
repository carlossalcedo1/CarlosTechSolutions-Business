"""Request/response wire shapes for the public API.

Kept separate from `app.models`: those are the domain model (what an Item
is — shared with the `add_item` CLI). These are just the bodies for the
five routes in LAUNCH_CHECKLIST.md's Phase 1 table.
"""

from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field, model_validator


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
    # Either works to reach back — see ContactPage.tsx's subheader — so
    # neither is required on its own; the validator below requires one.
    email: EmailStr | None = None
    phone: str = ""
    message: str = Field(min_length=1, max_length=5000)
    repair_type: str = ""
    device_brand: str = ""
    imei: str = ""

    @model_validator(mode="after")
    def _require_a_way_to_reach_back(self) -> "ContactRequest":
        if not self.email and not self.phone:
            raise ValueError("Provide an email or phone number so we can reach back to you.")
        return self


class TradeInRequest(_Honeypot):
    # Apple-only for now (see SellDevicePage.tsx), so IMEI alone identifies
    # the device — no separate make/model field.
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    phone: str = ""
    imei: str = Field(min_length=1, max_length=32)
    condition: str = Field(min_length=1, max_length=50)
    unlock_status: str = Field(min_length=1, max_length=50)
    # Only meaningful when unlock_status is the carrier-locked option — see
    # SellDevicePage.tsx, which only shows this field in that case.
    carrier: str = Field(default="", max_length=50)
    battery_health: str = Field(default="", max_length=20)
    notes: str = Field(default="", max_length=5000)


class SubscribeRequest(_Honeypot):
    email: EmailStr


class OkResponse(BaseModel):
    ok: bool = True


class SoldItemsResponse(BaseModel):
    sold_item_ids: list[str]
