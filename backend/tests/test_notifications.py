"""What the emails and the push actually say, and how Pushover is called.

These are the bodies a sale produces. They're pure functions (strings in,
strings out), so they're cheap to pin down — and the push request shape is
worth asserting because a wrong field name there fails silently: Pushover
rejects it, notifier.py logs it, and the operator just never gets alerts.
"""

from __future__ import annotations

import urllib.error
import urllib.parse

import pytest

from backend.app.config import Settings
from backend.app.emails import buyer_confirmation, format_cents, sale_alert, sale_push
from backend.app.notifier import _MESSAGE_LIMIT, _TITLE_LIMIT, send_push
from backend.tests.helpers import make_code_item, make_item, make_session


class TestMoneyFormatting:
    @pytest.mark.parametrize(
        "cents,expected",
        [
            (32900, "$329"),        # whole dollars drop the .00
            (34412, "$344.12"),
            (100000, "$1,000"),      # thousands separator
            (123456, "$1,234.56"),
            (1, "$0.01"),
        ],
    )
    def test_cents_render_the_way_the_shop_displays_prices(self, cents, expected):
        assert format_cents(cents) == expected


class TestBuyerConfirmation:
    def test_it_returns_a_subject_and_both_body_parts(self):
        """A missing text part is a real spam-score signal, so both are
        always built."""
        subject, html, text = buyer_confirmation(
            make_item(), amount_paid_cents=34412, site_url="https://shop.example.com"
        )

        assert subject == "Congrats on your iPad Air (4th gen)!"
        assert "$344.12" in html and "$344.12" in text
        assert html.startswith("<!doctype html>")
        assert "<" not in text.replace("<!doctype", "")

    def test_links_point_at_the_configured_site(self):
        _, html, text = buyer_confirmation(
            make_item(), amount_paid_cents=32900, site_url="https://shop.example.com"
        )

        assert "https://shop.example.com/returns" in html
        assert "https://shop.example.com/privacy" in text

    def test_an_html_unsafe_device_name_is_escaped(self):
        """Item names come from the add_item CLI, but an unescaped & would
        still break rendering in a mail client."""
        item = make_item(name='iPad "Air" & more <b>')

        _, html, _ = buyer_confirmation(item, amount_paid_cents=32900, site_url="https://x.example")

        assert "&amp;" in html
        assert "<b>" not in html

    def test_a_code_listing_renders_the_same_email(self):
        """CodeItem carries the same public fields, so the buyer-facing
        email can't tell the difference."""
        subject, html, text = buyer_confirmation(
            make_code_item(), amount_paid_cents=32900, site_url="https://x.example"
        )

        assert "iPad Air (4th gen)" in subject
        assert "$329" in text


class TestSaleAlert:
    def test_it_carries_everything_needed_to_ship(self):
        subject, text = sale_alert(make_item(), make_session(amount_total=34412))

        assert subject == "Sold: iPad Air (4th gen) for $344.12"
        for expected in [
            "ipad-air",            # the catalog id
            "Dana Reyes",
            "dana@example.com",
            "118 SW 12th St",
            "Apt 4",
            "Gainesville, FL 32601",
            "US",
            "cs_test_default",
            "pi_test_123",
        ]:
            assert expected in text, f"{expected!r} missing from the alert"

    def test_a_missing_address_says_so_rather_than_rendering_blank(self):
        _, text = sale_alert(make_item(), make_session(collected_information={}))

        assert "(no shipping address on the session)" in text

    def test_missing_buyer_fields_are_marked_not_given(self):
        session = make_session(customer_details={})

        _, text = sale_alert(make_item(), session)

        assert text.count("(not given)") == 3  # name, email, phone

    def test_no_stripe_dashboard_link_in_the_email(self):
        """Deliberate: a fresh domain mailing a financial-platform URL next
        to dollar amounts is the shape phishing filters train on. The plain
        payment-intent id goes instead."""
        _, text = sale_alert(make_item(), make_session())

        assert "dashboard.stripe.com" not in text
        assert "pi_test_123" in text

    def test_a_code_sale_is_labelled_in_the_subject_and_body(self):
        subject, text = sale_alert(make_code_item(), make_session(), code="K7MX")

        assert "(code K7MX)" in subject
        assert "K7MX (code-only listing)" in text

    def test_the_inventory_number_is_in_the_push_but_not_the_email(self):
        """Pinning current behaviour, not endorsing it. inventoryId is the
        Notion cross-reference added in 1e97021, and the push carries it —
        but the email, which is the one you actually pack an order from,
        prints only the catalog id. Worth adding there; until then this test
        makes the asymmetry deliberate rather than forgotten."""
        _, email_text = sale_alert(make_item(), make_session())
        _, push_message, _ = sale_push(make_item(), make_session())

        assert "CTS-0142" not in email_text
        assert "CTS-0142" in push_message


class TestSalePush:
    def test_it_is_a_glance_not_the_whole_email(self):
        title, message, url = sale_push(make_item(), make_session(amount_total=34412))

        assert title == "Sold: iPad Air (4th gen)"
        assert "$344.12" in message
        assert "Dana Reyes" in message
        assert "CTS-0142" in message
        assert "Gainesville, FL" in message
        # The full street address belongs in the email, not on a lock screen.
        assert "118 SW 12th St" not in message
        assert url == "https://dashboard.stripe.com/payments/pi_test_123"

    def test_it_does_carry_the_dashboard_link_unlike_the_email(self):
        """The asymmetry with sale_alert is intentional — a push has no spam
        filter, and the payment is what you'd open next."""
        _, _, url = sale_push(make_item(), make_session())

        assert url is not None and "dashboard.stripe.com" in url

    def test_no_payment_intent_means_no_link_rather_than_a_broken_one(self):
        _, _, url = sale_push(make_item(), make_session(payment_intent=None))

        assert url is None

    def test_a_code_sale_names_the_code(self):
        _, message, _ = sale_push(make_code_item(), make_session(), code="K7MX")

        assert "Code: K7MX" in message

    def test_a_missing_address_just_omits_the_ship_to_line(self):
        _, message, _ = sale_push(make_item(), make_session(collected_information={}))

        assert "Ship to:" not in message
        assert "CTS-0142" in message

    def test_the_email_is_used_when_there_is_no_buyer_name(self):
        session = make_session(customer_details={"email": "dana@example.com"})

        _, message, _ = sale_push(make_item(), session)

        assert "Buyer: dana@example.com" in message

    def test_a_very_long_device_name_builds_without_crashing(self):
        """sale_push doesn't truncate — send_push does, so there's exactly
        one place that knows Pushover's limits (asserted in
        TestPushoverRequest). This just covers the build step surviving an
        absurd name."""
        item = make_item(name="A" * 400, specLine="B" * 400)

        title, message, _ = sale_push(item, make_session())

        assert title.startswith("Sold: ")
        assert "Buyer: Dana Reyes" in message


class TestPushoverRequest:
    """notifier.send_push's wire format. urlopen is patched, so nothing
    leaves the machine."""

    def _settings(self, **overrides) -> Settings:
        return Settings(
            _env_file=None,
            pushover_token="tok",
            pushover_user_key="usr",
            **overrides,
        )

    def _capture(self, monkeypatch) -> dict:
        captured: dict = {}

        class FakeResponse:
            status = 200

            def __enter__(self):
                return self

            def __exit__(self, *exc):
                return False

        def fake_urlopen(request, timeout=None):
            captured["url"] = request.full_url
            captured["method"] = request.get_method()
            captured["headers"] = dict(request.header_items())
            captured["fields"] = urllib.parse.parse_qs(request.data.decode())
            captured["timeout"] = timeout
            return FakeResponse()

        monkeypatch.setattr("backend.app.notifier.urllib.request.urlopen", fake_urlopen)
        return captured

    def test_it_posts_the_fields_pushover_expects(self, monkeypatch):
        captured = self._capture(monkeypatch)

        send_push(
            self._settings(),
            title="Sold: thing",
            message="body",
            url="https://dashboard.stripe.com/payments/pi_1",
            url_title="Open payment in Stripe",
            priority=1,
        )

        assert captured["url"] == "https://api.pushover.net/1/messages.json"
        assert captured["method"] == "POST"
        assert captured["headers"]["Content-type"] == "application/x-www-form-urlencoded"
        assert captured["fields"] == {
            "token": ["tok"],
            "user": ["usr"],
            "title": ["Sold: thing"],
            "message": ["body"],
            "priority": ["1"],
            "url": ["https://dashboard.stripe.com/payments/pi_1"],
            "url_title": ["Open payment in Stripe"],
        }

    def test_optional_fields_are_omitted_rather_than_sent_empty(self, monkeypatch):
        captured = self._capture(monkeypatch)

        send_push(self._settings(), title="t", message="m")

        assert "url" not in captured["fields"]
        assert "url_title" not in captured["fields"]

    def test_long_bodies_are_truncated_before_sending(self, monkeypatch):
        captured = self._capture(monkeypatch)

        send_push(self._settings(), title="T" * 500, message="M" * 2000)

        assert len(captured["fields"]["title"][0]) == _TITLE_LIMIT
        assert len(captured["fields"]["message"][0]) == _MESSAGE_LIMIT

    def test_a_request_timeout_is_always_set(self, monkeypatch):
        """Without one, a hung Pushover would hold the webhook open."""
        captured = self._capture(monkeypatch)

        send_push(self._settings(), title="t", message="m")

        assert captured["timeout"] is not None and captured["timeout"] > 0

    @pytest.mark.parametrize(
        "settings_kwargs",
        [
            {"pushover_token": "", "pushover_user_key": ""},
            {"pushover_token": "tok", "pushover_user_key": ""},
            {"pushover_token": "", "pushover_user_key": "usr"},
        ],
    )
    def test_missing_either_key_sends_nothing(self, monkeypatch, settings_kwargs):
        """Same contract as mailer.py: unconfigured means quiet, not a
        crash, so the app runs before the keys exist."""
        captured = self._capture(monkeypatch)
        settings = Settings(_env_file=None, **settings_kwargs)

        send_push(settings, title="t", message="m")

        assert captured == {}

    @pytest.mark.parametrize(
        "exception",
        [
            urllib.error.HTTPError("u", 400, "Bad Request", {}, None),
            urllib.error.URLError("no route to host"),
            RuntimeError("something unexpected"),
        ],
    )
    def test_every_failure_is_swallowed(self, monkeypatch, exception):
        """send_push is called from inside the Stripe webhook. Raising here
        would 500 the webhook and let Stripe's retry double-record a sale."""
        def exploding_urlopen(request, timeout=None):
            raise exception

        monkeypatch.setattr("backend.app.notifier.urllib.request.urlopen", exploding_urlopen)

        send_push(self._settings(), title="t", message="m")  # must not raise
