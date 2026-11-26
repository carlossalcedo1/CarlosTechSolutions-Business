"""Code-only listings: the store's semantics and the lookup endpoint.

The security-relevant property here is that a guesser can't learn anything
from an error. 31**4 is about 920k codes, which is small enough to sweep, so
expired, cancelled and never-existed all have to look identical from
outside — and the rate limiter has to hold.
"""

from __future__ import annotations

import datetime as dt

import pytest

from backend.app.codes import CODE_ALPHABET, CODE_LENGTH, MAX_LIFETIME_DAYS, normalize_code
from backend.tests.helpers import make_code_item


def _expire(code_store, code: str) -> None:
    records = code_store._read()
    records[code].expiresAt = dt.datetime.now(dt.timezone.utc) - dt.timedelta(seconds=1)
    code_store._write(records)


class TestNormalisation:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("k7mx", "K7MX"),
            ("K7-MX", "K7MX"),
            (" k7 mx ", "K7MX"),
            ("k7.mx!", "K7MX"),
        ],
    )
    def test_codes_are_uppercased_and_stripped_of_punctuation(self, raw, expected):
        """A code gets read off one phone screen and typed on another, so
        spacing and dashes a buyer adds shouldn't matter."""
        assert normalize_code(raw) == expected


class TestGeneratedCodes:
    def test_a_new_code_uses_only_unambiguous_characters(self, code_store):
        """No 0/O or 1/I/L — they get misread when typed from a photo."""
        record = code_store.create(make_code_item().model_dump())

        assert len(record.code) == CODE_LENGTH
        assert set(record.code) <= set(CODE_ALPHABET)
        assert not set(record.code) & set("01OIL")

    def test_a_new_code_starts_active_with_the_default_lifetime(self, code_store):
        record = code_store.create(make_code_item().model_dump())

        assert record.status == "active"
        assert record.soldAt is None
        assert (record.expiresAt - record.createdAt).days == 7

    def test_a_custom_lifetime_is_honoured(self, code_store):
        record = code_store.create(make_code_item().model_dump(), days=30)

        assert (record.expiresAt - record.createdAt).days == 30

    @pytest.mark.parametrize("days", [0, -1, MAX_LIFETIME_DAYS + 1])
    def test_an_out_of_range_lifetime_is_refused(self, code_store, days):
        with pytest.raises(ValueError):
            code_store.create(make_code_item().model_dump(), days=days)

    def test_codes_are_never_reused(self, code_store):
        """An old link still sitting in someone's messages must not open a
        different item later."""
        codes = {code_store.create(make_code_item().model_dump()).code for _ in range(25)}

        assert len(codes) == 25


class TestStateTransitions:
    def test_expiry_is_derived_from_the_timestamp_not_stored(self, code_store):
        record = code_store.create(make_code_item().model_dump())
        assert record.status == "active"

        _expire(code_store, record.code)

        # state is still "active" on disk; status computes the difference,
        # which is why there's no sweep job to forget to run.
        assert code_store.get(record.code).state == "active"
        assert code_store.get(record.code).status == "expired"

    def test_cancelling_an_active_code(self, code_store):
        record = code_store.create(make_code_item().model_dump())

        code_store.cancel(record.code)

        assert code_store.get(record.code).status == "cancelled"

    def test_cancelling_a_sold_code_leaves_it_sold(self, code_store):
        """The sale is the record of what happened; cancelling afterwards
        shouldn't rewrite it."""
        record = code_store.create(make_code_item().model_dump())
        code_store.mark_sold(record.code, session_id="cs_1")

        code_store.cancel(record.code)

        assert code_store.get(record.code).status == "sold"

    def test_marking_sold_records_the_session_and_timestamp(self, code_store):
        record = code_store.create(make_code_item().model_dump())

        code_store.mark_sold(record.code, session_id="cs_abc")

        stored = code_store.get(record.code)
        assert stored.status == "sold"
        assert stored.checkoutSessionId == "cs_abc"
        assert stored.soldAt is not None

    def test_marking_an_unknown_code_sold_returns_none(self, code_store):
        assert code_store.mark_sold("ZZZZ", session_id="cs_1") is None

    def test_nothing_is_ever_deleted(self, code_store):
        """Every code ever made stays in the file as the record of what was
        offered to whom at what price."""
        active = code_store.create(make_code_item().model_dump())
        sold = code_store.create(make_code_item().model_dump())
        cancelled = code_store.create(make_code_item().model_dump())
        code_store.mark_sold(sold.code, session_id="cs_1")
        code_store.cancel(cancelled.code)

        stored = {record.code for record in code_store.all()}
        assert stored == {active.code, sold.code, cancelled.code}


class TestLookupEndpoint:
    def test_an_active_code_returns_the_listing(self, client, code_store):
        record = code_store.create(make_code_item(priceCents=15000, name="iPhone 13").model_dump())

        response = client.get(f"/api/codes/{record.code}")

        assert response.status_code == 200
        body = response.json()
        assert body["sold"] is False
        assert body["item"]["name"] == "iPhone 13"
        assert body["item"]["priceCents"] == 15000

    def test_a_sold_code_still_resolves_so_the_buyer_sees_sold(self, client, code_store):
        """The buyer who paid may well open their link again. Showing Sold
        beats showing "not found" to the person who just bought it."""
        record = code_store.create(make_code_item().model_dump())
        code_store.mark_sold(record.code, session_id="cs_1")

        response = client.get(f"/api/codes/{record.code}")

        assert response.status_code == 200
        assert response.json()["sold"] is True

    def test_a_lowercase_code_in_the_url_resolves(self, client, code_store):
        record = code_store.create(make_code_item().model_dump())

        assert client.get(f"/api/codes/{record.code.lower()}").status_code == 200

    def test_dead_and_nonexistent_codes_are_indistinguishable(self, client, code_store):
        """The whole point: a guesser must not be able to tell a real-but-
        expired code from one that was never issued."""
        expired = code_store.create(make_code_item().model_dump())
        _expire(code_store, expired.code)
        cancelled = code_store.create(make_code_item().model_dump())
        code_store.cancel(cancelled.code)

        responses = [
            client.get(f"/api/codes/{expired.code}"),
            client.get(f"/api/codes/{cancelled.code}"),
            client.get("/api/codes/ZZZZ"),
        ]

        assert [r.status_code for r in responses] == [404, 404, 404]
        # Same body too — a differing message would leak the distinction.
        assert len({r.json()["detail"] for r in responses}) == 1

    def test_the_listing_never_leaks_internal_state(self, client, code_store):
        """The response model is the public fields only: no createdAt, no
        checkoutSessionId, no state."""
        record = code_store.create(make_code_item().model_dump())

        body = client.get(f"/api/codes/{record.code}").json()

        assert set(body) == {"code", "sold", "expiresAt", "item"}
        assert "checkoutSessionId" not in body["item"]
        assert "state" not in body["item"]
