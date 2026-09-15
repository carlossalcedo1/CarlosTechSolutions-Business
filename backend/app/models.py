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
    """One physical device. Quantity is always 1 — see `sold` handling in the
    API: a device that sells is gone, not decremented."""

    model_config = {"extra": "forbid"}

    id: str = Field(min_length=1, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
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
