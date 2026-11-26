#!/usr/bin/env python3
"""Mark an item sold locally (off the store) and remove it from the catalog.

    python scripts/sold_item.py

Lists every item currently in items.json, lets you pick one by number to
record as sold, asks how many units sold (or 'all'), and repeats until you
type 'exit'. A listing with units left over stays listed at the lower
quantity; one with none left is removed from items.json entirely. Either
way, a record of the sale is appended to backend/data/sold_items.json.

This is for a sale made in person / outside the site. A sale made through
the site is already handled automatically by the Stripe webhook and
sold_store.py — don't use this script for those.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

# scripts/<this file> -> repo root -> backend/, so `app` imports resolve.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.catalog import CATALOG_PATH, load_catalog, save_catalog
from app.inventory import (
    DEPLOY_SCRIPT,
    REPO_ROOT,
    SOLD_ITEMS_PATH,
    apply_sale,
    load_sold_items,
    make_sold_record,
    save_sold_items,
)
from app.models import Item


def print_items(items: list[Item]) -> None:
    print(f"\n{len(items)} item(s) in the catalog:")
    for i, item in enumerate(items, 1):
        qty_note = f", qty {item.quantity}" if item.quantity != 1 else ""
        print(f"  {i}. {item.name} ({item.condition.value}) — {item.price_display}{qty_note}")


def ask_selection(count: int) -> int | None:
    """Returns a 0-based index, or None if the user typed 'exit'."""
    while True:
        raw = input(f"\nSold which one? [1-{count}, or 'exit']: ").strip()
        if raw.lower() in ("exit", "quit", "q"):
            return None
        if raw.isdigit() and 1 <= int(raw) <= count:
            return int(raw) - 1
        print(f"  ! enter a number 1-{count}, or 'exit'")


def ask_units(item: Item) -> int | None:
    """How many units of `item` sold. Returns None to cancel (blank or 0)."""
    if item.quantity == 1:
        raw = input(f"  Mark '{item.name}' sold locally? [y/N]: ").strip().lower()
        return 1 if raw.startswith("y") else None
    print(f"  '{item.name}' — quantity {item.quantity}")
    while True:
        raw = input(f"  How many to remove? [1-{item.quantity}, 'all', or blank to cancel]: ").strip().lower()
        if raw in ("", "0"):
            return None
        if raw == "all":
            return item.quantity
        if raw.isdigit() and 1 <= int(raw) <= item.quantity:
            return int(raw)
        print(f"  ! enter a number 1-{item.quantity}, 'all', or blank to cancel")


def ask_bool(prompt: str, *, default: bool) -> bool:
    d = "Y/n" if default else "y/N"
    raw = input(f"{prompt} [{d}]: ").strip().lower()
    if not raw:
        return default
    return raw.startswith("y")


def run_deploy() -> int:
    """Hand off to deploy/deploy.sh so the updated catalog goes live.

    Same reasoning as add_item.py: the API bakes items.json into its own
    image at build time, so a sale recorded here (removed listing or
    decremented quantity) isn't reflected on the live site until the API
    is rebuilt and restarted too.
    """
    print(f"\n{'=' * 60}\nDeploying\n{'=' * 60}")
    return subprocess.run([str(DEPLOY_SCRIPT)], cwd=REPO_ROOT).returncode


def main() -> int:
    items = load_catalog()
    sold_records = load_sold_items(SOLD_ITEMS_PATH)
    sold_count = 0

    print(f"Catalog: {len(items)} item(s) ({CATALOG_PATH})")
    print(f"Sold log: {len(sold_records)} record(s) ({SOLD_ITEMS_PATH})")

    while items:
        print_items(items)
        index = ask_selection(len(items))
        if index is None:
            break

        item = items[index]
        units = ask_units(item)
        if units is None:
            continue

        sold_records.append(make_sold_record(item, units))

        # Same reshaping the admin panel's "Delete listing" does — one
        # implementation in app/inventory.py, so the two can't disagree.
        items, remaining = apply_sale(items, index, units)
        if remaining > 0:
            note = f"{units} unit(s) sold, {remaining} left"
        else:
            note = f"{units} unit(s) sold, none left — removed from the catalog"

        save_catalog(items)
        save_sold_items(SOLD_ITEMS_PATH, sold_records)
        sold_count += units
        print(f"  + logged sale of {item.name} — {note}")

    if not items and sold_count:
        print("\nCatalog is now empty.")

    print(f"\nDone — {sold_count} unit(s) sold this session.")
    print(f"Catalog now has {len(items)} item(s).")

    if not sold_count:
        return 0

    if not ask_bool("\nDeploy now?", default=True):
        print("Skipped deploy. Run ./deploy/deploy.sh when ready.")
        return 0

    return run_deploy()


if __name__ == "__main__":
    raise SystemExit(main())
