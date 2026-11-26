"""The public form endpoints, their honeypot, and the rate limiters.

The limiters are what make the 920k code space unsweepable and the forms
unspammable, so they're worth asserting rather than assuming. They're
fixed-window counters in process memory — see ratelimit.py on why that's an
accepted trade for a single-worker deploy.
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from backend.app.ratelimit import RateLimiter
from backend.tests.helpers import make_code_item

CONTACT = {"name": "Dana", "email": "dana@example.com", "message": "Is this still available?"}


class TestRateLimiterUnit:
    def test_requests_up_to_the_limit_are_allowed(self):
        limiter = RateLimiter(max_requests=3, window_seconds=60)

        for _ in range(3):
            limiter.check("1.2.3.4")  # does not raise

    def test_one_over_the_limit_raises_429(self):
        limiter = RateLimiter(max_requests=3, window_seconds=60)
        for _ in range(3):
            limiter.check("1.2.3.4")

        with pytest.raises(HTTPException) as excinfo:
            limiter.check("1.2.3.4")

        assert excinfo.value.status_code == 429

    def test_each_key_gets_its_own_budget(self):
        """One spammer must not lock everyone else out."""
        limiter = RateLimiter(max_requests=1, window_seconds=60)
        limiter.check("1.2.3.4")

        limiter.check("5.6.7.8")  # unaffected

        with pytest.raises(HTTPException):
            limiter.check("1.2.3.4")

    def test_the_window_slides_so_the_budget_comes_back(self, monkeypatch):
        clock = {"now": 1000.0}
        monkeypatch.setattr("backend.app.ratelimit.time.monotonic", lambda: clock["now"])
        limiter = RateLimiter(max_requests=2, window_seconds=60)

        limiter.check("1.2.3.4")
        limiter.check("1.2.3.4")
        with pytest.raises(HTTPException):
            limiter.check("1.2.3.4")

        clock["now"] += 61
        limiter.check("1.2.3.4")  # old hits have aged out


class TestClientIdentification:
    def test_the_caddy_forwarded_header_wins(self, client, sent):
        """The API container isn't reachable from the internet — every
        request arrives from Caddy, so without this every caller would share
        one bucket (see deploy/Caddyfile)."""
        for index in range(5):
            response = client.post("/api/contact", json=CONTACT, headers={"x-real-ip": f"9.9.9.{index}"})
            assert response.status_code == 200

        # Five different IPs, five separate budgets — none exhausted.
        assert len(sent["emails"]) == 5

    def test_one_ip_spending_its_budget_does_not_block_another(self, client):
        exhausted = {"x-real-ip": "9.9.9.1"}
        for _ in range(5):
            client.post("/api/contact", json=CONTACT, headers=exhausted)

        assert client.post("/api/contact", json=CONTACT, headers=exhausted).status_code == 429
        assert client.post("/api/contact", json=CONTACT, headers={"x-real-ip": "9.9.9.2"}).status_code == 200


class TestFormEndpoints:
    @pytest.mark.parametrize(
        "path,body",
        [
            ("/api/contact", CONTACT),
            (
                "/api/trade-in",
                {
                    "name": "Dana",
                    "email": "dana@example.com",
                    "imei": "356789104321987",
                    "condition": "Good",
                    "unlock_status": "Unlocked",
                },
            ),
            ("/api/subscribe", {"email": "dana@example.com"}),
        ],
    )
    def test_a_valid_submission_succeeds(self, client, path, body):
        assert client.post(path, json=body).status_code == 200

    @pytest.mark.parametrize(
        "path,body",
        [
            ("/api/contact", {**CONTACT, "website": "http://spam.example"}),
            (
                "/api/trade-in",
                {
                    "name": "Dana",
                    "email": "dana@example.com",
                    "imei": "356789104321987",
                    "condition": "Good",
                    "unlock_status": "Unlocked",
                    "website": "http://spam.example",
                },
            ),
            ("/api/subscribe", {"email": "dana@example.com", "website": "http://spam.example"}),
        ],
    )
    def test_a_tripped_honeypot_looks_like_success_but_sends_nothing(self, client, sent, path, body):
        """Telling a bot it was caught just teaches it to adapt, so the
        response is indistinguishable from a real submission."""
        response = client.post(path, json=body)

        assert response.status_code == 200
        assert sent["emails"] == []

    def test_contact_requires_a_way_to_reach_back(self, client):
        response = client.post("/api/contact", json={"name": "Dana", "message": "hello"})

        assert response.status_code == 422

    def test_a_phone_number_alone_is_enough(self, client):
        response = client.post(
            "/api/contact",
            json={"name": "Dana", "phone": "305-555-0100", "message": "hello"},
        )

        assert response.status_code == 200

    def test_the_sixth_submission_in_a_window_is_throttled(self, client):
        for _ in range(5):
            assert client.post("/api/contact", json=CONTACT).status_code == 200

        assert client.post("/api/contact", json=CONTACT).status_code == 429

    def test_the_form_budget_is_shared_across_the_three_endpoints(self, client):
        """One limiter for all three, so a bot can't get 5 tries each by
        rotating endpoints."""
        for _ in range(5):
            client.post("/api/subscribe", json={"email": "dana@example.com"})

        assert client.post("/api/contact", json=CONTACT).status_code == 429


class TestCodeLookupLimit:
    def test_guessing_is_throttled_after_ten_attempts(self, client):
        for _ in range(10):
            assert client.get("/api/codes/ZZZZ").status_code == 404

        assert client.get("/api/codes/YYYY").status_code == 429

    def test_lookups_and_code_checkouts_share_one_budget(self, client, code_store):
        """Otherwise a guesser gets 10 tries per path instead of 10 total."""
        record = code_store.create(make_code_item().model_dump())
        for _ in range(10):
            client.get("/api/codes/ZZZZ")

        response = client.post("/api/checkout", json={"code": record.code})

        assert response.status_code == 429

    def test_the_code_budget_is_separate_from_the_form_budget(self, client):
        """A buyer mistyping a code shouldn't lose the ability to use the
        contact form."""
        for _ in range(10):
            client.get("/api/codes/ZZZZ")

        assert client.post("/api/contact", json=CONTACT).status_code == 200
