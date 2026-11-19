#!/usr/bin/env python3
"""Add photos to an item that's already in the catalog.

    python scripts/add_photos.py

Lists every item in items.json, lets you pick one by number, then converts
every photo in a subfolder of ~/catalog into frontend/public/items/<id>/ —
same handling as add_item.py: HEIC to JPEG, rotated upright, resized.

Files keep their original names (IMG_4021.HEIC -> IMG_4021.jpg). Renaming
them (1.jpg, 2.jpg, ...) and listing them in that item's "images" in
items.json is up to you; this script never touches items.json.
"""

from __future__ import annotations

import sys
from pathlib import Path

# scripts/<this file> -> repo root -> backend/, so `app` imports resolve.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.catalog import CATALOG_PATH, load_catalog
from app.models import Item

from add_item import PHOTOS_BASE_DIR, PUBLIC_ITEMS_DIR, find_photos, load_pillow, save_as_jpeg


def print_items(items: list[Item]) -> None:
    print(f"\n{len(items)} item(s) in the catalog:")
    for i, item in enumerate(items, 1):
        photo_note = f"{len(item.images)} photo(s)" if item.images else "no photos"
        print(f"  {i}. {item.name} — {photo_note}")


def ask_selection(count: int) -> int | None:
    """Returns a 0-based index, or None if the user typed 'exit'."""
    while True:
        raw = input(f"\nAdd photos to which one? [1-{count}, or 'exit']: ").strip()
        if raw.lower() in ("exit", "quit", "q"):
            return None
        if raw.isdigit() and 1 <= int(raw) <= count:
            return int(raw) - 1
        print(f"  ! enter a number 1-{count}, or 'exit'")


def ask_source_dir() -> Path | None:
    while True:
        print(f"\nPhotos — subfolder inside {PHOTOS_BASE_DIR} (blank to cancel):")
        subfolder = input("  subfolder: ").strip().strip("'\"")
        if not subfolder:
            return None
        src_dir = PHOTOS_BASE_DIR / subfolder
        if src_dir.is_dir():
            return src_dir
        print(f"  ! not a folder: {src_dir}")


def convert_photos(item: Item, src_dir: Path) -> list[Path]:
    """Converts every photo in `src_dir` into the item's public folder.
    Returns the files written."""
    sources = find_photos(src_dir)
    if not sources:
        print(f"  ! no photos found in {src_dir}")
        return []

    pillow = load_pillow(sources)
    if pillow is None:
        return []

    dest_dir = PUBLIC_ITEMS_DIR / item.id
    dest_dir.mkdir(parents=True, exist_ok=True)

    written: list[Path] = []
    for src in sources:
        dest = dest_dir / f"{src.stem}.jpg"
        # Never overwrite: an existing file may be one you already renamed
        # into place (e.g. two sources both named IMG_1.*, or a re-run).
        if dest.exists():
            print(f"  ! {dest.name} already exists in {dest_dir} — skipping {src.name}")
            continue
        try:
            width, height = save_as_jpeg(src, dest, *pillow)
        except Exception as exc:  # unreadable file, unsupported codec, etc.
            print(f"  ! couldn't read {src.name} ({exc}) — skipping")
            continue

        kb = dest.stat().st_size / 1024
        print(f"  + {dest.name}  <- {src.name}  ({width}x{height}, {kb:.0f} KB)")
        written.append(dest)
    return written


def main() -> int:
    items = load_catalog()
    if not items:
        print(f"Catalog is empty ({CATALOG_PATH}). Add an item with add_item.py first.")
        return 1

    print(f"Catalog: {len(items)} item(s) ({CATALOG_PATH})")

    while True:
        print_items(items)
        index = ask_selection(len(items))
        if index is None:
            break

        item = items[index]
        src_dir = ask_source_dir()
        if src_dir is None:
            continue

        written = convert_photos(item, src_dir)
        if not written:
            continue

        dest_dir = PUBLIC_ITEMS_DIR / item.id
        print(f"\n  {len(written)} photo(s) in {dest_dir}")
        print("  Next: rename them 1.jpg, 2.jpg, ... (1 is the main photo), then")
        print(f"  set this item's \"images\" in {CATALOG_PATH.name}, e.g.:")
        print(f'    "/items/{item.id}/1.jpg"')

    print("\nDone. Deploy (./deploy/deploy.sh) once items.json lists the new photos.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
