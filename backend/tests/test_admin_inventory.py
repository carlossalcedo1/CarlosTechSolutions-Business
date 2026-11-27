"""The admin panel's inventory routes.

These are a front end to scripts/add_item.py and scripts/sold_item.py, so
most of what's pinned here is that they behave like the CLIs: same slug,
same validation, same photo conversion, same "log the sale, drop the
listing at zero". The rest is the panel's own business — auth on every
route, refusing to edit where there's no repo, and the deploy button never
running two deploys at once.

Every path the routes write to is redirected into tmp_path by conftest's
`settings`. Nothing here touches the real catalog or runs deploy.sh.
"""

from __future__ import annotations

import datetime as dt
import io
import json
import subprocess

import pytest
from PIL import Image

from backend.app import admin_inventory
from backend.app.catalog import load_catalog, save_catalog
from backend.app.inventory import MAX_WIDTH, STANDARD_DESCRIPTION
from backend.app.sessions import COOKIE_NAME
from backend.tests.helpers import make_item

# --- fixtures ---------------------------------------------------------------


@pytest.fixture(autouse=True)
def _repo_dirs(settings):
    """The routes check frontend/public exists before writing, as their
    "is the repo here?" test. Make it exist in tmp_path."""
    settings.public_items_dir.parent.mkdir(parents=True, exist_ok=True)
    settings.deploy_script.parent.mkdir(parents=True, exist_ok=True)
    settings.deploy_script.write_text("#!/bin/sh\nexit 0\n")
    save_catalog([], settings.catalog_path)


@pytest.fixture(autouse=True)
def _no_deploy_leaks():
    """The deploy handle is module state; it would leak between tests."""
    admin_inventory._deploy_proc = None
    yield
    admin_inventory._deploy_proc = None


@pytest.fixture
def admin(client, session_store):
    """A client holding a real admin session cookie."""
    client.cookies.set(COOKIE_NAME, session_store.create("cmsal06"))
    return client


def png(width=400, height=300, color=(200, 30, 30, 255), mode="RGBA") -> bytes:
    buf = io.BytesIO()
    Image.new(mode, (width, height), color).save(buf, "PNG")
    return buf.getvalue()


def form(**overrides) -> dict:
    data = {
        "category": "Phones",
        "brand": "Apple",
        "model": "iPhone 13",
        "storage": "128GB",
        "condition": "A+ - Excellent",
        "inventoryId": "CTS-0001",
        "price": "289.99",
        "quantity": "1",
        "specLine": "128GB · Unlocked",
        "specs": "Battery 91%\nFactory unlocked\n",
        "featured": "false",
    }
    data.update(overrides)
    return data


def catalog(settings):
    return load_catalog(settings.catalog_path)


# --- auth -------------------------------------------------------------------


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/api/admin/inventory"),
        ("post", "/api/admin/inventory"),
        ("patch", "/api/admin/inventory/x"),
        ("post", "/api/admin/inventory/x/sold"),
        ("get", "/api/admin/deploy"),
        ("post", "/api/admin/deploy"),
    ],
)
def test_every_route_requires_a_signed_in_admin(client, method, path):
    # The router gets require_admin once, where main.py includes it. This
    # is the test that would catch a route added without it.
    res = getattr(client, method)(path)
    assert res.status_code == 401


# --- GET /inventory ---------------------------------------------------------


def test_empty_catalog(admin):
    body = admin.get("/api/admin/inventory").json()
    assert body["items"] == []
    assert body["counts"] == {"Phones": 0, "Tablets": 0, "Computers": 0, "Accessories": 0}
    assert body["repoAvailable"] is True


def test_counts_are_listings_still_for_sale(admin, settings, sold_store):
    save_catalog(
        [
            make_item("a", category="Phones"),
            make_item("b", category="Phones"),
            make_item("c", category="Tablets"),
            make_item("d", category="Computers"),
        ],
        settings.catalog_path,
    )
    # Sold online through Stripe: still in items.json, but not for sale.
    sold_store.record_sale("b")

    body = admin.get("/api/admin/inventory").json()
    assert body["counts"] == {"Phones": 1, "Tablets": 1, "Computers": 1, "Accessories": 0}
    remaining = {row["id"]: row["remaining"] for row in body["items"]}
    assert remaining == {"a": 1, "b": 0, "c": 1, "d": 1}


def test_counts_are_listings_not_units(admin, settings):
    save_catalog([make_item("lot", category="Tablets", quantity=5)], settings.catalog_path)
    assert admin.get("/api/admin/inventory").json()["counts"]["Tablets"] == 1


# --- POST /inventory (create) -----------------------------------------------


def test_create_builds_the_listing_like_the_cli(admin, settings):
    res = admin.post("/api/admin/inventory", data=form())
    assert res.status_code == 201
    item = res.json()
    # Same derivations as add_item.py: name from brand/model/storage, id
    # slugged from the name, the boilerplate description, today's date.
    assert item["name"] == "Apple iPhone 13 128GB"
    assert item["id"] == "apple-iphone-13-128gb"
    assert item["priceCents"] == 28999
    assert item["specs"] == ["Battery 91%", "Factory unlocked"]
    assert item["description"] == STANDARD_DESCRIPTION
    assert item["dateAdded"] == dt.date.today().isoformat()
    assert item["images"] == []


def test_create_writes_the_catalog(admin, settings):
    admin.post("/api/admin/inventory", data=form())
    assert [i.id for i in catalog(settings)] == ["apple-iphone-13-128gb"]


def test_create_updates_what_checkout_prices_from(admin):
    # Checkout reads app.state.catalog, not the file. Without the reload, a
    # brand-new listing couldn't be bought until the API restarted.
    admin.post("/api/admin/inventory", data=form())
    assert "apple-iphone-13-128gb" in admin.app.state.catalog


def test_same_name_twice_gets_a_suffixed_id(admin, settings):
    admin.post("/api/admin/inventory", data=form())
    second = admin.post("/api/admin/inventory", data=form(inventoryId="CTS-0002")).json()
    assert second["id"] == "apple-iphone-13-128gb-2"
    assert len(catalog(settings)) == 2


@pytest.mark.parametrize(
    "field,value,message",
    [
        ("price", "abc", "Price must be a number"),
        ("price", "0", "more than zero"),
        ("price", "inf", "Price must be a number"),
        ("quantity", "0", "at least 1"),
        ("quantity", "two", "whole number"),
        ("specs", "\n\n", "at least one spec"),
        ("category", "Toasters", "Invalid choice"),
        ("condition", "Mint", "Invalid choice"),
    ],
)
def test_bad_input_is_rejected_and_nothing_is_written(admin, settings, field, value, message):
    res = admin.post("/api/admin/inventory", data=form(**{field: value}))
    assert res.status_code == 400
    assert message in res.json()["detail"]
    assert catalog(settings) == []
    assert not settings.public_items_dir.exists()


def test_create_refuses_without_a_repo(admin, settings):
    # The deployed container has no frontend/. Writing its baked-in copy of
    # items.json would succeed, report success, and vanish on redeploy.
    settings.public_items_dir = settings.public_items_dir.parent.parent / "nope" / "items"
    res = admin.post("/api/admin/inventory", data=form())
    assert res.status_code == 503
    assert catalog(settings) == []


# --- photos -----------------------------------------------------------------


def test_photos_are_saved_in_order_as_jpeg(admin, settings):
    files = [("photos", ("front.png", png(), "image/png")), ("photos", ("back.png", png(), "image/png"))]
    item = admin.post("/api/admin/inventory", data=form(), files=files).json()
    assert item["images"] == [
        "/items/apple-iphone-13-128gb/1.jpg",
        "/items/apple-iphone-13-128gb/2.jpg",
    ]
    for name in ("1.jpg", "2.jpg"):
        with Image.open(settings.public_items_dir / item["id"] / name) as img:
            assert img.format == "JPEG"


def test_transparency_is_flattened_onto_white(admin, settings):
    clear = png(color=(0, 0, 0, 0))  # fully transparent
    item = admin.post(
        "/api/admin/inventory", data=form(), files=[("photos", ("cutout.png", clear, "image/png"))]
    ).json()
    with Image.open(settings.public_items_dir / item["id"] / "1.jpg") as img:
        # Straight to JPEG this would be black. Same rule as the CLI.
        assert img.getpixel((10, 10)) == (255, 255, 255)


def test_big_photos_are_resized(admin, settings):
    huge = png(width=4032, height=3024, mode="RGB", color=(10, 120, 200))
    item = admin.post(
        "/api/admin/inventory", data=form(), files=[("photos", ("big.png", huge, "image/png"))]
    ).json()
    with Image.open(settings.public_items_dir / item["id"] / "1.jpg") as img:
        assert img.width == MAX_WIDTH
        assert img.height == round(3024 * MAX_WIDTH / 4032)


def test_an_unreadable_photo_is_skipped_not_fatal(admin, settings):
    files = [
        ("photos", ("good.png", png(), "image/png")),
        ("photos", ("junk.png", b"not an image at all", "image/png")),
        ("photos", ("good2.png", png(), "image/png")),
    ]
    item = admin.post("/api/admin/inventory", data=form(), files=files).json()
    # Numbering stays contiguous — the junk doesn't leave a hole at 2.jpg.
    assert item["images"] == [
        "/items/apple-iphone-13-128gb/1.jpg",
        "/items/apple-iphone-13-128gb/2.jpg",
    ]


def test_all_photos_unreadable_saves_nothing(admin, settings):
    files = [("photos", ("junk.png", b"nope", "image/png"))]
    res = admin.post("/api/admin/inventory", data=form(), files=files)
    assert res.status_code == 400
    # No listing, and no empty photo folder left behind either.
    assert catalog(settings) == []
    assert not (settings.public_items_dir / "apple-iphone-13-128gb").exists()


def test_too_many_photos(admin):
    files = [("photos", (f"{n}.png", png(20, 20), "image/png")) for n in range(11)]
    res = admin.post("/api/admin/inventory", data=form(), files=files)
    assert res.status_code == 400
    assert "most is 10" in res.json()["detail"]


# --- PATCH /inventory/{id} (edit) -------------------------------------------


@pytest.fixture
def listed(admin, settings):
    save_catalog([make_item("iphone", priceCents=30000, quantity=3)], settings.catalog_path)
    return "iphone"


def test_edit_price(admin, settings, listed):
    res = admin.patch(f"/api/admin/inventory/{listed}", json={"field": "price", "value": "249.50"})
    assert res.status_code == 200
    assert res.json()["before"]["priceCents"] == 30000
    assert res.json()["after"]["priceCents"] == 24950
    assert catalog(settings)[0].priceCents == 24950


def test_edit_reaches_checkout_immediately(admin, listed):
    admin.patch(f"/api/admin/inventory/{listed}", json={"field": "price", "value": "100"})
    # Otherwise the panel shows the new price while checkout charges the old.
    assert admin.app.state.catalog[listed].priceCents == 10000


def test_editing_brand_renames_but_keeps_the_url(admin, settings, listed):
    after = admin.patch(
        f"/api/admin/inventory/{listed}", json={"field": "storage", "value": "256GB"}
    ).json()["after"]
    assert after["name"].endswith("256GB")
    # The id is the URL. Changing it would break every link already shared.
    assert after["id"] == listed


def test_edit_specs_from_lines(admin, listed):
    after = admin.patch(
        f"/api/admin/inventory/{listed}", json={"field": "specs", "value": "One\n\nTwo\n"}
    ).json()["after"]
    assert after["specs"] == ["One", "Two"]


def test_edit_featured(admin, listed):
    after = admin.patch(
        f"/api/admin/inventory/{listed}", json={"field": "featured", "value": True}
    ).json()["after"]
    assert after["featured"] is True


def test_bad_edit_changes_nothing(admin, settings, listed):
    res = admin.patch(f"/api/admin/inventory/{listed}", json={"field": "quantity", "value": "-1"})
    assert res.status_code == 400
    assert catalog(settings)[0].quantity == 3


def test_edit_rejects_fields_outside_the_list(admin, listed):
    # id, name, images, description and dateAdded aren't editable here:
    # derived, or not something a dropdown should be able to break.
    for field in ("id", "name", "description", "images"):
        res = admin.patch(f"/api/admin/inventory/{listed}", json={"field": field, "value": "x"})
        assert res.status_code == 422, field


def test_edit_unknown_listing(admin):
    res = admin.patch("/api/admin/inventory/ghost", json={"field": "price", "value": "1"})
    assert res.status_code == 404


# --- POST /inventory/{id}/sold (delete) -------------------------------------


def test_selling_the_last_unit_removes_the_listing(admin, settings):
    save_catalog([make_item("solo")], settings.catalog_path)
    res = admin.post("/api/admin/inventory/solo/sold", json={})
    assert res.json() == {"soldUnits": 1, "remaining": 0, "removed": True}
    assert catalog(settings) == []


def test_the_sale_is_logged_not_erased(admin, settings):
    save_catalog([make_item("solo", priceCents=12345)], settings.catalog_path)
    admin.post("/api/admin/inventory/solo/sold", json={})
    records = json.loads(settings.sold_items_path.read_text())
    assert len(records) == 1
    assert records[0]["id"] == "solo"
    assert records[0]["priceCents"] == 12345
    assert records[0]["soldDate"] == dt.date.today().isoformat()


def test_selling_some_of_a_lot_keeps_the_rest_listed(admin, settings):
    save_catalog([make_item("lot", quantity=3)], settings.catalog_path)
    res = admin.post("/api/admin/inventory/lot/sold", json={"units": 1}).json()
    assert res == {"soldUnits": 1, "remaining": 2, "removed": False}
    assert catalog(settings)[0].quantity == 2
    # The log records the units in *this* sale, not what the listing had.
    assert json.loads(settings.sold_items_path.read_text())[0]["quantity"] == 1


def test_units_default_to_all(admin, settings):
    save_catalog([make_item("lot", quantity=4)], settings.catalog_path)
    res = admin.post("/api/admin/inventory/lot/sold", json={}).json()
    assert res["soldUnits"] == 4
    assert catalog(settings) == []


@pytest.mark.parametrize("units", [0, 4, -1])
def test_units_out_of_range(admin, settings, units):
    save_catalog([make_item("lot", quantity=3)], settings.catalog_path)
    res = admin.post("/api/admin/inventory/lot/sold", json={"units": units})
    assert res.status_code == 400
    assert catalog(settings)[0].quantity == 3


def test_selling_reaches_checkout(admin, settings):
    save_catalog([make_item("solo")], settings.catalog_path)
    admin.post("/api/admin/inventory/solo/sold", json={})
    assert "solo" not in admin.app.state.catalog


def test_sell_unknown_listing(admin):
    assert admin.post("/api/admin/inventory/ghost/sold", json={}).status_code == 404


# --- deploy -----------------------------------------------------------------


class FakeProc:
    """Stands in for deploy.sh. Nothing in this file ever runs the real one."""

    instances: list["FakeProc"] = []

    def __init__(self, args, **kwargs):
        self.args = args
        self.kwargs = kwargs
        self.pid = 424242
        self.code: int | None = None
        FakeProc.instances.append(self)

    def poll(self):
        return self.code


@pytest.fixture
def fake_popen(monkeypatch):
    FakeProc.instances = []
    monkeypatch.setattr(admin_inventory.subprocess, "Popen", FakeProc)
    return FakeProc


def test_deploy_runs_the_script_from_the_repo_root(admin, settings, fake_popen):
    res = admin.post("/api/admin/deploy")
    assert res.status_code == 202
    assert res.json()["status"] == "running"
    proc = fake_popen.instances[0]
    assert proc.args == [str(settings.deploy_script)]
    assert proc.kwargs["cwd"] == settings.deploy_script.resolve().parents[1]
    # It recreates the API's own container on the NUC, so it must not be
    # killed along with the process that started it.
    assert proc.kwargs["start_new_session"] is True


def test_only_one_deploy_at_a_time(admin, fake_popen):
    admin.post("/api/admin/deploy")
    res = admin.post("/api/admin/deploy")
    assert res.status_code == 409
    assert len(fake_popen.instances) == 1


def test_deploy_status_follows_the_process(admin, fake_popen):
    admin.post("/api/admin/deploy")
    assert admin.get("/api/admin/deploy").json()["status"] == "running"

    fake_popen.instances[0].code = 0
    body = admin.get("/api/admin/deploy").json()
    assert body["status"] == "succeeded"
    assert body["exitCode"] == 0
    assert body["lastSuccessAt"]


def test_failed_deploy(admin, fake_popen):
    admin.post("/api/admin/deploy")
    fake_popen.instances[0].code = 1
    body = admin.get("/api/admin/deploy").json()
    assert body["status"] == "failed"
    assert body["exitCode"] == 1


def test_a_finished_deploy_allows_another(admin, fake_popen):
    admin.post("/api/admin/deploy")
    fake_popen.instances[0].code = 0
    admin.get("/api/admin/deploy")
    assert admin.post("/api/admin/deploy").status_code == 202


def test_pending_tracks_changes_since_the_last_good_deploy(admin, fake_popen, settings):
    # A catalog already exists (the fixture writes one) but nothing has been
    # changed through the panel yet — so nothing is waiting.
    assert admin.get("/api/admin/deploy").json()["pendingDeploy"] is False

    admin.post("/api/admin/inventory", data=form())
    assert admin.get("/api/admin/deploy").json()["pendingDeploy"] is True

    admin.post("/api/admin/deploy")
    fake_popen.instances[0].code = 0
    assert admin.get("/api/admin/deploy").json()["pendingDeploy"] is False


def test_a_failed_deploy_leaves_changes_pending(admin, fake_popen):
    admin.post("/api/admin/inventory", data=form())
    admin.post("/api/admin/deploy")
    fake_popen.instances[0].code = 2
    assert admin.get("/api/admin/deploy").json()["pendingDeploy"] is True


def test_deploy_status_after_the_api_restarted(admin, settings):
    # The in-memory handle is gone after a restart. A real process that
    # has already exited gives a pid that's definitely dead. (No fake_popen
    # here: patching admin_inventory.subprocess.Popen patches the stdlib
    # module itself, which would swap out this Popen too.)
    done = subprocess.Popen(["true"])
    done.wait()
    settings.deploy_state_path.write_text(
        json.dumps({"status": "running", "pid": done.pid, "startedAt": 1})
    )
    admin_inventory._deploy_proc = None
    # Whether it worked is no longer knowable — say so rather than guess.
    assert admin.get("/api/admin/deploy").json()["status"] == "unknown"


def test_deploy_refuses_without_the_script(admin, settings, fake_popen):
    settings.deploy_script.unlink()
    res = admin.post("/api/admin/deploy")
    assert res.status_code == 503
    assert fake_popen.instances == []
    assert admin.get("/api/admin/deploy").json()["available"] is False


def test_deploy_log_tail_is_returned(admin, settings, fake_popen):
    settings.deploy_log_path.write_text("\n".join(f"line {n}" for n in range(100)))
    log = admin.get("/api/admin/deploy").json()["log"]
    assert log[-1] == "line 99"
    assert len(log) == 60


def test_a_change_during_a_deploy_stays_pending(admin, fake_popen):
    admin.post("/api/admin/inventory", data=form())
    admin.post("/api/admin/deploy")
    # Edited while the build was already under way — it may or may not have
    # made it in, so the panel keeps suggesting a deploy.
    admin.post("/api/admin/inventory", data=form(inventoryId="CTS-0002"))
    fake_popen.instances[0].code = 0
    assert admin.get("/api/admin/deploy").json()["pendingDeploy"] is True


def test_starting_a_deploy_keeps_the_record_of_what_changed(admin, fake_popen):
    admin.post("/api/admin/inventory", data=form())
    admin.post("/api/admin/deploy")
    fake_popen.instances[0].code = 1  # failed
    # A failed deploy must not have wiped lastChangeAt on its way in.
    assert admin.get("/api/admin/deploy").json()["pendingDeploy"] is True
