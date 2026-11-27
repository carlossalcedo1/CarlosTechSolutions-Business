"""Request/response wire shapes for the public API.

Kept separate from `app.models`: those are the domain model (what an Item
is — shared with the `add_item` CLI). These are just the bodies for the
five routes in LAUNCH_CHECKLIST.md's Phase 1 table.
"""

from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from .codes import CodeItem
from .login_codes import CODE_LENGTH


class AdminLoginRequest(BaseModel):
    """Step one: who's asking. Nothing is revealed about the username here
    beyond what the route's own error says."""

    username: str = Field(min_length=1, max_length=64)


class AdminUser(BaseModel):
    username: str


class AdminMeResponse(BaseModel):
    """Who's signed in, if anyone. `user` is null when not — a 200 with a
    null rather than a 401, because "nobody is signed in" is the expected
    answer on every public page load, not an error."""

    user: AdminUser | None = None


class AdminPasskeyRequest(BaseModel):
    """Who is trying to sign in with a passkey. The answer is the same for
    an unknown name and a known one with no device on file — see the route."""

    username: str = Field(min_length=1, max_length=64)


class AdminVerifyRequest(BaseModel):
    """Step two: the code that was pushed. Length is pinned to the 6 digits
    login_codes.py generates, so a wrong-shaped guess is rejected by
    validation before it costs a PBKDF2 round."""

    username: str = Field(min_length=1, max_length=64)
    code: str = Field(min_length=CODE_LENGTH, max_length=CODE_LENGTH, pattern=r"^\d+$")


class CheckoutRequest(BaseModel):
    """Deliberately just an id or a code — see payments.py: the browser
    never gets to say what something costs. Exactly one of the two."""

    item_id: str | None = None
    # A code-only listing (app/codes.py) — priced from the code's record.
    code: str | None = Field(default=None, max_length=16)

    @model_validator(mode="after")
    def _exactly_one(self) -> "CheckoutRequest":
        if bool(self.item_id) == bool(self.code):
            raise ValueError("Provide an item_id or a code.")
        return self


class CheckoutResponse(BaseModel):
    url: str


class _Honeypot(BaseModel):
    # Hidden form field real users never see or fill in; bots that fill
    # every field do. A non-empty value here means "silently pretend this
    # succeeded", not "reject" — telling a bot it was caught just teaches
    # it to adapt.
    website: str = ""


# Request kinds that are just a message and a phone number, no device.
_MESSAGE_ONLY = ("contact", "tutoring")


class ServiceRequest(_Honeypot):
    """Send Request from the Services page: what they want done, to which
    device, and a phone number to reach them at. Pushed to the admin's
    phone; nothing is stored.

    Free-text fields are length-capped and the list is short, because this
    is a public form whose only output is a push to a phone — a request
    that runs to pages is spam, not a customer.
    """

    # "contact" is the Contact page and "tutoring" the Tutoring page: a
    # message and nothing else, so they're the two kinds without a device.
    service: Literal["unlock", "repair", "sell", "contact", "tutoring"]
    device: str = Field(default="", max_length=120)
    service_requested: str = Field(default="", max_length=120)
    details: list[str] = Field(default_factory=list, max_length=12)
    phone: str = Field(min_length=1, max_length=40)

    @field_validator("details")
    @classmethod
    def _short_details(cls, details: list[str]) -> list[str]:
        # 500 leaves room for "Issue: " plus the 400-character description
        # the Repair window allows when the service is "Other".
        if any(len(d) > 500 for d in details):
            raise ValueError("Each detail must be 500 characters or fewer.")
        return details

    @model_validator(mode="after")
    def _service_for_repair_and_unlock(self) -> "ServiceRequest":
        # Repair and Unlock both make you choose what's needed before Send
        # Request is offered, so one arriving without it didn't come from
        # the site. Sell has no such question — its answers are the details.
        if self.service in ("repair", "unlock") and not self.service_requested.strip():
            raise ValueError("Choose the service you need.")
        if self.service not in _MESSAGE_ONLY and not self.device.strip():
            raise ValueError("Choose your device.")
        if self.service in _MESSAGE_ONLY and not any(d.strip() for d in self.details):
            raise ValueError("Write a message.")
        return self

    @field_validator("phone")
    @classmethod
    def _us_phone(cls, raw: str) -> str:
        """Normalised to (305) 763-2541. US numbers only: you call or text
        back from a US number, and a 10-digit check catches the commonest
        mistake — a digit short — before the customer thinks they're done."""
        digits = re.sub(r"\D", "", raw)
        if len(digits) == 11 and digits.startswith("1"):
            digits = digits[1:]
        if len(digits) != 10:
            raise ValueError("Enter a 10-digit US phone number.")
        return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"


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


class CodeLookupResponse(BaseModel):
    """What a buyer sees after typing a code: the listing's public fields.
    `sold` so a code that's been used shows the item as Sold rather than
    "not found" — the buyer who paid may well open the link again."""

    code: str
    sold: bool
    expiresAt: str
    item: CodeItem
