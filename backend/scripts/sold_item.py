#!/usr/bin/env python3
"""Mark an item sold locally (off the store) and remove it from the catalog.

    python backend/scripts/sold_item.py

Lists every item currently in items.json, lets you pick one by number to
record as sold, and repeats until you type 'exit'. A multi-unit listing
(quantity > 1) just loses one unit and stays listed; a single-unit listing
is removed from items.json entirely. Either way, a record of the sale is
appended to backend/data/sold_items.json.

This is for a sale made in person / outside the site. A sale made through
the site is already handled automatically by the Stripe webhook and
sold_store.py — don't use this script for those.
"""

from __future__ import annotations

import datetime as dt
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.catalog import CATALOG_PATH, load_catalog, save_catalog
from app.models import Item

REPO_ROOT = Path(__file__).resolve().parents[2]
DEPLOY_SCRIPT = REPO_ROOT / "deploy" / "deploy.sh"

# backend/scripts/sold_item.py -> backend/ -> data/sold_items.json
# Same gitignored runtime-data folder as sold_state.json (see config.py) —
# this is a local sales log, not source, and never belongs in git.
SOLD_ITEMS_PATH = Path(__file__).resolve().parents[1] / "data" / "sold_items.json"


def load_sold_items(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return json.loads(path.read_text())


def save_sold_items(path: Path, records: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(records, indent=2) + "\n")
    tmp.replace(path)


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


def ask_confirm(item: Item) -> bool:
    raw = input(f"  Mark '{item.name}' sold locally? [y/N]: ").strip().lower()
    return raw.startswith("y")


def ask_bool(prompt: str, *, default: bool) -> bool:
    d = "Y/n" if default else "y/N"
    raw = input(f"{prompt} [{d}]: ").strip().lower()
    if not raw:
        return default
    return raw.startswith("y")


def make_sold_record(item: Item) -> dict:
    # Always logged as one unit sold, regardless of how many the listing
    # started with — a bulk listing's remaining units are still for sale
    # and get their own record whenever they, in turn, sell.
    record = item.model_dump(mode="json")
    record["quantity"] = 1
    record["soldDate"] = dt.date.today().isoformat()
    return record


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
        if not ask_confirm(item):
            continue

        sold_records.append(make_sold_record(item))

        if item.quantity > 1:
            items[index] = item.model_copy(update={"quantity": item.quantity - 1})
            note = f"1 unit sold, {item.quantity - 1} remaining"
        else:
            del items[index]
            note = "removed from the catalog"

        save_catalog(items)
        save_sold_items(SOLD_ITEMS_PATH, sold_records)
        sold_count += 1
        print(f"  + logged sale of {item.name} — {note}")

    if not items and sold_count:
        print("\nCatalog is now empty.")

    print(f"\nDone — {sold_count} sale(s) logged this session.")
    print(f"Catalog now has {len(items)} item(s).")

    if not sold_count:
        return 0

    if not ask_bool("\nDeploy now?", default=True):
        print("Skipped deploy. Run ./deploy/deploy.sh when ready.")
        return 0

    return run_deploy()


if __name__ == "__main__":
    raise SystemExit(main())
