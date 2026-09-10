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
import glob as globlib
import os
import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pydantic import ValidationError

from app.catalog import CATALOG_PATH, load_catalog, save_catalog
from app.models import Category, Condition, Item

PUBLIC_ITEMS_DIR = Path(__file__).resolve().parents[2] / "frontend" / "public" / "items"

# Phone photos are 3-5MB each. Git never forgets a large file, so they get
# resized on the way in — a repo you can't shrink later is the expensive
# mistake here, and 1600px is plenty for a product page.
MAX_WIDTH = 1600
JPEG_QUALITY = 82

# Anything Pillow can open, including HEIC once pillow-heif registers itself.
# Whatever goes in, JPEG comes out — browsers don't display HEIC, so the
# format question only matters on the way in.
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp", ".tif", ".tiff", ".bmp", ".gif"}


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


def resolve_photo_paths(raw: str) -> list[Path]:
    """Turn whatever the terminal handed us into real file paths.

    Three things actually happen in practice, and this handles all of them:
    dragging files in (macOS pastes backslash-escaped paths; most Linux
    terminals paste `file:///home/you/photo%201.heic` URIs instead), typing a
    glob like ~/Pictures/iphone/*.heic, or typing a folder.
    """
    tokens = [t for t in re.split(r"(?<!\\)\s+", raw.strip()) if t]
    paths: list[Path] = []

    for token in tokens:
        token = token.strip("'\"").replace("\\ ", " ")

        # GNOME Terminal and friends paste URIs, percent-encoded.
        if token.startswith("file://"):
            token = unquote(urlparse(token).path)

        token = os.path.expanduser(token)

        # A glob that matches nothing falls through as a literal so the loop
        # below can report it as missing rather than silently skipping it.
        matches = sorted(globlib.glob(token)) or [token]
        for match in matches:
            path = Path(match)
            if path.is_dir():
                paths.extend(
                    sorted(c for c in path.iterdir() if c.suffix.lower() in IMAGE_SUFFIXES)
                )
            else:
                paths.append(path)

    return paths


def copy_photos(item_id: str) -> list[str]:
    """Copy photos into public/items/<id>/ and return their web paths."""
    print("\nPhotos — drag them in, or type a folder or glob (blank to skip):")
    print("  e.g. ~/Pictures/iphone14/*.heic   or   ~/Pictures/iphone14")
    raw = input("  paths: ").strip()
    if not raw:
        print("  (no photos; the site shows a placeholder until you add some)")
        return []

    try:
        import pillow_heif

        pillow_heif.register_heif_opener()  # teaches Pillow to read iPhone HEICs
    except ImportError:
        pass

    try:
        from PIL import Image, ImageOps
    except ImportError:
        print("  ! Pillow missing — run: pip3 install -r backend/requirements.txt")
        return []

    sources = resolve_photo_paths(raw)
    if not sources:
        print("  ! nothing matched that")
        return []

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

    return web_paths


def main() -> int:
    parser = argparse.ArgumentParser(description="Add a device to the catalog.")
    parser.parse_args()

    items = load_catalog()
    existing_ids = {item.id for item in items}
    print(f"Catalog: {len(items)} items ({CATALOG_PATH})\n")

    name = ask("Device name (e.g. iPhone 13 128GB)")
    item_id = slugify(name)
    while item_id in existing_ids:
        print(f"  ! id '{item_id}' already exists")
        item_id = slugify(ask("Unique id (e.g. iphone-13-128-b)"))

    category = ask_choice("Category:", [c.value for c in Category])
    brand = ask("Brand", default="Apple")
    condition = ask_choice("Condition:", [c.value for c in Condition])
    price_cents = ask_price_cents()
    spec_line = ask("Short spec line for cards (e.g. 128GB . Unlocked)")
    specs = ask_specs()
    description = ask("\nDescription (one paragraph)")
    featured = ask_bool("Feature on the homepage?", default=False)
    images = copy_photos(item_id)

    try:
        item = Item(
            id=item_id,
            name=name,
            category=Category(category),
            brand=brand,
            condition=Condition(condition),
            priceCents=price_cents,
            specLine=spec_line,
            specs=specs,
            description=description,
            images=images,
            featured=featured,
            dateAdded=dt.date.today().isoformat(),
        )
    except ValidationError as exc:
        print("\nNot saved — the item failed validation:\n", exc, file=sys.stderr)
        return 1

    items.append(item)
    save_catalog(items)

    print(f"\nAdded {item.name} — {item.price_display} ({item.condition.value})")
    print(f"Catalog now has {len(items)} items.")
    print("\nNext: run your deploy script to push it live.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
