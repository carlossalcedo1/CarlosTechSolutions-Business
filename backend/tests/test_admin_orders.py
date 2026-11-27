"""Orders: recorded by the Stripe webhook, shipped from the admin panel.

The webhook tests matter most. It's the code where a careless addition costs
real stock — anything that raises after a sale is recorded makes Stripe
retry and the sale count twice — so recording an order is pinned here to be
both harmless when it fails and inert when it's repeated.
"""

from __future__ import annotations

import pytest

from backend.app.orders import (
    OrderStore,
    normalize_tracking,
    usps_tracking_url,
    validate_tracking,
)
from backend.app.sessions import COOKIE_NAME
from backend.tests.helpers import make_code_item, make_event, make_session


@pytest.fixture
def admin(client, session_store):
    client.cookies.set(COOKIE_NAME, session_store.create("cmsal06"))
    return client


def seed(store: OrderStore, n: int, *, shipped=()):
    for i in range(n):
        store.record(
            {
                "id": f"cs_{i}",
                "createdAt": 1_700_000_000 + i,  # higher i = newer
                "itemId": f"item-{i}",
                "itemName": f"Item {i}",
                "code": None,
                "customerName": f"Buyer {i}",
                "customerEmail": f"b{i}@example.com",
                "amountCents": 10_000 + i,
                "currency": "usd",
                "shippingName": f"Buyer {i}",
                "shippingAddress": None,
                "paymentIntent": f"pi_{i}",
                "shippedAt": None,
                "trackingNumber": None,
            }
        )
    for i in shipped:
        store.mark_shipped(f"cs_{i}")


# --- the webhook records orders ---------------------------------------------


def test_a_sale_records_an_order(client, order_store, webhook):
    webhook(client, make_event(make_session(id="cs_live_1", amount_total=34412)))
    order = order_store.get("cs_live_1")
    assert order["itemName"] == "iPad Air (4th gen)"
    assert order["customerName"] == "Dana Reyes"
    assert order["customerEmail"] == "dana@example.com"
    # What Stripe charged, not the catalog price.
    assert order["amountCents"] == 34412
    assert order["shippingAddress"]["city"] == "Gainesville"
    assert order["shippedAt"] is None


def test_the_order_is_a_snapshot(client, order_store, webhook):
    # The listing usually leaves the catalog once it sells. The order still
    # has to say what it was.
    webhook(client, make_event(make_session(id="cs_snap")))
    client.app.state.catalog.clear()
    assert order_store.get("cs_snap")["itemName"] == "iPad Air (4th gen)"


def test_a_code_sale_records_the_code(client, order_store, code_store, webhook):
    record = code_store.create(make_code_item("code-ab12cd34").model_dump(mode="json"))
    session = make_session(id="cs_code", metadata={"code": record.code})
    webhook(client, make_event(session))
    assert order_store.get("cs_code")["code"] == record.code


def test_a_retry_does_not_reset_a_shipped_order(client, order_store, webhook):
    """Stripe can redeliver days later. Overwriting on a retry would quietly
    flip an order you'd shipped back to unshipped and lose its tracking."""
    event = make_event(make_session(id="cs_retry"), event_id="evt_retry_1")
    webhook(client, event)
    order_store.set_tracking("cs_retry", "9400111899223397846321")

    # Same session, delivered again as a different event — the one case the
    # webhook's own processed-event check wouldn't catch.
    webhook(client, make_event(make_session(id="cs_retry"), event_id="evt_retry_2"))
    order = order_store.get("cs_retry")
    assert order["trackingNumber"] == "9400111899223397846321"
    assert order["shippedAt"] is not None


def test_a_failing_order_store_never_double_counts_a_sale(
    client, order_store, sold_store, sent, webhook, monkeypatch
):
    """The property that matters most. If recording the order raised out of
    the webhook, Stripe would get a 500, retry, and the sale would count
    twice — for a multi-unit listing, a unit of stock quietly gone."""

    def boom(order):
        raise OSError("disk full")

    monkeypatch.setattr(order_store, "record", boom)
    response = webhook(client, make_event(make_session(id="cs_boom")))

    assert response.status_code == 200
    assert sold_store.units_sold("ipad-air") == 1
    # And the emails still went: those are how you'd find out to ship it.
    assert len(sent["emails"]) == 2


def test_unknown_item_records_no_order(client, order_store, webhook):
    webhook(client, make_event(make_session(id="cs_ghost", metadata={"item_id": "ghost"})))
    assert order_store.get("cs_ghost") is None


# --- the store --------------------------------------------------------------


def test_record_needs_an_id(order_store):
    with pytest.raises(ValueError):
        order_store.record({"id": None})


def test_marking_shipped_twice_keeps_the_first_time(order_store):
    seed(order_store, 1)
    first = order_store.mark_shipped("cs_0")["shippedAt"]
    assert order_store.mark_shipped("cs_0")["shippedAt"] == first


def test_tracking_after_shipping_keeps_the_ship_time(order_store):
    seed(order_store, 1, shipped=[0])
    shipped_at = order_store.get("cs_0")["shippedAt"]
    order_store.set_tracking("cs_0", "EA123456789US")
    assert order_store.get("cs_0")["shippedAt"] == shipped_at


def test_orders_survive_a_restart(settings):
    seed(OrderStore(settings.orders_path), 2)
    assert len(OrderStore(settings.orders_path).all_newest_first()) == 2


# --- tracking numbers -------------------------------------------------------


@pytest.mark.parametrize(
    "raw,clean",
    [
        ("9400 1118 9922 3397 8463 21", "9400111899223397846321"),
        ("ea123456789us", "EA123456789US"),
        ("9400-1118-9922", "940011189922"),
    ],
)
def test_tracking_numbers_are_normalized(raw, clean):
    # Labels print them in groups; USPS wants them run together.
    assert normalize_tracking(raw) == clean


@pytest.mark.parametrize("raw", ["123", "not a number!", "94001118992233978463219400111899223397846321"])
def test_bad_tracking_numbers_are_rejected(raw):
    with pytest.raises(ValueError):
        validate_tracking(raw)


def test_usps_link():
    assert usps_tracking_url("EA123456789US") == (
        "https://tools.usps.com/go/TrackConfirmAction?tLabels=EA123456789US"
    )


# --- routes -----------------------------------------------------------------


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/api/admin/orders"),
        ("get", "/api/admin/orders/cs_0"),
        ("post", "/api/admin/orders/cs_0/shipped"),
        ("put", "/api/admin/orders/cs_0/tracking"),
    ],
)
def test_every_route_requires_an_admin(client, method, path):
    assert getattr(client, method)(path).status_code == 401


def test_only_the_five_newest_newest_first(admin, order_store):
    seed(order_store, 8)
    body = admin.get("/api/admin/orders").json()
    assert [o["id"] for o in body["orders"]] == ["cs_7", "cs_6", "cs_5", "cs_4", "cs_3"]
    assert body["total"] == 8


def test_unshipped_orders_beyond_the_five_are_counted(admin, order_store):
    # cs_0..cs_2 fall outside the five shown; one of them already shipped.
    seed(order_store, 8, shipped=[1])
    assert admin.get("/api/admin/orders").json()["olderUnshipped"] == 2


def test_status_and_link_are_derived(admin, order_store):
    seed(order_store, 1)
    order = admin.get("/api/admin/orders/cs_0").json()
    assert order["status"] == "paid"
    assert order["trackingUrl"] is None


def test_mark_shipped_route(admin, order_store):
    seed(order_store, 1)
    body = admin.post("/api/admin/orders/cs_0/shipped").json()
    assert body["status"] == "shipped"
    assert body["trackingNumber"] is None


def test_tracking_route_ships_and_links(admin, order_store):
    seed(order_store, 1)
    body = admin.put(
        "/api/admin/orders/cs_0/tracking", json={"trackingNumber": "9400 1118 9922 3397 8463 21"}
    ).json()
    assert body["status"] == "shipped"
    assert body["trackingNumber"] == "9400111899223397846321"
    assert body["trackingUrl"].endswith("tLabels=9400111899223397846321")


def test_bad_tracking_changes_nothing(admin, order_store):
    seed(order_store, 1)
    res = admin.put("/api/admin/orders/cs_0/tracking", json={"trackingNumber": "abc"})
    assert res.status_code == 400
    assert order_store.get("cs_0")["shippedAt"] is None


@pytest.mark.parametrize(
    "method,path,kwargs",
    [
        ("get", "/api/admin/orders/nope", {}),
        ("post", "/api/admin/orders/nope/shipped", {}),
        ("put", "/api/admin/orders/nope/tracking", {"json": {"trackingNumber": "EA123456789US"}}),
    ],
)
def test_unknown_order(admin, method, path, kwargs):
    assert getattr(admin, method)(path, **kwargs).status_code == 404


# --- the "your order has shipped" email -------------------------------------


@pytest.fixture
def can_email(settings):
    # The test settings carry no Resend key on purpose (see conftest). Give
    # them a fake one; the autouse `sent` fixture captures the send.
    settings.resend_api_key = "re_test_fake"
    return settings


def add_tracking(admin, number="9400 1118 9922 3397 8463 21", order_id="cs_0"):
    return admin.put(f"/api/admin/orders/{order_id}/tracking", json={"trackingNumber": number})


def test_adding_tracking_emails_the_buyer(admin, order_store, sent, can_email):
    seed(order_store, 1)
    body = add_tracking(admin).json()
    assert body["shippedEmail"] == "sent"

    assert len(sent["emails"]) == 1
    email = sent["emails"][0]
    assert email["to"] == "b0@example.com"
    assert email["subject"] == "Your order has shipped"
    assert "Your Item 0 is on its way." in email["text"]
    # The working link has the number unbroken; the printed one is grouped
    # in fours to match the label.
    assert "tLabels=9400111899223397846321" in email["html"]
    assert "9400 1118 9922 3397 8463 21" in email["text"]


def test_the_email_points_to_text_not_reply(admin, order_store, sent, can_email):
    seed(order_store, 1)
    add_tracking(admin)
    email = sent["emails"][0]
    assert "text us at (305) 763-2541" in email["text"]
    assert "reply" not in email["text"].lower()
    assert 'href="sms:+13057632541"' in email["html"]
    # And it doesn't set one either — the email doesn't invite a reply.
    assert not email.get("reply_to")


def test_the_email_is_nexfix_branded(admin, order_store, sent, can_email):
    seed(order_store, 1)
    add_tracking(admin)
    email = sent["emails"][0]
    assert "NexFix" in email["html"] and "NexFix" in email["text"]
    assert "CarlosTechSolutions" not in email["html"] + email["text"]


def test_correcting_the_number_does_not_email_again(admin, order_store, sent, can_email):
    seed(order_store, 1)
    add_tracking(admin)
    body = add_tracking(admin, "EA123456789US").json()
    # A second "your order has shipped" reads like a second package.
    assert body["shippedEmail"] == "already-sent"
    assert len(sent["emails"]) == 1
    # The corrected number is still saved.
    assert order_store.get("cs_0")["trackingNumber"] == "EA123456789US"


def test_a_failed_send_keeps_the_tracking_and_retries_later(
    admin, order_store, sent, can_email, monkeypatch
):
    from backend.app import admin_orders

    seed(order_store, 1)

    def down(settings, **kwargs):
        raise RuntimeError("Resend is down")

    monkeypatch.setattr(admin_orders, "send_email", down)
    body = add_tracking(admin).json()
    assert body["shippedEmail"] == "failed"
    # The number typed off the label is the thing that mustn't be lost.
    assert order_store.get("cs_0")["trackingNumber"] == "9400111899223397846321"
    assert order_store.get("cs_0").get("shippedEmailSentAt") is None

    # Saving again once email is back sends it — which is why "sent" is its
    # own field and not inferred from the tracking number being present.
    monkeypatch.setattr(admin_orders, "send_email", lambda settings, **kw: sent["emails"].append(kw))
    assert add_tracking(admin).json()["shippedEmail"] == "sent"
    assert len(sent["emails"]) == 1


def test_no_email_on_the_order(admin, order_store, sent, can_email):
    seed(order_store, 1)
    order_store._update("cs_0", customerEmail=None)
    assert add_tracking(admin).json()["shippedEmail"] == "no-email"
    assert sent["emails"] == []


def test_without_a_resend_key_it_says_so(admin, order_store, sent):
    # mailer.py logs and returns as if it had sent when there's no key; the
    # route checks first so the panel doesn't claim an email went out.
    seed(order_store, 1)
    assert add_tracking(admin).json()["shippedEmail"] == "not-configured"
    assert sent["emails"] == []
    assert order_store.get("cs_0").get("shippedEmailSentAt") is None


def test_mark_shipped_alone_sends_nothing(admin, order_store, sent, can_email):
    # No tracking number, so nothing worth emailing yet.
    seed(order_store, 1)
    admin.post("/api/admin/orders/cs_0/shipped")
    assert sent["emails"] == []


def test_order_confirmation_is_nexfix_branded_too(client, sent, webhook):
    webhook(client, make_event(make_session()))
    buyer = sent["emails"][0]
    assert "NexFix" in buyer["html"] and "NexFix" in buyer["text"]
    assert "CarlosTechSolutions" not in buyer["html"] + buyer["text"]
