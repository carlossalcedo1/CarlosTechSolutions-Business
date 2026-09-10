"""Loading and saving the catalog file.

The catalog lives in the frontend as JSON so the site can bake it into a
static build, but it is validated here, in Python, on every read and write.
The API calls `load_catalog()` at startup: if a hand-edit ever corrupts the
file, the container fails to boot instead of mispricing a checkout later.
"""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import TypeAdapter

from .models import Item

# backend/app/catalog.py -> repo root -> frontend/src/data/items.json
CATALOG_PATH = Path(__file__).resolve().parents[2] / "frontend" / "src" / "data" / "items.json"

_ADAPTER = TypeAdapter(list[Item])


def load_catalog(path: Path | None = None) -> list[Item]:
    target = path or CATALOG_PATH
    return _ADAPTER.validate_json(target.read_text())


def save_catalog(items: list[Item], path: Path | None = None) -> None:
    target = path or CATALOG_PATH
    payload = _ADAPTER.dump_python(items, mode="json")
    target.write_text(json.dumps(payload, indent=2) + "\n")
