"""Shared domain models.

This module is the single definition of what an inventory item is. Both the
`add_item` CLI (which writes the catalog) and the API (which prices checkout
sessions from it) import from here, so the thing that records a price and the
thing that charges a card can never disagree about the shape of an item.
"""

from __future__ import annotations

import datetime as dt
from enum import Enum

from pydantic import BaseModel, Field, field_validator


class Category(str, Enum):
    PHONES = "Phones"
    TABLETS = "Tablets"
    COMPUTERS = "Computers"
    ACCESSORIES = "Accessories"


class Condition(str, Enum):
    NEW = "New"
    EXCELLENT = "A+ - Excellent"
    GOOD = "B - Good"
    FAIR = "C - Fair"


class Item(BaseModel):
    """One catalog listing, possibly covering several physical units. Most
    devices carry quantity 1, but bulk-stocked items (e.g. the iPod Touch
    lot) can be higher — see `sold_store.py`: a sale decrements the
    remaining count, and the listing only disappears once it hits zero."""

    model_config = {"extra": "forbid"}

    id: str = Field(min_length=1, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    # Separate from `id` (the URL slug) — this is the number that cross-
    # references the item in the Notion inventory database, shown to the
    # customer too so a return/warranty conversation can reference the same
    # number both sides are looking at.
    inventoryId: str = Field(min_length=1)
    name: str = Field(min_length=1)
    category: Category
    brand: str = Field(min_length=1)
    model: str = Field(min_length=1)
    storage: str = Field(min_length=1)
    condition: Condition

    # Money is stored as integer cents, never dollars-as-float. Floats lose
    # precision ($0.1 + 0.2 != 0.3), and Stripe's API takes cents anyway, so
    # this removes a whole class of "charged the wrong amount" bug.
    priceCents: int = Field(gt=0)

    # Units in stock. Defaults to 1 (a single physical device) so existing
    # catalog entries and the common case need no change.
    quantity: int = Field(default=1, ge=1)

    specLine: str = Field(min_length=1)
    specs: list[str]
    description: str
    images: list[str]
    featured: bool
    dateAdded: str

    @field_validator("dateAdded")
    @classmethod
    def _valid_date(cls, v: str) -> str:
        dt.date.fromisoformat(v)  # raises if malformed
        return v

    @property
    def price_display(self) -> str:
        dollars = self.priceCents / 100
        return f"${dollars:.0f}" if self.priceCents % 100 == 0 else f"${dollars:.2f}"
