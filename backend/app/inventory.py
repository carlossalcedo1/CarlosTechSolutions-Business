"""Inventory operations shared by the CLIs and the admin panel.

scripts/add_item.py and scripts/sold_item.py used to hold all of this
privately. The admin panel needs the same steps — the same slug, the same
photo conversion, the same "log the sale, then drop the listing at zero" —
and a second copy of any of it would drift from the first the moment one
changed. So the logic moved here, unchanged, and both the scripts and the
API import it. The scripts still own their prompts; this file owns what
happens after the answers are in.

Everything here works on the repo's own files — scripts/items.json and
frontend/public/items/ — exactly as the CLIs always have. That is a
deliberate choice to keep the catalog static and published by deploy.sh,
and it has one consequence worth knowing: it only works where the repo is.
`repo_available()` is how a caller finds out.
"""

from __future__ import annotations

import datetime as dt
import json
import re
from pathlib import Path

from .models import Item

# backend/app/inventory.py -> repo root
REPO_ROOT = Path(__file__).resolve().parents[2]
PUBLIC_ITEMS_DIR = REPO_ROOT / "frontend" / "public" / "items"
DEPLOY_SCRIPT = REPO_ROOT / "deploy" / "deploy.sh"

# Same gitignored runtime-data folder as sold_state.json (see config.py) —
# this is a local sales log, not source, and never belongs in git.
SOLD_ITEMS_PATH = REPO_ROOT / "backend" / "data" / "sold_items.json"

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


def repo_available() -> bool:
    """Whether this process can see the repo it's meant to edit.

    True on a laptop or the NUC host running from a checkout. False inside
    the deployed API container, which is built from backend/app and a copy
    of items.json and nothing else — no deploy.sh, no frontend/. A caller
    that edits inventory has to check this first, because the alternative
    is writing to a container's throwaway copy of the catalog and reporting
    success for a change nobody will ever see.
    """
    return DEPLOY_SCRIPT.exists() and PUBLIC_ITEMS_DIR.parent.is_dir()


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return re.sub(r"-{2,}", "-", slug)


def build_name(brand: str, model: str, storage: str) -> str:
    """The title is never typed by hand — it's always Brand Model Storage,
    so cards and search stay consistent across every item."""
    return f"{brand} {model} {storage}"


def parse_price_cents(raw: str) -> int:
    """'289', '289.99', '$1,049' -> integer cents.

    Raises ValueError carrying a message a person can act on. OverflowError
    is caught too: float("inf") parses fine and only blows up at round(),
    which used to crash the CLI outright on a typo'd "inf".
    """
    cleaned = str(raw).strip().lstrip("$").replace(",", "")
    try:
        cents = int(round(float(cleaned) * 100))
    except (ValueError, OverflowError):
        raise ValueError("Price must be a number, like 289 or 289.99.") from None
    if cents <= 0:
        raise ValueError("Price must be more than zero.")
    return cents


def parse_quantity(raw) -> int:
    """Most devices are a single physical unit; a bulk-stocked item (e.g. a
    lot of the same accessory) can carry a higher count and stays listed,
    at a lower remaining count, until every unit sells."""
    try:
        quantity = int(str(raw).strip())
    except ValueError:
        raise ValueError("Quantity must be a whole number.") from None
    if quantity < 1:
        raise ValueError("Quantity must be at least 1.")
    return quantity


def parse_specs(text: str) -> list[str]:
    """One spec bullet per line; blank lines ignored; at least one."""
    specs = [line.strip() for line in str(text).splitlines() if line.strip()]
    if not specs:
        raise ValueError("Add at least one spec bullet.")
    return specs


def open_pillow():
    """Import Pillow with HEIC support when available.

    Returns (Image, ImageOps, heif_available), or None if Pillow itself is
    missing. Quiet on purpose — the CLI decides what to print about it, and
    the API decides what status code it means.
    """
    try:
        import pillow_heif

        pillow_heif.register_heif_opener()  # teaches Pillow to read iPhone HEICs
        heif_available = True
    except ImportError:
        heif_available = False

    try:
        from PIL import Image, ImageOps
    except ImportError:
        return None
    return Image, ImageOps, heif_available


def save_as_jpeg(src, dest: Path, Image, ImageOps) -> tuple[int, int]:
    """Convert one photo to an upright, resized JPEG at `dest`. Returns its
    final (width, height); raises if the file can't be read.

    `src` is a path or an open binary file — the CLI hands it paths off
    disk, the admin panel hands it uploads it never writes to disk raw.
    """
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

        img.save(dest, "JPEG", quality=JPEG_QUALITY, optimize=True)
        return img.size


def load_sold_items(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return json.loads(path.read_text())


def save_sold_items(path: Path, records: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(records, indent=2) + "\n")
    tmp.replace(path)


def make_sold_record(item: Item, units: int) -> dict:
    # Logged as the units sold in this one sale, not what the listing
    # started with — a bulk listing's remaining units are still for sale
    # and get their own record whenever they, in turn, sell.
    record = item.model_dump(mode="json")
    record["quantity"] = units
    record["soldDate"] = dt.date.today().isoformat()
    return record


def apply_sale(items: list[Item], index: int, units: int) -> tuple[list[Item], int]:
    """Take `units` off the listing at `index`. Returns (new list, remaining).

    A listing with units left stays at the lower quantity; one with none
    left is removed from the catalog entirely. The sale record is the
    caller's job — this only reshapes the catalog.
    """
    item = items[index]
    remaining = item.quantity - units
    updated = list(items)
    if remaining > 0:
        updated[index] = item.model_copy(update={"quantity": remaining})
    else:
        del updated[index]
    return updated, remaining
