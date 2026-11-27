"""The admin panel's Codes tab: scripts/gen_code.py as a form.

Same fields as gen_code.py, the same CodeStore, the same random item id and
the same one-code-one-sale rules — this is a face for backend/app/codes.py,
which already had the whole model.

One deliberate difference: photos. gen_code.py writes them into
frontend/public/items/ and copies them into the live frontend/dist/, both
on the host. The API container has neither, so photos for codes made here
go on the data volume next to codes.json and are served by the public route
at the bottom of this file. The product page just renders whatever URL is in
`images`, so it doesn't care which. The point of doing it this way: codes
already live on that volume, so a code — photos included — can be made from
the panel on the live server, from a phone, with no deploy. That's the
situation codes exist for.
"""

from __future__ import annotations

import re
import secrets
import shutil

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import ValidationError

from .codes import MAX_LIFETIME_DAYS, CodeItem, CodeRecord, normalize_code
from .config import Settings, get_settings
from .inventory import (
    STANDARD_DESCRIPTION,
    build_name,
    open_pillow,
    parse_price_cents,
    parse_specs,
    save_as_jpeg,
)
from .models import Condition

router = APIRouter(prefix="/api/admin/codes")

# No auth on purpose: these are the photos on a code's product page, which
# a buyer with the code has to be able to load. What protects them is the
# same thing that protects gen_code.py's: the item id is random and
# unrelated to the code (see CodeStore.create), so knowing a code doesn't
# give you the photo URLs, and guessing an id is 32 bits of guessing.
public_router = APIRouter(prefix="/api/code-photos")

MAX_PHOTOS = 10
_ITEM_ID_RE = re.compile(r"^code-[0-9a-f]{8}$")
_PHOTO_RE = re.compile(r"^[1-9][0-9]?\.jpg$")


def _view(record: CodeRecord) -> dict:
    status = record.status
    return {
        "code": record.code,
        "status": status,
        # The panel's table splits codes in two. Sold, cancelled and expired
        # differ in why, but all mean the same thing to a buyer: the code no
        # longer opens anything.
        "active": status == "active",
        "createdAt": record.createdAt.isoformat(),
        "expiresAt": record.expiresAt.isoformat(),
        "soldAt": record.soldAt.isoformat() if record.soldAt else None,
        "item": record.item.model_dump(mode="json"),
    }


@router.get("")
def list_codes(request: Request):
    records = request.app.state.code_store.all()
    return {"codes": [_view(r) for r in reversed(records)]}  # newest first


@router.post("", status_code=201)
def create_code(
    request: Request,
    settings: Settings = Depends(get_settings),
    brand: str = Form("Apple"),
    model: str = Form(...),
    storage: str = Form(...),
    condition: str = Form(...),
    inventoryId: str = Form(...),
    price: str = Form(...),
    days: str = Form("7"),
    specLine: str = Form(...),
    specs: str = Form(...),
    description: str = Form(""),
    photos: list[UploadFile] = File(default=[]),
):
    """gen_code.py's create(), minus the prompts."""
    if len(photos) > MAX_PHOTOS:
        raise HTTPException(400, f"That's {len(photos)} photos — the most is {MAX_PHOTOS}.")

    try:
        price_cents = parse_price_cents(price)
        spec_list = parse_specs(specs)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from None

    # Same range as gen_code.py's ask_days and CodeStore.create.
    days_error = f"Days must be a whole number, 1 to {MAX_LIFETIME_DAYS}."
    try:
        lifetime = int(str(days).strip())
    except ValueError:
        raise HTTPException(400, days_error) from None
    if not 1 <= lifetime <= MAX_LIFETIME_DAYS:
        raise HTTPException(400, days_error)

    brand, model, storage = brand.strip(), model.strip(), storage.strip()
    # Random, not derived from the code — see CodeStore.create.
    item_id = f"code-{secrets.token_hex(4)}"

    # Validate before writing anything, as the inventory routes do, so a bad
    # field leaves no orphaned photo folder behind.
    try:
        draft = CodeItem(
            id=item_id,
            inventoryId=inventoryId.strip(),
            name=build_name(brand, model, storage),
            brand=brand,
            model=model,
            storage=storage,
            condition=Condition(condition),
            priceCents=price_cents,
            specLine=specLine.strip(),
            specs=spec_list,
            # Blank keeps the standard paragraph, as Enter does in the CLI.
            description=description.strip() or STANDARD_DESCRIPTION,
            images=[],
        )
    except ValidationError as exc:
        detail = "; ".join(e["msg"] for e in exc.errors()) or "That listing didn't validate."
        raise HTTPException(400, detail) from None
    except ValueError as exc:
        raise HTTPException(400, f"Invalid choice: {exc}") from None

    images = _save_photos(photos, item_id, settings)
    item = draft.model_copy(update={"images": images})
    try:
        record = request.app.state.code_store.create(item.model_dump(mode="json"), days=lifetime)
    except Exception:
        # Don't leave the photos of a code that never existed.
        shutil.rmtree(settings.code_photos_dir / item_id, ignore_errors=True)
        raise
    return _view(record)


def _save_photos(photos: list[UploadFile], item_id: str, settings: Settings) -> list[str]:
    uploads = [p for p in photos if p.filename]
    if not uploads:
        return []
    pillow = open_pillow()
    if pillow is None:
        raise HTTPException(500, "Pillow isn't installed on the server.")
    Image, ImageOps, _heif = pillow

    dest_dir = settings.code_photos_dir / item_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    paths: list[str] = []
    for upload in uploads:
        dest = dest_dir / f"{len(paths) + 1}.jpg"
        try:
            save_as_jpeg(upload.file, dest, Image, ImageOps)
        except Exception:
            continue
        paths.append(f"/api/code-photos/{item_id}/{dest.name}")

    if not paths:
        shutil.rmtree(dest_dir, ignore_errors=True)
        raise HTTPException(
            400, f"None of the {len(uploads)} photo(s) could be read, so no code was made."
        )
    return paths


@router.post("/{code}/cancel")
def cancel_code(code: str, request: Request):
    record = request.app.state.code_store.cancel(normalize_code(code))
    if record is None:
        raise HTTPException(404, "There's no code like that.")
    if record.status != "cancelled":
        # Already sold or expired: there's nothing live to switch off, and
        # pretending otherwise would hide that it sold.
        raise HTTPException(409, f"That code is already {record.status}.")
    return _view(record)


@public_router.get("/{item_id}/{name}")
def code_photo(item_id: str, name: str, settings: Settings = Depends(get_settings)):
    # Both parts are checked against exact shapes before touching the disk.
    # That's the whole defence against "../" in a URL walking out of the
    # photos folder, so it's a regex rather than a sanitising step.
    if not (_ITEM_ID_RE.fullmatch(item_id) and _PHOTO_RE.fullmatch(name)):
        raise HTTPException(404)
    path = settings.code_photos_dir / item_id / name
    if not path.is_file():
        raise HTTPException(404)
    # A code's photos never change once written — a new listing gets a new
    # id — so they can be cached for good.
    return FileResponse(
        path,
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
