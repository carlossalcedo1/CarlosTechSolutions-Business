"""The admin panel's inventory routes: list, create, edit, mark sold, deploy.

A front end to the CLIs rather than a replacement for them. Every write goes
through app/inventory.py — the same slug, photo conversion and sale logic
scripts/add_item.py and scripts/sold_item.py use — and lands in the same
files: scripts/items.json and frontend/public/items/. The catalog stays
static and is published by deploy.sh, exactly as before; the Deploy button
here runs that script, the way the CLIs offer to at the end.

Every route requires a signed-in admin. That's applied once, where this
router is included in main.py, rather than per route — a route added here
later can't forget it.
"""

from __future__ import annotations

import datetime as dt
import json
import os
import shutil
import subprocess
import threading
import time
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel, ValidationError

from .catalog import load_catalog, save_catalog
from .config import Settings, get_settings
from .inventory import (
    STANDARD_DESCRIPTION,
    apply_sale,
    build_name,
    load_sold_items,
    make_sold_record,
    open_pillow,
    parse_price_cents,
    parse_quantity,
    parse_specs,
    save_as_jpeg,
    save_sold_items,
    slugify,
)
from .models import Category, Condition, Item

router = APIRouter(prefix="/api/admin")

# One lock for every read-modify-write of the catalog. The threadpool runs
# sync routes concurrently, so two admins saving at once (or one double-tap
# on a phone) would otherwise both read the same items.json and the second
# write would silently drop the first — a lost update. Same reasoning as
# the stores in sold_store.py and login_codes.py.
_catalog_lock = threading.Lock()

# The Deploy button's child process, while one is running. In memory, so a
# restart of the API loses the handle — status falls back to checking the
# pid recorded in deploy_state.json.
_deploy_lock = threading.Lock()
_deploy_proc: subprocess.Popen | None = None

MAX_PHOTOS = 10
_LOG_TAIL_LINES = 60


# --- helpers ----------------------------------------------------------------


def _require_repo(settings: Settings) -> None:
    """Refuse to edit when there's no repo here to edit.

    Inside the deployed API container there's no frontend/ and no deploy.sh
    — the image is backend/app plus a copy of items.json. Writing to that
    copy would succeed, report success, and vanish on the next deploy. A
    503 that says why is the honest answer instead.
    """
    if not settings.public_items_dir.parent.is_dir():
        raise HTTPException(
            status_code=503,
            detail=(
                "Inventory editing needs the repo, and this server doesn't have "
                "it — it's the deployed container. Edit from a machine running "
                "the API out of a checkout."
            ),
        )


def _reload_app_catalog(request: Request, items: list[Item]) -> None:
    # Checkout prices from app.state.catalog. Without this, an edited price
    # would show in the panel while checkout kept charging the old one until
    # the API restarted.
    request.app.state.catalog = {item.id: item for item in items}


def _readable(exc: ValidationError) -> str:
    """Pydantic's error list, as one line a person can act on."""
    parts = []
    for err in exc.errors():
        where = ".".join(str(p) for p in err.get("loc", ()) if p != "body")
        parts.append(f"{where}: {err['msg']}" if where else err["msg"])
    return "; ".join(parts) or "That listing didn't validate."


def _unique_id(base: str, existing: set[str]) -> str:
    """The CLI asks for a different id on a clash; a phone form shouldn't
    make you invent one, so this appends -2, -3… instead. The id is the URL
    slug, so it has to be unique, but nobody needs to choose it."""
    if base not in existing:
        return base
    n = 2
    while f"{base}-{n}" in existing:
        n += 1
    return f"{base}-{n}"


def _remaining(request: Request, item: Item) -> int:
    """Units still for sale: what the catalog says, minus what sold online.

    Online sales are recorded by the Stripe webhook in sold_store.py and
    never touch items.json; in-person sales (sold_item.py, or Delete here)
    reduce the catalog's quantity directly. This is both at once."""
    sold_online = request.app.state.sold_store.units_sold(item.id)
    return max(item.quantity - sold_online, 0)


# --- read -------------------------------------------------------------------


@router.get("/inventory")
def list_inventory(request: Request, settings: Settings = Depends(get_settings)):
    items = load_catalog(settings.catalog_path)
    rows = []
    for item in items:
        row = item.model_dump(mode="json")
        row["remaining"] = _remaining(request, item)
        rows.append(row)

    # Listings, not units — "3 phones listed" means three things you can
    # click on, which is how the shop reads too.
    counts = {c.value: 0 for c in Category}
    for row in rows:
        if row["remaining"] > 0:
            counts[row["category"]] += 1

    return {
        "items": rows,
        "counts": counts,
        "repoAvailable": settings.public_items_dir.parent.is_dir(),
        "pendingDeploy": _pending_deploy(settings),
    }


# --- create -----------------------------------------------------------------


@router.post("/inventory", status_code=201)
def create_item(
    request: Request,
    settings: Settings = Depends(get_settings),
    category: str = Form(...),
    brand: str = Form("Apple"),
    model: str = Form(...),
    storage: str = Form(...),
    condition: str = Form(...),
    inventoryId: str = Form(...),
    price: str = Form(...),
    quantity: str = Form("1"),
    specLine: str = Form(...),
    specs: str = Form(...),
    featured: bool = Form(False),
    photos: list[UploadFile] = File(default=[]),
):
    """scripts/add_item.py's main(), minus the prompts."""
    _require_repo(settings)

    if len(photos) > MAX_PHOTOS:
        raise HTTPException(400, f"That's {len(photos)} photos — the most is {MAX_PHOTOS}.")

    try:
        price_cents = parse_price_cents(price)
        qty = parse_quantity(quantity)
        spec_list = parse_specs(specs)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from None

    brand, model, storage = brand.strip(), model.strip(), storage.strip()
    name = build_name(brand, model, storage)

    with _catalog_lock:
        items = load_catalog(settings.catalog_path)
        item_id = _unique_id(slugify(name), {i.id for i in items})

        # Validate every field before touching the disk. The CLI converts
        # photos first and validates after, which leaves an orphaned photo
        # folder behind when a field turns out to be wrong; checking first
        # means a rejected listing writes nothing at all.
        try:
            draft = Item(
                id=item_id,
                inventoryId=inventoryId.strip(),
                name=name,
                category=Category(category),
                brand=brand,
                model=model,
                storage=storage,
                condition=Condition(condition),
                priceCents=price_cents,
                quantity=qty,
                specLine=specLine.strip(),
                specs=spec_list,
                description=STANDARD_DESCRIPTION,
                images=[],
                featured=featured,
                dateAdded=dt.date.today().isoformat(),
            )
        # ValidationError first: it subclasses ValueError, so the other
        # order would swallow every field error under the enum message.
        except ValidationError as exc:
            raise HTTPException(400, _readable(exc)) from None
        except ValueError as exc:  # Category()/Condition() on a bad choice
            raise HTTPException(400, f"Invalid choice: {exc}") from None

        images = _save_photos(photos, item_id, settings)
        item = draft.model_copy(update={"images": images})

        items.append(item)
        save_catalog(items, settings.catalog_path)
        _reload_app_catalog(request, items)
        _mark_changed(settings)

    return item.model_dump(mode="json")


def _save_photos(photos: list[UploadFile], item_id: str, settings: Settings) -> list[str]:
    """Same conversion as the CLI's copy_photos — upright, resized JPEG,
    transparency flattened, HEIC accepted — reading uploads instead of a
    folder. Order is kept: the first photo is the one shop cards use."""
    uploads = [p for p in photos if p.filename]
    if not uploads:
        return []

    pillow = open_pillow()
    if pillow is None:
        raise HTTPException(500, "Pillow isn't installed on the server.")
    Image, ImageOps, _heif = pillow

    dest_dir = settings.public_items_dir / item_id
    dest_dir.mkdir(parents=True, exist_ok=True)

    web_paths: list[str] = []
    for upload in uploads:
        dest = dest_dir / f"{len(web_paths) + 1}.jpg"
        try:
            save_as_jpeg(upload.file, dest, Image, ImageOps)
        except Exception:
            # One unreadable photo shouldn't sink the listing — the CLI
            # skips those too.
            continue
        web_paths.append(f"/items/{item_id}/{dest.name}")

    if not web_paths:
        # Every photo failed. Saving the item anyway would be
        # indistinguishable from "no photos were given", so stop, and don't
        # leave an empty folder behind.
        shutil.rmtree(dest_dir, ignore_errors=True)
        raise HTTPException(
            400,
            f"None of the {len(uploads)} photo(s) could be read, so nothing was saved.",
        )
    return web_paths


# --- edit -------------------------------------------------------------------

EditableField = Literal[
    "price",
    "quantity",
    "condition",
    "category",
    "brand",
    "model",
    "storage",
    "inventoryId",
    "specLine",
    "specs",
    "featured",
]


class EditRequest(BaseModel):
    field: EditableField
    value: str | bool


@router.patch("/inventory/{item_id}")
def edit_item(
    item_id: str,
    body: EditRequest,
    request: Request,
    settings: Settings = Depends(get_settings),
):
    """Change one field on one listing — the edit the docs used to tell you
    to make by hand in items.json, with the same validation as adding."""
    _require_repo(settings)

    with _catalog_lock:
        items = load_catalog(settings.catalog_path)
        index = next((i for i, it in enumerate(items) if it.id == item_id), None)
        if index is None:
            raise HTTPException(404, "That listing doesn't exist anymore.")
        before = items[index]
        data = before.model_dump()

        try:
            if body.field == "price":
                data["priceCents"] = parse_price_cents(str(body.value))
            elif body.field == "quantity":
                data["quantity"] = parse_quantity(body.value)
            elif body.field == "specs":
                data["specs"] = parse_specs(str(body.value))
            elif body.field == "featured":
                data["featured"] = body.value in (True, "true", "True", "1", "yes")
            else:
                data[body.field] = str(body.value).strip()
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from None

        # The title is always Brand Model Storage (see build_name), so it
        # follows those three. The id deliberately doesn't: it's the URL,
        # and changing it would break every link already shared to it.
        if body.field in ("brand", "model", "storage"):
            data["name"] = build_name(data["brand"], data["model"], data["storage"])

        try:
            after = Item.model_validate(data)
        except ValidationError as exc:
            raise HTTPException(400, _readable(exc)) from None

        items[index] = after
        save_catalog(items, settings.catalog_path)
        _reload_app_catalog(request, items)
        _mark_changed(settings)

    return {"before": before.model_dump(mode="json"), "after": after.model_dump(mode="json")}


# --- delete (= mark sold) ---------------------------------------------------


class SoldRequest(BaseModel):
    # None means "all of them", which is the only option for a single-unit
    # listing and the default for a bulk one.
    units: int | None = None


@router.post("/inventory/{item_id}/sold")
def mark_sold(
    item_id: str,
    body: SoldRequest,
    request: Request,
    settings: Settings = Depends(get_settings),
):
    """scripts/sold_item.py, one listing at a time: log the sale, then take
    the units off the catalog — dropping the listing once none are left.

    "Delete" in the panel means this rather than erasing the entry, so the
    sale stays on record in sold_items.json with the date it went."""
    _require_repo(settings)

    with _catalog_lock:
        items = load_catalog(settings.catalog_path)
        index = next((i for i, it in enumerate(items) if it.id == item_id), None)
        if index is None:
            raise HTTPException(404, "That listing doesn't exist anymore.")
        item = items[index]

        units = item.quantity if body.units is None else body.units
        if not 1 <= units <= item.quantity:
            raise HTTPException(400, f"Pick between 1 and {item.quantity} unit(s).")

        records = load_sold_items(settings.sold_items_path)
        records.append(make_sold_record(item, units))
        items, remaining = apply_sale(items, index, units)

        # Catalog first, then the log: if the second write failed, the worse
        # outcome is a sale missing from the log, not an item still listed
        # after it's gone.
        save_catalog(items, settings.catalog_path)
        save_sold_items(settings.sold_items_path, records)
        _reload_app_catalog(request, items)
        _mark_changed(settings)

    return {"soldUnits": units, "remaining": remaining, "removed": remaining == 0}


# --- deploy -----------------------------------------------------------------


def _read_deploy_state(settings: Settings) -> dict:
    try:
        return json.loads(settings.deploy_state_path.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return {"status": "idle"}


def _write_deploy_state(settings: Settings, state: dict) -> None:
    path = settings.deploy_state_path
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2) + "\n")
    tmp.replace(path)


def _pending_deploy(settings: Settings) -> bool:
    """Whether the panel has changed inventory since its last good deploy.

    Tracks the panel's own writes rather than the catalog file's mtime. The
    mtime version can't tell "changed here and not yet published" from
    "changed by the CLI and already deployed with it", so the first time
    the panel opened on an existing catalog it would claim undeployed
    changes that went live weeks ago.

    A change made while a deploy is already running counts as pending
    afterwards: whether the build picked it up depends on timing, and
    "deploy again" is the safe thing to suggest."""
    state = _read_deploy_state(settings)
    changed = state.get("lastChangeAt")
    if not changed:
        return False
    return changed > (state.get("lastSuccessAt") or 0)


def _mark_changed(settings: Settings) -> None:
    with _deploy_lock:
        state = _read_deploy_state(settings)
        state["lastChangeAt"] = time.time()
        _write_deploy_state(settings, state)


def _pid_alive(pid: int | None) -> bool:
    if not pid:
        return False
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def _refresh_deploy_state(settings: Settings) -> dict:
    """Settle a running deploy's status, if it has finished."""
    global _deploy_proc
    state = _read_deploy_state(settings)
    if state.get("status") != "running":
        return state

    if _deploy_proc is not None:
        code = _deploy_proc.poll()
        if code is None:
            return state
        _deploy_proc = None
        now = time.time()
        state.update(
            status="succeeded" if code == 0 else "failed",
            exitCode=code,
            finishedAt=now,
        )
        if code == 0:
            state["lastSuccessAt"] = state.get("startedAt", now)
        _write_deploy_state(settings, state)
        return state

    # No handle — the API restarted since the deploy began. A live pid
    # means it's still going; a dead one means it finished, but whether it
    # worked is no longer knowable from here. The log is the record.
    if not _pid_alive(state.get("pid")):
        state.update(status="unknown", finishedAt=time.time())
        _write_deploy_state(settings, state)
    return state


def _log_tail(settings: Settings) -> list[str]:
    try:
        lines = settings.deploy_log_path.read_text(errors="replace").splitlines()
    except FileNotFoundError:
        return []
    return lines[-_LOG_TAIL_LINES:]


@router.get("/deploy")
def deploy_status(settings: Settings = Depends(get_settings)):
    with _deploy_lock:
        state = _refresh_deploy_state(settings)
    return {
        **state,
        "available": settings.deploy_script.exists(),
        "pendingDeploy": _pending_deploy(settings),
        "log": _log_tail(settings),
    }


@router.post("/deploy", status_code=202)
def start_deploy(settings: Settings = Depends(get_settings)):
    """Run deploy/deploy.sh — the same script the CLIs run after adding or
    selling, and for the same reason: the catalog is baked into both the
    frontend build and the API image, so nothing changes on the live site
    until both are rebuilt.

    Started in the background and returned from immediately. A deploy runs
    the tests, rebuilds the frontend and recreates containers; that's
    minutes, and a request held open that long would time out at Cloudflare
    first. The panel polls GET /api/admin/deploy for progress.
    """
    global _deploy_proc
    if not settings.deploy_script.exists():
        raise HTTPException(
            503,
            "deploy.sh isn't here — this server is the deployed container, not a "
            "checkout. Deploy from the machine you edit inventory on.",
        )

    with _deploy_lock:
        state = _refresh_deploy_state(settings)
        if state.get("status") == "running":
            raise HTTPException(409, "A deploy is already running.")

        settings.deploy_log_path.parent.mkdir(parents=True, exist_ok=True)
        log = open(settings.deploy_log_path, "w")  # noqa: SIM115 — handed to the child
        repo_root = settings.deploy_script.resolve().parents[1]
        # start_new_session: the deploy recreates the API's own container on
        # the NUC, so it must not die with the process that started it.
        _deploy_proc = subprocess.Popen(
            [str(settings.deploy_script)],
            cwd=repo_root,
            stdout=log,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            start_new_session=True,
        )
        log.close()  # the child holds its own descriptor now

        state = {
            "status": "running",
            "pid": _deploy_proc.pid,
            "startedAt": time.time(),
            "lastSuccessAt": state.get("lastSuccessAt"),
            "lastChangeAt": state.get("lastChangeAt"),
        }
        _write_deploy_state(settings, state)

    return state
