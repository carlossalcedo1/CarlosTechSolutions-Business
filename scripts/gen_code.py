#!/usr/bin/env python3
"""Create a code-only listing: a private item a buyer opens with a code.

    python scripts/gen_code.py              create a new code (prompts)
    python scripts/gen_code.py list         every code, with its status
    python scripts/gen_code.py cancel K7PX  cancel an active code

Same prompts as add_item.py minus the shop-only ones (category, quantity,
featured), plus a description. Prints a 4-character code and a link
(<site>/code/<CODE>) to send the buyer. The code expires after however
many days you choose (default 7) and works for exactly one sale; see
backend/app/codes.py. Ends by offering a deploy, like add_item.py — not
needed for the code to work, just handy if you've other changes waiting.

Run it on the server. It goes live immediately, no deploy:
- the listing is written into the running API container's data volume
  (via `docker exec`), where every code — sold and expired too — is kept
  in codes.json;
- photos go into frontend/public/items/<id>/ (kept across deploys) and
  straight into frontend/dist/items/<id>/ (what Caddy is serving now).

For local testing, `--store PATH` writes to a codes.json at PATH instead of
the container, and prints a localhost link.
"""

from __future__ import annotations

import argparse
import json
import secrets
import shutil
import subprocess
import sys
from pathlib import Path

# scripts/<this file> -> repo root -> backend/, so `app` imports resolve.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from pydantic import ValidationError

from app.codes import DEFAULT_LIFETIME_DAYS, MAX_LIFETIME_DAYS, CodeItem, CodeStore, normalize_code
from app.models import Condition

from add_item import (
    PUBLIC_ITEMS_DIR,
    REPO_ROOT,
    STANDARD_DESCRIPTION,
    PhotoCopyError,
    ask,
    ask_bool,
    ask_choice,
    ask_price_cents,
    ask_specs,
    copy_photos,
    run_deploy,
)

API_CONTAINER = "ctsb-api"
DIST_ITEMS_DIR = REPO_ROOT / "frontend" / "dist" / "items"
ENV_FILE = REPO_ROOT / "deploy" / ".env"


def site_url() -> str:
    for line in ENV_FILE.read_text().splitlines() if ENV_FILE.exists() else []:
        if line.startswith("SITE_URL=") and line.split("=", 1)[1].strip():
            return line.split("=", 1)[1].strip().rstrip("/")
    return "https://shop.carlostechsolutions.com"


def run_codes_cli(args: list[str], stdin: str | None = None) -> dict | list:
    """Runs backend/app/codes.py's CLI inside the API container, where
    codes.json lives."""
    result = subprocess.run(
        ["docker", "exec", "-i", API_CONTAINER, "python", "-m", "backend.app.codes", *args],
        input=stdin,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0 and not result.stdout.strip():
        sys.exit(
            f"Couldn't reach the API container ({API_CONTAINER}) — is the site deployed and up?\n"
            f"{result.stderr.strip()}"
        )
    return json.loads(result.stdout)


class Backend:
    """The live container by default, or a local codes.json with --store."""

    def __init__(self, store_path: Path | None):
        self.store = CodeStore(store_path) if store_path else None
        self.link_base = "http://localhost:5173" if store_path else site_url()

    def add(self, item: CodeItem, days: int) -> tuple[str, str]:
        if self.store:
            record = self.store.create(item.model_dump(mode="json"), days=days)
            return record.code, record.expiresAt.isoformat()
        out = run_codes_cli(["add", str(days)], stdin=item.model_dump_json())
        return out["code"], out["expiresAt"]

    def list(self) -> list[dict]:
        if self.store:
            return [
                {"code": r.code, "name": r.item.name, "price": r.item.price_display,
                 "status": r.status, "expiresAt": r.expiresAt.isoformat()}
                for r in self.store.all()
            ]
        return run_codes_cli(["list"])

    def cancel(self, code: str) -> dict:
        if self.store:
            record = self.store.cancel(code)
            return {"code": record.code, "status": record.status} if record else {"error": "no such code"}
        return run_codes_cli(["cancel", code])


def ask_days() -> int:
    while True:
        raw = ask("Code expires in how many days", default=str(DEFAULT_LIFETIME_DAYS))
        if raw.isdigit() and 1 <= int(raw) <= MAX_LIFETIME_DAYS:
            return int(raw)
        print(f"  ! whole number of days, 1-{MAX_LIFETIME_DAYS}")


def publish_photos(item_id: str) -> None:
    """copy_photos() wrote to public/items/, which only reaches the live
    site on the next build — copy into the live dist/ too so the photos
    show up now."""
    src = PUBLIC_ITEMS_DIR / item_id
    if src.is_dir() and DIST_ITEMS_DIR.parent.is_dir():
        shutil.copytree(src, DIST_ITEMS_DIR / item_id, dirs_exist_ok=True)


def create(backend: Backend) -> int:
    print("New code-only listing — only someone with the code can see it.\n")
    brand = ask("Brand", default="Apple")
    model = ask("Model (e.g. iPhone 13)")
    storage = ask("Storage (e.g. 128GB)")
    condition = ask_choice("Condition:", [c.value for c in Condition])
    inventory_id = ask("Inventory ID (cross-references your Notion database)")
    price_cents = ask_price_cents()
    days = ask_days()
    spec_line = ask("Short spec line (e.g. 128GB . Unlocked)")
    specs = ask_specs()
    print("\nDescription (Enter keeps the standard one):")
    description = ask("  description", default=STANDARD_DESCRIPTION)

    # Random, not derived from the code — see CodeStore.create.
    item_id = f"code-{secrets.token_hex(4)}"
    try:
        images = copy_photos(item_id)
    except PhotoCopyError as exc:
        print(f"\nNot saved — {exc}", file=sys.stderr)
        return 1

    try:
        item = CodeItem(
            id=item_id,
            inventoryId=inventory_id,
            name=f"{brand} {model} {storage}",
            brand=brand,
            model=model,
            storage=storage,
            condition=Condition(condition),
            priceCents=price_cents,
            specLine=spec_line,
            specs=specs,
            description=description,
            images=images,
        )
    except ValidationError as exc:
        print("\nNot saved — the listing failed validation:\n", exc, file=sys.stderr)
        return 1

    if not backend.store:  # local testing serves photos from public/ already
        publish_photos(item_id)
    code, expires_at = backend.add(item, days)

    print(f"\n{'=' * 60}")
    print(f"  Code:     {code}")
    print(f"  Item:     {item.name} — {item.price_display}")
    print(f"  Expires:  {expires_at[:16].replace('T', ' ')} UTC ({days} day{'' if days == 1 else 's'})")
    print(f"  Link:     {backend.link_base}/code/{code}")
    print(f"{'=' * 60}")
    print("Live now — send the buyer the link, or the code to type on the Shop page.")

    # Not needed for the code (it's already live) — offered for any other
    # changes waiting to ship. Never from --store: that's local testing.
    if backend.store or not ask_bool("\nDeploy now?", default=False):
        print("Skipped deploy.")
        return 0
    return run_deploy()


def main() -> int:
    parser = argparse.ArgumentParser(description="Create, list, or cancel code-only listings.")
    parser.add_argument("command", nargs="?", default="create", choices=["create", "list", "cancel"])
    parser.add_argument("code", nargs="?", help="code to cancel")
    parser.add_argument("--store", type=Path, help="local codes.json for testing, instead of the live container")
    args = parser.parse_args()
    backend = Backend(args.store)

    if args.command == "list":
        rows = backend.list()
        if not rows:
            print("No codes yet.")
        for r in rows:
            print(f"  {r['code']}  {r['status']:<9}  {r['price']:>7}  {r['name']}  (expires {r['expiresAt'][:10]})")
        return 0

    if args.command == "cancel":
        if not args.code:
            parser.error("cancel needs a code, e.g. gen_code.py cancel K7PX")
        out = backend.cancel(normalize_code(args.code))
        if "error" in out:
            print(f"No code {args.code.upper()}.")
            return 1
        print(f"{out['code']}: {out['status']}")
        return 0

    return create(backend)


if __name__ == "__main__":
    raise SystemExit(main())
