"""The Stripe webhook handler.

The highest-stakes code in the project: it's where money, stock and
idempotency meet, and a bug here costs either inventory or a buyer's trust
rather than just throwing a 500 someone notices.

Everything after signature verification is covered — verification itself is
Stripe's own code behind a two-line wrapper (payments.py).
"""

from __future__ import annotations

import pytest

from backend.app import main as main_module
from backend.tests.helpers import make_code_item, make_event, make_session


def test_catalog_sale_records_stock_and_sends_everything(client, sold_store, sent, webhook):
    response = webhook(client, make_event(make_session()))

    assert response.status_code == 200
    assert response.json() == {"received": True}
    assert sold_store.units_sold("ipad-air") == 1

    # Buyer confirmation and the operator's "Sold" alert are separate emails
    # to separate addresses, both from this one event.
    recipients = [email["to"] for email in sent["emails"]]
    assert recipients == ["dana@example.com", "sale@example.com"]
    assert len(sent["pushes"]) == 1


def test_amount_charged_wins_over_the_catalog_price(client, sent, webhook):
    """The buyer email says "price paid", so it has to be what Stripe
    actually charged — shipping and promo codes mean that differs from
    priceCents."""
    webhook(client, make_event(make_session(amount_total=34412)))

    buyer_email = sent["emails"][0]
    assert "$344.12" in buyer_email["text"]
    assert "$329" not in buyer_email["text"]


def test_a_retried_delivery_does_not_sell_the_item_twice(client, sold_store, sent, webhook):
    """Stripe retries deliveries, and occasionally sends the same event
    twice. Without the processed-event guard that's two sold units and two
    copies of every email."""
    event = make_event(make_session(), event_id="evt_retry")

    first = webhook(client, event)
    second = webhook(client, event)

    assert first.json() == {"received": True}
    assert second.json() == {"received": True, "duplicate": True}
    assert sold_store.units_sold("ipad-air") == 1
    assert len(sent["emails"]) == 2  # from the first delivery only
    assert len(sent["pushes"]) == 1


def test_a_multi_unit_listing_sells_one_unit_at_a_time(client, sold_store, webhook):
    """The iPod lot has quantity 3. Each sale takes exactly one unit, and the
    listing stays visible until all three are gone."""
    for index in range(2):
        session = make_session(metadata={"item_id": "ipod-lot"})
        webhook(client, make_event(session, event_id=f"evt_lot_{index}"))

    assert sold_store.units_sold("ipod-lot") == 2
    assert "ipod-lot" not in client.get("/api/sold-items").json()["sold_item_ids"]

    webhook(client, make_event(make_session(metadata={"item_id": "ipod-lot"}), event_id="evt_lot_2"))
    assert sold_store.units_sold("ipod-lot") == 3
    assert "ipod-lot" in client.get("/api/sold-items").json()["sold_item_ids"]


def test_an_unknown_item_id_is_logged_not_crashed(client, sold_store, sent, webhook):
    """A sale for something not in the catalog shouldn't 500 — that would
    make Stripe retry forever. Nothing to record, nobody to email."""
    response = webhook(client, make_event(make_session(metadata={"item_id": "does-not-exist"})))

    assert response.status_code == 200
    assert sent["emails"] == []
    assert sent["pushes"] == []
    assert sold_store.units_sold("does-not-exist") == 0


def test_an_unrelated_event_type_is_ignored(client, sold_store, sent, webhook):
    response = webhook(
        client,
        make_event(make_session(), event_type="payment_intent.succeeded"),
    )

    assert response.status_code == 200
    assert sold_store.units_sold("ipad-air") == 0
    assert sent["emails"] == []


def test_a_sale_with_no_buyer_email_still_alerts_the_operator(client, sent, webhook):
    """Stripe can hand back a session with no email. The buyer gets nothing
    (there's nowhere to send it), but the sale still has to be shippable."""
    session = make_session(customer_details={"name": "Dana Reyes", "email": None, "phone": None})
    webhook(client, make_event(session))

    assert [email["to"] for email in sent["emails"]] == ["sale@example.com"]
    assert len(sent["pushes"]) == 1


def test_a_sale_with_no_shipping_address_does_not_crash(client, sent, webhook):
    """Local pickup has no address. The alert should say so rather than
    raise while building the body."""
    session = make_session(collected_information={})
    webhook(client, make_event(session))

    alert = next(email for email in sent["emails"] if email["to"] == "sale@example.com")
    assert "no shipping address" in alert["text"]
    assert len(sent["pushes"]) == 1


def test_shipping_read_from_the_older_top_level_field(client, sent, webhook):
    """Older Stripe API versions put shipping at the top level instead of
    under collected_information. Both are read, so an account API-version
    bump can't silently blank the address."""
    session = make_session(
        collected_information={},
        shipping_details={
            "name": "Dana Reyes",
            "address": {"line1": "9 Oak Ave", "city": "Ocala", "state": "FL", "postal_code": "34470"},
        },
    )
    webhook(client, make_event(session))

    alert = next(email for email in sent["emails"] if email["to"] == "sale@example.com")
    assert "9 Oak Ave" in alert["text"]
    assert "Ocala, FL 34470" in alert["text"]


class TestThePushContents:
    """The template itself is covered in test_notifications.py; these are
    about it being wired up correctly from the handler."""

    def test_the_title_and_body_arrive_as_configured(self, client, sent, webhook):
        webhook(client, make_event(make_session(amount_total=34412)))

        push = sent["pushes"][0]
        assert push["title"] == "iPad Air (4th gen) has been purchased for $344.12"
        assert "Buyer: Dana Reyes" in push["message"]
        assert "118 SW 12th St, Apt 4" in push["message"]
        assert "Inventory: CTS-0142" in push["message"]
        assert push["url"] == "https://dashboard.stripe.com/payments/pi_test_123"
        assert push["priority"] == 1

    def test_the_sale_time_comes_from_the_event_in_the_shop_timezone(self, client, sent, webhook):
        """The handler has to pass event["created"] and settings.timezone
        through; without either, the time is absent or five hours out."""
        webhook(client, make_event(make_session(), created=1764178200))

        assert "Sold: 11/26/2025 12:30" in sent["pushes"][0]["message"]

    def test_the_configured_timezone_is_honoured(self, client, settings, sent, webhook):
        settings.timezone = "UTC"

        webhook(client, make_event(make_session(), created=1764178200))

        assert "Sold: 11/26/2025 17:30" in sent["pushes"][0]["message"]

    def test_the_listing_link_points_at_the_configured_site(self, client, settings, sent, webhook):
        settings.site_url = "https://shop.example.com"

        webhook(client, make_event(make_session()))

        message = sent["pushes"][0]["message"]
        assert '<a href="https://shop.example.com/product/ipad-air">View the listing</a>' in message

    def test_html_mode_is_requested_so_the_link_is_not_raw_markup(self, client, sent, webhook):
        """sale_push returns a Pushover-HTML message, so the handler has to
        ask for html mode. Forget it and the anchor arrives as visible
        markup — which looks broken but raises nothing, so only a test
        catches it."""
        webhook(client, make_event(make_session()))

        assert sent["pushes"][0]["html"] is True

    def test_a_code_sale_links_to_the_code_page(self, client, code_store, sent, webhook):
        record = code_store.create(make_code_item("secret-iphone").model_dump())

        webhook(client, make_event(make_session(metadata={"code": record.code}), event_id="evt_link"))

        message = sent["pushes"][0]["message"]
        assert f"/code/{record.code}" in message
        assert "/product/" not in message

    def test_an_event_with_no_timestamp_still_pushes(self, client, sent, webhook):
        response = webhook(client, make_event(make_session(), created=None))

        assert response.status_code == 200
        assert "Sold: " in sent["pushes"][0]["message"]


class TestCodeOnlySale:
    """A code sale is priced and described by the code's own record, not the
    catalog — the item was never on the shop."""

    def test_marks_the_code_sold_and_uses_its_item(self, client, code_store, sold_store, sent, webhook):
        record = code_store.create(make_code_item("secret-iphone", name="iPhone 13").model_dump())
        session = make_session(metadata={"code": record.code}, id="cs_test_code")

        response = webhook(client, make_event(session, event_id="evt_code"))

        assert response.status_code == 200
        assert code_store.get(record.code).status == "sold"
        assert code_store.get(record.code).checkoutSessionId == "cs_test_code"
        # A code sale is the code's state, not a catalog count.
        assert sold_store.units_sold("secret-iphone") == 0
        assert "iPhone 13" in sent["emails"][0]["subject"]

    def test_the_code_appears_in_the_alert_and_the_push(self, client, code_store, sent, webhook):
        """Without this the operator would go looking for the item in the
        catalog and not find it."""
        record = code_store.create(make_code_item("secret-iphone").model_dump())
        session = make_session(metadata={"code": record.code})

        webhook(client, make_event(session, event_id="evt_code_2"))

        alert = next(email for email in sent["emails"] if email["to"] == "sale@example.com")
        assert record.code in alert["subject"]
        assert record.code in alert["text"]
        assert f"Code: {record.code}" in sent["pushes"][0]["message"]

    def test_a_lowercase_code_in_metadata_still_resolves(self, client, code_store, webhook):
        """Codes are stored uppercase and matched case-insensitively."""
        record = code_store.create(make_code_item().model_dump())
        session = make_session(metadata={"code": record.code.lower()})

        webhook(client, make_event(session, event_id="evt_code_lower"))

        assert code_store.get(record.code).status == "sold"

    def test_an_unknown_code_is_logged_not_crashed(self, client, sent, webhook):
        session = make_session(metadata={"code": "ZZZZ"})
        response = webhook(client, make_event(session, event_id="evt_code_unknown"))

        assert response.status_code == 200
        assert sent["emails"] == []


class TestNotificationFailuresCannotCostASale:
    """Regression tests for the ordering inside the handler.

    By the time notifications run, the sale is recorded and mark_processed
    hasn't happened yet. Anything that escapes is a 500, Stripe retries, the
    retry sails past the already-processed guard, and the sale is counted
    twice — which on a multi-unit listing quietly eats a unit of stock.
    """

    def test_a_failing_push_does_not_double_count_the_sale(
        self, client, sold_store, monkeypatch, webhook
    ):
        def exploding_push(settings, **kwargs):
            raise RuntimeError("pushover is down")

        monkeypatch.setattr(main_module, "send_push", exploding_push)

        response = webhook(client, make_event(make_session(), event_id="evt_push_fail"))

        assert response.status_code == 200
        assert sold_store.units_sold("ipad-air") == 1
        assert sold_store.already_processed("evt_push_fail")

    def test_a_failing_push_body_does_not_double_count_the_sale(
        self, client, sold_store, monkeypatch, webhook
    ):
        """send_push swallows transport errors on its own; this covers the
        other half, where building the message is what raises."""
        def exploding_sale_push(*args, **kwargs):
            raise RuntimeError("could not build the body")

        monkeypatch.setattr(main_module, "sale_push", exploding_sale_push)

        response = webhook(client, make_event(make_session(), event_id="evt_body_fail"))

        assert response.status_code == 200
        assert sold_store.units_sold("ipad-air") == 1
        assert sold_store.already_processed("evt_body_fail")

    @pytest.mark.xfail(
        reason="Email is not wrapped: a Resend outage 500s the webhook and "
               "the retry re-records the sale. Documented, not yet fixed.",
        strict=True,
    )
    def test_a_failing_email_does_not_double_count_the_sale(
        self, client, sold_store, monkeypatch, webhook
    ):
        def exploding_email(settings, **kwargs):
            raise RuntimeError("resend is down")

        monkeypatch.setattr(main_module, "send_email", exploding_email)

        response = webhook(client, make_event(make_session(), event_id="evt_email_fail"))

        assert response.status_code == 200
        assert sold_store.units_sold("ipad-air") == 1
