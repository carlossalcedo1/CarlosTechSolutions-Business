"""Packages: tracking numbers watched through Shippo, and the webhook that
reports back. Shippo itself is never called — register_track is replaced
with a fake that records what it was asked and answers like Shippo would."""

from __future__ import annotations

import pytest

from backend.app import admin_packages
from backend.app.sessions import COOKIE_NAME
from backend.app.shippo import ShippoFailed

NUMBER = "9400111899223397846321"


def track(status: str, *, number=NUMBER, city="Gainesville", state="FL", substatus=None):
    return {
        "carrier": "usps",
        "tracking_number": number,
        "tracking_status": {
            "status": status,
            "status_details": f"Status is {status}",
            "status_date": "2026-11-26T15:00:00Z",
            "location": {"city": city, "state": state, "zip": "32601", "country": "US"},
            "substatus": substatus,
        },
        "tracking_history": [],
    }


@pytest.fixture
def admin(client, session_store):
    client.cookies.set(COOKIE_NAME, session_store.create("cmsal06"))
    return client


@pytest.fixture
def shippo(settings, monkeypatch):
    """Shippo switched on, with a fake registration call."""
    settings.shippo_api_token = "shippo_test_fake"
    settings.shippo_webhook_token = "hook-secret"
    calls = []

    def fake_register(settings, number, metadata="", carrier="usps"):
        calls.append({"number": number, "metadata": metadata, "carrier": carrier})
        return track("PRE_TRANSIT", number=number)

    monkeypatch.setattr(admin_packages, "register_track", fake_register)
    return calls


def add(admin, number=NUMBER, label="Parts: iPhone 13 screens"):
    return admin.post("/api/admin/packages", json={"trackingNumber": number, "label": label})


def hook(client, payload, token="hook-secret"):
    return client.post(f"/api/shippo-webhook?token={token}", json=payload)


# --- adding ---------------------------------------------------------------------


def test_adding_registers_with_shippo(admin, shippo):
    body = add(admin, "9400 1118 9922 3397 8463 21").json()
    assert shippo == [{"number": NUMBER, "metadata": "Parts: iPhone 13 screens", "carrier": "usps"}]
    assert body["kind"] == "parts"
    assert body["registeredAt"] is not None
    # The registration reply already carries a status.
    assert body["status"] == "PRE_TRANSIT"
    assert body["location"] == "Gainesville, FL"
    listing = admin.get("/api/admin/packages").json()
    assert listing["usedThisMonth"] == 1
    assert listing["monthlyLimit"] == 30
    assert listing["configured"] is True


def test_the_same_number_is_not_registered_twice(admin, shippo):
    first = add(admin).json()
    second = add(admin, label="Something else").json()
    assert first["id"] == second["id"]
    assert len(shippo) == 1


def test_a_bad_number_is_refused(admin, shippo):
    assert add(admin, "123").status_code == 400
    assert shippo == []


def test_needs_admin(client, shippo):
    assert client.get("/api/admin/packages").status_code == 401
    assert add(client).status_code == 401


def test_stops_at_the_free_allowance(admin, shippo, settings):
    settings.shippo_monthly_limit = 2
    add(admin, "AA111111111US")
    add(admin, "AA222222222US")
    third = add(admin, "AA333333333US").json()
    # Kept, but not registered: past the allowance it would cost money.
    assert len(shippo) == 2
    assert third["registeredAt"] is None
    assert "used up" in third["registerError"]


def test_deleting_does_not_give_the_registration_back(admin, shippo, package_store):
    package = add(admin).json()
    assert admin.delete(f"/api/admin/packages/{package['id']}").status_code == 200
    assert admin.get("/api/admin/packages").json()["usedThisMonth"] == 1


def test_a_shippo_failure_is_kept_and_can_be_retried(admin, shippo, monkeypatch):
    def down(settings, number, metadata="", carrier="usps"):
        raise ShippoFailed("HTTP 500")

    monkeypatch.setattr(admin_packages, "register_track", down)
    package = add(admin).json()
    assert package["registeredAt"] is None
    assert package["registerError"]
    assert admin.get("/api/admin/packages").json()["usedThisMonth"] == 0

    monkeypatch.setattr(admin_packages, "register_track", lambda s, n, metadata="", carrier="usps": track("TRANSIT", number=n))
    retried = admin.post(f"/api/admin/packages/{package['id']}/register").json()
    assert retried["registeredAt"] is not None
    assert retried["registerError"] is None
    assert retried["status"] == "TRANSIT"


def test_without_shippo_it_says_so(admin):
    package = add(admin).json()
    assert package["registeredAt"] is None
    assert "isn't set up" in package["registerError"]


# --- orders ---------------------------------------------------------------------


def test_tracking_an_order_adds_it_to_packages(admin, shippo, order_store):
    order_store.record({"id": "cs_1", "itemName": "iPhone 13 128GB", "customerEmail": None})
    admin.put("/api/admin/orders/cs_1/tracking", json={"trackingNumber": NUMBER})
    packages = admin.get("/api/admin/packages").json()["packages"]
    assert len(packages) == 1
    assert packages[0]["kind"] == "order"
    assert packages[0]["orderId"] == "cs_1"
    assert packages[0]["label"] == "iPhone 13 128GB"


def test_an_order_still_saves_tracking_when_shippo_is_down(admin, shippo, order_store, monkeypatch):
    def down(settings, number, metadata="", carrier="usps"):
        raise ShippoFailed("timeout")

    monkeypatch.setattr(admin_packages, "register_track", down)
    order_store.record({"id": "cs_1", "itemName": "iPhone 13", "customerEmail": None})
    response = admin.put("/api/admin/orders/cs_1/tracking", json={"trackingNumber": NUMBER})
    assert response.status_code == 200
    assert order_store.get("cs_1")["trackingNumber"] == NUMBER


# --- webhook --------------------------------------------------------------------


def test_delivered_pushes_once(admin, shippo, sent):
    add(admin)
    assert hook(admin, {"event": "track_updated", "data": track("TRANSIT")}).status_code == 200
    assert sent["pushes"] == []
    hook(admin, {"event": "track_updated", "data": track("DELIVERED")})
    assert len(sent["pushes"]) == 1
    push = sent["pushes"][0]
    assert push["title"] == "Delivered: Parts: iPhone 13 screens"
    assert NUMBER in push["message"] and "Gainesville, FL" in push["message"]
    # Shippo can repeat an update; the push mustn't.
    hook(admin, {"event": "track_updated", "data": track("DELIVERED")})
    assert len(sent["pushes"]) == 1
    package = admin.get("/api/admin/packages").json()["packages"][0]
    assert package["status"] == "DELIVERED"
    assert package["deliveredAt"] is not None


def test_webhook_needs_the_token(client, admin, shippo, sent):
    add(admin)
    payload = {"event": "track_updated", "data": track("DELIVERED")}
    assert hook(client, payload, token="wrong").status_code == 404
    assert client.post("/api/shippo-webhook", json=payload).status_code == 404
    assert sent["pushes"] == []


def test_webhook_is_off_without_a_configured_token(client, settings):
    settings.shippo_webhook_token = ""
    assert hook(client, {"event": "track_updated"}, token="").status_code == 404


def test_unknown_numbers_and_other_events_are_ignored(admin, shippo, sent):
    add(admin)
    assert hook(admin, {"event": "track_updated", "data": track("DELIVERED", number="ZZ999999999US")}).status_code == 200
    assert hook(admin, {"event": "transaction_created", "data": {}}).status_code == 200
    assert sent["pushes"] == []


def test_a_carrier_can_be_picked(admin, shippo):
    body = admin.post(
        "/api/admin/packages",
        json={"trackingNumber": "1Z999AA10123456784", "label": "Parts: batteries", "carrier": "ups"},
    ).json()
    assert body["carrier"] == "ups"
    assert shippo[-1]["carrier"] == "ups"
    fedex = admin.post(
        "/api/admin/packages",
        json={"trackingNumber": "123456789012", "label": "Parts: screens", "carrier": "fedex"},
    ).json()
    assert fedex["carrier"] == "fedex"


def test_an_unknown_carrier_is_refused(admin, shippo):
    response = admin.post(
        "/api/admin/packages",
        json={"trackingNumber": NUMBER, "label": "x", "carrier": "dhl"},
    )
    assert response.status_code == 422
    assert shippo == []


def test_orders_are_tracked_as_usps(admin, shippo, order_store):
    order_store.record({"id": "cs_1", "itemName": "iPhone 13", "customerEmail": None})
    admin.put("/api/admin/orders/cs_1/tracking", json={"trackingNumber": NUMBER})
    assert shippo[-1]["carrier"] == "usps"


def test_a_blank_monthly_limit_falls_back_to_30(monkeypatch):
    # .env.example ships SHIPPO_MONTHLY_LIMIT= blank; copied as-is, that
    # mustn't stop the API from starting.
    from backend.app.config import Settings

    monkeypatch.setenv("SHIPPO_MONTHLY_LIMIT", "")
    assert Settings(_env_file=None).shippo_monthly_limit == 30
    monkeypatch.setenv("SHIPPO_MONTHLY_LIMIT", "12")
    assert Settings(_env_file=None).shippo_monthly_limit == 12
