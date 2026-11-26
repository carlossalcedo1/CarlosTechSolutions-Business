"""Checkout session creation — payments.py rule 1.

"Never trust a price from the browser." The request carries an id or a code
and nothing else; the price handed to Stripe is always looked up server-side.
These tests assert that by capturing what create_checkout_session actually
received, rather than trusting the comment.
"""

from __future__ import annotations

import datetime as dt

from backend.tests.helpers import make_code_item


class TestPricingComesFromTheServer:
    def test_the_item_handed_to_stripe_is_the_catalog_item(self, client, stripe_calls):
        response = client.post("/api/checkout", json={"item_id": "ipad-air"})

        assert response.status_code == 200
        assert response.json()["url"].startswith("https://checkout.stripe.com/")
        assert stripe_calls[0]["item"].priceCents == 32900

    def test_a_price_in_the_request_body_is_ignored_entirely(self, client, stripe_calls):
        """The schema forbids unknown fields' influence by simply not having
        a price field — a body that tries anyway is priced from the catalog."""
        client.post(
            "/api/checkout",
            json={"item_id": "ipad-air", "priceCents": 1, "amount": 1, "price": "0.01"},
        )

        assert stripe_calls[0]["item"].priceCents == 32900

    def test_a_code_checkout_is_priced_from_the_code_record(self, client, code_store, stripe_calls):
        record = code_store.create(make_code_item(priceCents=15000).model_dump())

        response = client.post("/api/checkout", json={"code": record.code})

        assert response.status_code == 200
        assert stripe_calls[0]["item"].priceCents == 15000
        # The code travels into session metadata so the webhook can tell a
        # code sale from a catalog one.
        assert stripe_calls[0]["code"] == record.code


class TestRequestShape:
    def test_an_unknown_item_is_a_404(self, client, stripe_calls):
        response = client.post("/api/checkout", json={"item_id": "nope"})

        assert response.status_code == 404
        assert stripe_calls == []

    def test_neither_an_id_nor_a_code_is_rejected(self, client, stripe_calls):
        response = client.post("/api/checkout", json={})

        assert response.status_code == 422
        assert stripe_calls == []

    def test_both_an_id_and_a_code_is_rejected(self, client, stripe_calls):
        """Exactly one, or the handler would have to decide which wins."""
        response = client.post("/api/checkout", json={"item_id": "ipad-air", "code": "ABCD"})

        assert response.status_code == 422
        assert stripe_calls == []


class TestSoldOutCannotBeBought:
    def test_a_sold_out_item_is_a_409(self, client, sold_store, stripe_calls):
        sold_store.record_sale("ipad-air")

        response = client.post("/api/checkout", json={"item_id": "ipad-air"})

        assert response.status_code == 409
        assert stripe_calls == []

    def test_a_multi_unit_item_is_still_buyable_with_stock_left(self, client, sold_store, stripe_calls):
        sold_store.record_sale("ipod-lot")
        sold_store.record_sale("ipod-lot")

        response = client.post("/api/checkout", json={"item_id": "ipod-lot"})

        assert response.status_code == 200
        assert len(stripe_calls) == 1

    def test_a_multi_unit_item_closes_once_every_unit_is_gone(self, client, sold_store, stripe_calls):
        for _ in range(3):
            sold_store.record_sale("ipod-lot")

        response = client.post("/api/checkout", json={"item_id": "ipod-lot"})

        assert response.status_code == 409
        assert stripe_calls == []

    def test_a_sold_code_is_a_409(self, client, code_store, stripe_calls):
        record = code_store.create(make_code_item().model_dump())
        code_store.mark_sold(record.code, session_id="cs_earlier")

        response = client.post("/api/checkout", json={"code": record.code})

        assert response.status_code == 409
        assert stripe_calls == []


class TestDeadCodesCannotBeBought:
    def test_an_expired_code_is_a_404(self, client, code_store, stripe_calls):
        record = code_store.create(make_code_item().model_dump(), days=1)
        _expire(code_store, record.code)

        response = client.post("/api/checkout", json={"code": record.code})

        assert response.status_code == 404
        assert stripe_calls == []

    def test_a_cancelled_code_is_a_404(self, client, code_store, stripe_calls):
        record = code_store.create(make_code_item().model_dump())
        code_store.cancel(record.code)

        response = client.post("/api/checkout", json={"code": record.code})

        assert response.status_code == 404
        assert stripe_calls == []

    def test_a_nonexistent_code_is_a_404(self, client, stripe_calls):
        response = client.post("/api/checkout", json={"code": "ZZZZ"})

        assert response.status_code == 404
        assert stripe_calls == []


def test_checkout_fails_loudly_when_stripe_is_unconfigured(client, settings, stripe_calls):
    """config.py defaults every secret to blank so the app can boot without
    them; the routes that need one are expected to 500 with a clear message
    rather than the container refusing to start."""
    settings.stripe_secret_key = ""

    response = client.post("/api/checkout", json={"item_id": "ipad-air"})

    assert response.status_code == 500
    assert stripe_calls == []


def _expire(code_store, code: str) -> None:
    """Backdate expiresAt. Expiry is derived from the timestamp rather than
    stored as a state, so there's no 'expire it' method to call."""
    records = code_store._read()
    records[code].expiresAt = dt.datetime.now(dt.timezone.utc) - dt.timedelta(seconds=1)
    code_store._write(records)
