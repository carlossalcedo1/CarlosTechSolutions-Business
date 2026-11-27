"""Codes from the admin panel: gen_code.py as a form.

Pinned here: it builds the same listing gen_code.py does, the code it makes
actually opens for a buyer, its photos are reachable without signing in but
can't be used to read anything else off the disk, and a sold code can't be
"cancelled" into looking unsold.
"""

from __future__ import annotations

import datetime as dt
import io

import pytest
from PIL import Image

from backend.app.codes import CODE_ALPHABET, CODE_LENGTH
from backend.app.inventory import STANDARD_DESCRIPTION
from backend.app.sessions import COOKIE_NAME


@pytest.fixture
def admin(client, session_store):
    client.cookies.set(COOKIE_NAME, session_store.create("cmsal06"))
    return client


def form(**overrides):
    data = {
        "brand": "Apple",
        "model": "iPhone 12",
        "storage": "64GB",
        "condition": "B - Good",
        "inventoryId": "CTS-0200",
        "price": "199",
        "days": "7",
        "specLine": "64GB · Unlocked",
        "specs": "Battery 86%\nFactory unlocked",
        "description": "",
    }
    data.update(overrides)
    return data


def jpeg(w=800, h=600) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (30, 60, 90)).save(buf, "JPEG")
    return buf.getvalue()


# --- auth -------------------------------------------------------------------


@pytest.mark.parametrize(
    "method,path",
    [("get", "/api/admin/codes"), ("post", "/api/admin/codes"), ("post", "/api/admin/codes/ABCD/cancel")],
)
def test_every_admin_route_requires_an_admin(client, method, path):
    assert getattr(client, method)(path).status_code == 401


# --- create -----------------------------------------------------------------


def test_create_builds_what_gen_code_builds(admin):
    res = admin.post("/api/admin/codes", data=form())
    assert res.status_code == 201
    body = res.json()

    code = body["code"]
    assert len(code) == CODE_LENGTH
    assert set(code) <= set(CODE_ALPHABET)
    assert body["status"] == "active" and body["active"] is True

    item = body["item"]
    assert item["name"] == "Apple iPhone 12 64GB"
    assert item["priceCents"] == 19900
    # Random, and unrelated to the code — see CodeStore.create.
    assert item["id"].startswith("code-") and code not in item["id"]
    # Blank description keeps the standard paragraph, like Enter in the CLI.
    assert item["description"] == STANDARD_DESCRIPTION


def test_a_custom_description_is_kept(admin):
    item = admin.post("/api/admin/codes", data=form(description="Small dent on corner.")).json()["item"]
    assert item["description"] == "Small dent on corner."


def test_expiry_follows_days(admin):
    body = admin.post("/api/admin/codes", data=form(days="3")).json()
    created = dt.datetime.fromisoformat(body["createdAt"])
    expires = dt.datetime.fromisoformat(body["expiresAt"])
    assert round((expires - created).total_seconds() / 86400) == 3


def test_the_code_actually_opens_for_a_buyer(admin):
    # The end of the chain: a code made in the panel resolves on the shop's
    # own public lookup, signed out, exactly like one from gen_code.py.
    code = admin.post("/api/admin/codes", data=form()).json()["code"]
    admin.cookies.clear()
    res = admin.get(f"/api/codes/{code}")
    assert res.status_code == 200


@pytest.mark.parametrize(
    "field,value,message",
    [
        ("price", "free", "Price must be a number"),
        ("days", "0", "Days must be"),
        ("days", "366", "Days must be"),
        ("days", "soon", "Days must be"),
        ("specs", " \n ", "at least one spec"),
        ("condition", "Mint", "Invalid choice"),
    ],
)
def test_bad_input_creates_nothing(admin, code_store, field, value, message):
    res = admin.post("/api/admin/codes", data=form(**{field: value}))
    assert res.status_code == 400
    assert message in res.json()["detail"]
    assert code_store.all() == []


# --- photos -----------------------------------------------------------------


def test_photos_go_on_the_data_volume_and_are_public(admin, settings):
    files = [("photos", ("a.jpg", jpeg(3000, 2000), "image/jpeg")), ("photos", ("b.jpg", jpeg(), "image/jpeg"))]
    item = admin.post("/api/admin/codes", data=form(), files=files).json()["item"]
    assert item["images"] == [
        f"/api/code-photos/{item['id']}/1.jpg",
        f"/api/code-photos/{item['id']}/2.jpg",
    ]
    assert (settings.code_photos_dir / item["id"] / "1.jpg").is_file()

    # A buyer opening the code isn't signed in, and has to see the photos.
    admin.cookies.clear()
    res = admin.get(item["images"][0])
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/jpeg"
    with Image.open(io.BytesIO(res.content)) as img:
        assert img.width == 1600  # resized, same as every other photo path


@pytest.mark.parametrize(
    "path",
    [
        "/api/code-photos/../orders.json/1.jpg",
        "/api/code-photos/code-zzzzzzzz/1.jpg",
        "/api/code-photos/code-ab12cd34/..%2F..%2Forders.json",
        "/api/code-photos/code-ab12cd34/0.jpg",
        "/api/code-photos/code-ab12cd34/1.png",
        "/api/code-photos/code-ab12cd34/1.jpg",  # well-formed but doesn't exist
    ],
)
def test_photo_route_reads_nothing_else(client, path):
    # The data volume also holds orders.json, sessions.json and the login
    # codes. A path that escaped the photos folder would serve those to
    # anyone, so the only answer to anything off-pattern is a 404.
    assert client.get(path).status_code == 404


def test_unreadable_photos_create_no_code(admin, code_store, settings):
    files = [("photos", ("x.jpg", b"not an image", "image/jpeg"))]
    res = admin.post("/api/admin/codes", data=form(), files=files)
    assert res.status_code == 400
    assert code_store.all() == []
    # And no orphaned photo folder for the code that was never made.
    assert not settings.code_photos_dir.exists() or not any(settings.code_photos_dir.iterdir())


# --- list and cancel --------------------------------------------------------


def test_list_is_newest_first(admin):
    first = admin.post("/api/admin/codes", data=form(inventoryId="A")).json()["code"]
    second = admin.post("/api/admin/codes", data=form(inventoryId="B")).json()["code"]
    codes = [c["code"] for c in admin.get("/api/admin/codes").json()["codes"]]
    assert codes == [second, first]


def test_cancel_an_active_code(admin):
    code = admin.post("/api/admin/codes", data=form()).json()["code"]
    body = admin.post(f"/api/admin/codes/{code.lower()}/cancel").json()
    assert body["status"] == "cancelled" and body["active"] is False
    # And it no longer opens for a buyer.
    admin.cookies.clear()
    assert admin.get(f"/api/codes/{code}").status_code != 200


def test_a_sold_code_cannot_be_cancelled(admin, code_store):
    code = admin.post("/api/admin/codes", data=form()).json()["code"]
    code_store.mark_sold(code, session_id="cs_1")
    res = admin.post(f"/api/admin/codes/{code}/cancel")
    # 409, not a quiet success — "cancelled" would hide that it sold.
    assert res.status_code == 409
    assert "sold" in res.json()["detail"]


def test_an_expired_code_lists_as_inactive(admin, code_store):
    code = admin.post("/api/admin/codes", data=form(days="1")).json()["code"]
    records = code_store._read()
    records[code].expiresAt = dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=1)
    code_store._write(records)
    row = admin.get("/api/admin/codes").json()["codes"][0]
    assert row["status"] == "expired" and row["active"] is False


def test_cancel_unknown_code(admin):
    assert admin.post("/api/admin/codes/ZZZZ/cancel").status_code == 404
