#!/usr/bin/env python3
"""Add a device to the catalog.

    python backend/scripts/add_item.py

Prompts for the device details, copies and compresses its photos into the
frontend's public folder, validates everything against the shared Item model,
and appends it to items.json. Nothing is written until every field validates,
so a mistyped price or category fails here rather than on the live site.
"""

from __future__ import annotations

import argparse
import datetime as dt
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pydantic import ValidationError

from app.catalog import CATALOG_PATH, load_catalog, save_catalog
from app.models import Category, Condition, Item

REPO_ROOT = Path(__file__).resolve().parents[2]
PUBLIC_ITEMS_DIR = REPO_ROOT / "frontend" / "public" / "items"
DEPLOY_SCRIPT = REPO_ROOT / "deploy" / "deploy.sh"

# All device photos live under one folder on the computer used to add
# inventory (see docs/ADDING_INVENTORY.md) — each item's photos in their own
# subfolder, e.g. ~/catalog/iphone-13-128gb/.
PHOTOS_BASE_DIR = Path.home() / "catalog"

# Every item ships the same boilerplate paragraph. Specific caveats belong in
# the spec bullets ("unless explicitly stated above" is what points a reader
# back up at them), not in a per-item free-text field.
STANDARD_DESCRIPTION = (
    "All functions have been tested and function without issue unless "
    "explicitly stated above. View our return policy before purchase."
)

# Phone photos are 3-5MB each. Git never forgets a large file, so they get
# resized on the way in — a repo you can't shrink later is the expensive
# mistake here, and 1600px is plenty for a product page.
MAX_WIDTH = 1600
JPEG_QUALITY = 82

# Anything Pillow can open, including HEIC once pillow-heif registers itself.
# Whatever goes in, JPEG comes out — browsers don't display HEIC, so the
# format question only matters on the way in.
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp", ".tif", ".tiff", ".bmp", ".gif"}


class PhotoCopyError(Exception):
    """Every photo in the chosen folder failed to process."""


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return re.sub(r"-{2,}", "-", slug)


def ask(prompt: str, *, default: str | None = None, allow_empty: bool = False) -> str:
    suffix = f" [{default}]" if default else ""
    while True:
        value = input(f"{prompt}{suffix}: ").strip()
        if not value and default is not None:
            return default
        if value or allow_empty:
            return value
        print("  ! required")


def ask_choice(prompt: str, options: list[str]) -> str:
    print(f"\n{prompt}")
    for i, option in enumerate(options, 1):
        print(f"  {i}. {option}")
    while True:
        raw = input("  choose a number: ").strip()
        if raw.isdigit() and 1 <= int(raw) <= len(options):
            return options[int(raw) - 1]
        print("  ! pick one of the numbers above")


def ask_bool(prompt: str, *, default: bool) -> bool:
    d = "Y/n" if default else "y/N"
    raw = input(f"{prompt} [{d}]: ").strip().lower()
    if not raw:
        return default
    return raw.startswith("y")


def ask_price_cents() -> int:
    """Accepts '289' or '289.99' and stores integer cents."""
    while True:
        raw = ask("Price (e.g. 289 or 289.99)").lstrip("$").replace(",", "")
        try:
            cents = int(round(float(raw) * 100))
        except ValueError:
            print("  ! numbers only")
            continue
        if cents <= 0:
            print("  ! must be more than zero")
            continue
        return cents


def ask_quantity() -> int:
    """Most devices are a single physical unit; a bulk-stocked item (e.g. a
    lot of the same accessory) can carry a higher count and stays listed,
    at a lower remaining count, until every unit sells."""
    while True:
        raw = ask("Quantity in stock", default="1")
        try:
            quantity = int(raw)
        except ValueError:
            print("  ! whole numbers only")
            continue
        if quantity < 1:
            print("  ! must be at least 1")
            continue
        return quantity


def ask_specs() -> list[str]:
    print("\nSpec bullets for the product page (blank line to finish):")
    specs: list[str] = []
    while True:
        line = input(f"  spec {len(specs) + 1}: ").strip()
        if not line:
            if specs:
                return specs
            print("  ! at least one spec")
            continue
        specs.append(line)


def copy_photos(item_id: str) -> list[str]:
    """Copy photos from PHOTOS_BASE_DIR/<subfolder> into public/items/<id>/ and
    return their web paths."""
    print(f"\nPhotos — subfolder inside {PHOTOS_BASE_DIR} (blank to skip):")
    subfolder = input("  subfolder: ").strip().strip("'\"")
    if not subfolder:
        print("  (no photos; the site shows a placeholder until you add some)")
        return []

    src_dir = PHOTOS_BASE_DIR / subfolder
    if not src_dir.is_dir():
        print(f"  ! not a folder: {src_dir}")
        return []

    sources = sorted(p for p in src_dir.iterdir() if p.suffix.lower() in IMAGE_SUFFIXES)
    if not sources:
        print(f"  ! no photos found in {src_dir}")
        return []

    try:
        import pillow_heif

        pillow_heif.register_heif_opener()  # teaches Pillow to read iPhone HEICs
        heif_available = True
    except ImportError:
        heif_available = False

    try:
        from PIL import Image, ImageOps
    except ImportError:
        print("  ! Pillow missing — run: pip3 install -r backend/requirements.txt")
        return []

    # A missing pillow-heif doesn't stop the script — Image.open() just raises
    # per file below and gets skipped — so on an all-HEIC folder every photo
    # can silently fail and the item still saves with no images. Warn up
    # front so that failure has an obvious cause instead of looking random.
    heic_sources = [p for p in sources if p.suffix.lower() in (".heic", ".heif")]
    if heic_sources and not heif_available:
        print(
            f"  ! {len(heic_sources)} HEIC photo(s) found but pillow-heif isn't "
            f"installed for {sys.executable}\n"
            "    Fix: pip3 install -r backend/requirements.txt "
            "(or activate the project's .venv) and re-run."
        )

    dest_dir = PUBLIC_ITEMS_DIR / item_id
    dest_dir.mkdir(parents=True, exist_ok=True)

    web_paths: list[str] = []
    for src in sources:
        if not src.exists():
            print(f"  ! not found, skipping: {src}")
            continue

        try:
            with Image.open(src) as img:
                # Phones record rotation in EXIF rather than rotating pixels.
                # Without this, portrait shots come out sideways on the site.
                img = ImageOps.exif_transpose(img)

                # Flatten transparency onto white; a PNG with an alpha channel
                # saved straight to JPEG turns its transparent areas black.
                if img.mode in ("RGBA", "LA", "P"):
                    img = img.convert("RGBA")
                    flat = Image.new("RGB", img.size, (255, 255, 255))
                    flat.paste(img, mask=img.split()[-1])
                    img = flat
                else:
                    img = img.convert("RGB")

                if img.width > MAX_WIDTH:
                    ratio = MAX_WIDTH / img.width
                    img = img.resize((MAX_WIDTH, round(img.height * ratio)), Image.LANCZOS)

                dest = dest_dir / f"{len(web_paths) + 1}.jpg"
                img.save(dest, "JPEG", quality=JPEG_QUALITY, optimize=True)
        except Exception as exc:  # unreadable file, unsupported codec, etc.
            print(f"  ! couldn't read {src.name} ({exc}) — skipping")
            continue

        kb = dest.stat().st_size / 1024
        print(f"  + {dest.name}  <- {src.name}  ({img.width}x{img.height}, {kb:.0f} KB)")
        web_paths.append(f"/items/{item_id}/{dest.name}")

    if sources and not web_paths:
        # Every candidate photo failed to open/convert. Returning [] here
        # would let the item save silently with no images — indistinguishable
        # from "no photos were provided" — so this is a hard stop instead.
        raise PhotoCopyError(
            f"found {len(sources)} photo(s) in {src_dir} but every one failed "
            "to process (see errors above) — nothing was saved"
        )

    return web_paths


def run_deploy() -> int:
    """Hand off to deploy/deploy.sh so the new item goes live.

    A frontend-only refresh isn't enough: the API bakes items.json into its
    own image at build time (see payments.py) and prices checkout from its
    in-memory copy, so a device added here can't actually be bought until
    the API is rebuilt and restarted too. That's the whole deploy, not a
    lighter "reload" — so this just runs the real script rather than
    re-implementing a partial version of it.
    """
    print(f"\n{'=' * 60}\nDeploying\n{'=' * 60}")
    return subprocess.run([str(DEPLOY_SCRIPT)], cwd=REPO_ROOT).returncode


def main() -> int:
    parser = argparse.ArgumentParser(description="Add a device to the catalog.")
    parser.add_argument(
        "--no-deploy",
        action="store_true",
        help="Save the item but skip running deploy/deploy.sh afterward.",
    )
    args = parser.parse_args()

    items = load_catalog()
    existing_ids = {item.id for item in items}
    print(f"Catalog: {len(items)} items ({CATALOG_PATH})\n")

    category = ask_choice("Category:", [c.value for c in Category])
    brand = ask("Brand", default="Apple")
    model = ask("Model (e.g. iPhone 13)")
    storage = ask("Storage (e.g. 128GB)")
    condition = ask_choice("Condition:", [c.value for c in Condition])

    # The title is never typed by hand — it's always Brand Model Storage,
    # so cards and search stay consistent across every item. Condition is
    # shown separately (already surfaced at the bottom of the product page).
    name = f"{brand} {model} {storage}"
    item_id = slugify(name)
    while item_id in existing_ids:
        print(f"  ! id '{item_id}' already exists")
        item_id = slugify(ask("Unique id (e.g. iphone-13-128-b)"))

    inventory_id = ask("Inventory ID (cross-references your Notion database)")
    price_cents = ask_price_cents()
    quantity = ask_quantity()
    spec_line = ask("Short spec line for cards (e.g. 128GB . Unlocked)")
    specs = ask_specs()
    featured = ask_bool("Feature on the homepage?", default=False)
    try:
        images = copy_photos(item_id)
    except PhotoCopyError as exc:
        print(f"\nNot saved — {exc}", file=sys.stderr)
        return 1

    try:
        item = Item(
            id=item_id,
            inventoryId=inventory_id,
            name=name,
            category=Category(category),
            brand=brand,
            model=model,
            storage=storage,
            condition=Condition(condition),
            priceCents=price_cents,
            quantity=quantity,
            specLine=spec_line,
            specs=specs,
            description=STANDARD_DESCRIPTION,
            images=images,
            featured=featured,
            dateAdded=dt.date.today().isoformat(),
        )
    except ValidationError as exc:
        print("\nNot saved — the item failed validation:\n", exc, file=sys.stderr)
        return 1

    items.append(item)
    save_catalog(items)

    qty_note = f", qty {item.quantity}" if item.quantity != 1 else ""
    print(f"\nAdded {item.name} — {item.price_display} ({item.condition.value}{qty_note})")
    print(f"Catalog now has {len(items)} items.")

    if args.no_deploy:
        print("\nSkipped deploy (--no-deploy). Run ./deploy/deploy.sh when ready.")
        return 0

    return run_deploy()


if __name__ == "__main__":
    raise SystemExit(main())
