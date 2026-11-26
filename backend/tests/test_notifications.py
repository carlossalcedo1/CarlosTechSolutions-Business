"""What the emails and the push actually say, and how Pushover is called.

These are the bodies a sale produces. They're pure functions (strings in,
strings out), so they're cheap to pin down — and the push request shape is
worth asserting because a wrong field name there fails silently: Pushover
rejects it, notifier.py logs it, and the operator just never gets alerts.
"""

from __future__ import annotations

import datetime as dt
import urllib.error
import urllib.parse
from zoneinfo import ZoneInfo

import pytest

from backend.app.config import Settings
from backend.app.emails import buyer_confirmation, format_cents, sale_alert, sale_push
from backend.app.notifier import _MESSAGE_LIMIT, _TITLE_LIMIT, send_push
from backend.tests.helpers import make_code_item, make_item, make_session

# The shop's timezone, matching config.py's default.
TZ = "America/New_York"
# The public site, for the listing link.
SITE = "https://shop.example.com"
# 17:30 UTC = 12:30 in Gainesville (EST). Used wherever a fixed, readable
# instant matters more than "now".
NOV_26_1730_UTC = int(dt.datetime(2025, 11, 26, 17, 30, tzinfo=dt.timezone.utc).timestamp())


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
        _, push_message, _ = sale_push(make_item(), make_session(), timezone_name=TZ, site_url=SITE)

        assert "CTS-0142" not in email_text
        assert "CTS-0142" in push_message


class TestSalePush:
    """The notification template: a title saying what sold for how much, and
    a body with buyer, full address, sale time, item, inventory id and price.
    """

    def test_the_title_says_what_sold_and_for_how_much(self):
        title, _, _ = sale_push(make_item(), make_session(amount_total=34412), timezone_name=TZ, site_url=SITE)

        assert title == "iPad Air (4th gen) has been purchased for $344.12"

    def test_the_body_carries_every_field_in_order(self):
        _, message, _ = sale_push(
            make_item(), make_session(amount_total=34412), timezone_name=TZ, site_url=SITE, sold_at=NOV_26_1730_UTC
        )

        assert message.splitlines() == [
            "Buyer: Dana Reyes",
            "118 SW 12th St, Apt 4",
            "Gainesville, FL 32601, US",
            "",
            "Sold: 11/26/2025 12:30",
            "Paid: $344.12",
            "",
            "Item: iPad Air (4th gen)",
            "Inventory: CTS-0142",
            f'<a href="{SITE}/product/ipad-air">View the listing</a>',
        ]

    def test_the_body_is_three_blank_line_separated_blocks(self):
        """Pinning the grouping itself, not just the field order — the blank
        lines are what make it scannable, and nothing else would fail if
        they quietly disappeared."""
        _, message, _ = sale_push(
            make_item(), make_session(), timezone_name=TZ, site_url=SITE, sold_at=NOV_26_1730_UTC
        )

        blocks = [block.splitlines() for block in message.split("\n\n")]

        assert len(blocks) == 3
        assert blocks[0][0].startswith("Buyer:")            # who and where
        assert [line.split(":")[0] for line in blocks[1]] == ["Sold", "Paid"]
        assert blocks[2][0].startswith("Item:")             # what

    def test_a_code_sale_keeps_the_three_block_shape(self):
        """The extra Code line belongs to the item block, not a fourth one."""
        _, message, _ = sale_push(
            make_code_item(), make_session(), timezone_name=TZ, site_url=SITE,
            code="K7MX", sold_at=NOV_26_1730_UTC,
        )

        blocks = message.split("\n\n")

        assert len(blocks) == 3
        assert "Code: K7MX" in blocks[2]

    def test_a_missing_address_does_not_collapse_the_blocks(self):
        """The no-address line still has to hold the first block open, or
        the blank line lands in the wrong place."""
        _, message, _ = sale_push(
            make_item(), make_session(collected_information={}),
            timezone_name=TZ, site_url=SITE, sold_at=NOV_26_1730_UTC,
        )

        blocks = message.split("\n\n")

        assert len(blocks) == 3
        assert blocks[0].splitlines() == ["Buyer: Dana Reyes", "(no shipping address)"]

    def test_the_full_address_is_included_not_just_the_city(self):
        """Different from the old template, which showed city and state
        only — the whole point is being able to act on the sale from the
        notification."""
        _, message, _ = sale_push(make_item(), make_session(), timezone_name=TZ, site_url=SITE)

        assert "118 SW 12th St" in message
        assert "Apt 4" in message
        assert "32601" in message

    def test_a_second_address_line_is_omitted_when_absent(self):
        session = make_session(
            collected_information={
                "shipping_details": {
                    "address": {
                        "line1": "9 Oak Ave",
                        "city": "Ocala",
                        "state": "FL",
                        "postal_code": "34470",
                        "country": "US",
                    }
                }
            }
        )

        _, message, _ = sale_push(make_item(), session, timezone_name=TZ, site_url=SITE)

        assert "9 Oak Ave\nOcala, FL 34470, US" in message
        assert ", ," not in message  # no empty slot left behind


class TestSaleTime:
    """The timestamp is the one field that can be quietly wrong for hours
    rather than obviously missing."""

    def test_it_renders_as_mm_dd_yyyy_and_24_hour(self):
        _, message, _ = sale_push(
            make_item(), make_session(), timezone_name=TZ, site_url=SITE, sold_at=NOV_26_1730_UTC
        )

        assert "Sold: 11/26/2025 12:30" in message

    def test_an_afternoon_sale_uses_24_hour_not_am_pm(self):
        """18:00 UTC in November is 13:00 in Gainesville — the point is it
        reads 13:00, not 1:00, and carries no AM/PM."""
        afternoon = int(dt.datetime(2025, 11, 26, 18, 0, tzinfo=dt.timezone.utc).timestamp())

        _, message, _ = sale_push(make_item(), make_session(), timezone_name=TZ, site_url=SITE, sold_at=afternoon)

        assert "Sold: 11/26/2025 13:00" in message
        assert "PM" not in message and "pm" not in message

    def test_the_time_is_local_not_utc(self):
        """A container runs on UTC unless told otherwise, so without the
        conversion a 12:30 sale would alert as 17:30."""
        _, local, _ = sale_push(
            make_item(), make_session(), timezone_name=TZ, site_url=SITE, sold_at=NOV_26_1730_UTC
        )
        _, utc, _ = sale_push(
            make_item(), make_session(), timezone_name="UTC", site_url=SITE, sold_at=NOV_26_1730_UTC
        )

        assert "12:30" in local
        assert "17:30" in utc

    def test_daylight_saving_is_handled(self):
        """Same clock time in UTC, five hours' difference in winter and four
        in summer. Hardcoding an offset would be wrong half the year."""
        winter = int(dt.datetime(2026, 1, 15, 17, 0, tzinfo=dt.timezone.utc).timestamp())
        summer = int(dt.datetime(2026, 7, 15, 17, 0, tzinfo=dt.timezone.utc).timestamp())

        _, winter_message, _ = sale_push(make_item(), make_session(), timezone_name=TZ, site_url=SITE, sold_at=winter)
        _, summer_message, _ = sale_push(make_item(), make_session(), timezone_name=TZ, site_url=SITE, sold_at=summer)

        assert "01/15/2026 12:00" in winter_message
        assert "07/15/2026 13:00" in summer_message

    def test_an_unknown_timezone_falls_back_to_utc_with_a_warning(self, caplog):
        """A typo in TIMEZONE shouldn't cost the whole notification, but it
        shouldn't pass silently either — the time would be hours off."""
        with caplog.at_level("WARNING"):
            _, message, _ = sale_push(
                make_item(), make_session(), timezone_name="Mars/Olympus", site_url=SITE, sold_at=NOV_26_1730_UTC
            )

        assert "Sold: 11/26/2025 17:30" in message
        assert "Mars/Olympus" in caplog.text

    def test_a_retried_delivery_reports_the_original_sale_time(self):
        """Stripe retries. The event's created timestamp doesn't change
        between deliveries, so neither does the reported time — which is
        why this isn't datetime.now()."""
        _, first, _ = sale_push(
            make_item(), make_session(), timezone_name=TZ, site_url=SITE, sold_at=NOV_26_1730_UTC
        )
        _, retry, _ = sale_push(
            make_item(), make_session(), timezone_name=TZ, site_url=SITE, sold_at=NOV_26_1730_UTC
        )

        assert first == retry
        assert "12:30" in retry

    def test_a_missing_timestamp_falls_back_to_now(self):
        """Shouldn't happen — Stripe always sets event.created — but a blank
        line where the sale time goes would be worse than an approximate one."""
        _, message, _ = sale_push(make_item(), make_session(), timezone_name=TZ, site_url=SITE)

        expected = dt.datetime.now(ZoneInfo(TZ)).strftime("%m/%d/%Y")
        assert f"Sold: {expected}" in message


class TestSalePushEdgeCases:
    def test_it_carries_the_dashboard_link_unlike_the_email(self):
        """The asymmetry with sale_alert is intentional — a push has no spam
        filter, and the payment is what you'd open next."""
        _, _, url = sale_push(make_item(), make_session(), timezone_name=TZ, site_url=SITE)

        assert url == "https://dashboard.stripe.com/payments/pi_test_123"

    def test_no_payment_intent_means_no_link_rather_than_a_broken_one(self):
        _, _, url = sale_push(make_item(), make_session(payment_intent=None), timezone_name=TZ, site_url=SITE)

        assert url is None

    def test_a_code_sale_names_the_code(self):
        _, message, _ = sale_push(make_code_item(), make_session(), timezone_name=TZ, site_url=SITE, code="K7MX")

        assert "Code: K7MX" in message
        # Still after the inventory id and before the price.
        lines = message.splitlines()
        assert lines.index("Code: K7MX") == lines.index("Inventory: CTS-0142") + 1

    def test_a_missing_address_says_so_rather_than_leaving_a_gap(self):
        _, message, _ = sale_push(
            make_item(), make_session(collected_information={}), timezone_name=TZ, site_url=SITE
        )

        assert "(no shipping address)" in message
        assert "Inventory: CTS-0142" in message

    def test_the_email_is_used_when_there_is_no_buyer_name(self):
        session = make_session(customer_details={"email": "dana@example.com"})

        _, message, _ = sale_push(make_item(), session, timezone_name=TZ, site_url=SITE)

        assert "Buyer: dana@example.com" in message

    def test_a_very_long_device_name_builds_without_crashing(self):
        """sale_push doesn't truncate — send_push does, so there's exactly
        one place that knows Pushover's limits (asserted in
        TestPushoverRequest)."""
        item = make_item(name="A" * 400)

        title, message, _ = sale_push(item, make_session(), timezone_name=TZ, site_url=SITE)

        assert title.endswith("has been purchased for $329")
        assert "Buyer: Dana Reyes" in message


class TestListingLink:
    """The second link. Pushover allows one `url` field, which the Stripe
    payment uses, so this one is an anchor in the message body — which is
    why the message is HTML and everything interpolated gets escaped.
    """

    def test_a_catalog_sale_links_to_the_product_page(self):
        _, message, _ = sale_push(
            make_item("ipad-air"), make_session(), timezone_name=TZ, site_url=SITE
        )

        assert f'<a href="{SITE}/product/ipad-air">View the listing</a>' in message

    def test_a_code_sale_links_to_the_code_page(self):
        """A code listing was never in the catalog, so /product/<id> would
        404 — it lives at /code/<CODE>."""
        _, message, _ = sale_push(
            make_code_item("secret-iphone"),
            make_session(),
            timezone_name=TZ,
            site_url=SITE,
            code="K7MX",
        )

        assert f'<a href="{SITE}/code/K7MX">View the listing</a>' in message
        assert "/product/" not in message

    def test_a_trailing_slash_on_the_site_url_does_not_double_up(self):
        _, message, _ = sale_push(
            make_item(), make_session(), timezone_name=TZ, site_url="https://shop.example.com/"
        )

        assert "https://shop.example.com/product/ipad-air" in message
        assert "//product" not in message

    def test_both_links_are_present_and_distinct(self):
        """The listing is what sold; the Stripe payment is the money. They
        go to different places on purpose."""
        _, message, url = sale_push(
            make_item(), make_session(), timezone_name=TZ, site_url=SITE
        )

        assert f"{SITE}/product/ipad-air" in message
        assert url == "https://dashboard.stripe.com/payments/pi_test_123"
        assert "dashboard.stripe.com" not in message

    def test_the_link_is_the_last_line(self):
        _, message, _ = sale_push(make_item(), make_session(), timezone_name=TZ, site_url=SITE)

        assert message.splitlines()[-1].startswith("<a href=")


class TestHtmlEscaping:
    """html=True means the message is parsed as markup, and the buyer types
    their own name and address into Stripe Checkout. That is the one place
    untrusted text reaches it.
    """

    def test_an_ampersand_in_a_buyer_name_is_escaped(self):
        session = make_session(customer_details={"name": "Dana & Sons"})

        _, message, _ = sale_push(make_item(), session, timezone_name=TZ, site_url=SITE)

        assert "Dana &amp; Sons" in message
        assert "Dana & Sons" not in message

    def test_angle_brackets_in_a_buyer_name_cannot_inject_markup(self):
        session = make_session(customer_details={"name": "<b>Dana</b>"})

        _, message, _ = sale_push(make_item(), session, timezone_name=TZ, site_url=SITE)

        assert "&lt;b&gt;Dana&lt;/b&gt;" in message
        # Exactly one anchor — the listing link, not one a buyer supplied.
        assert message.count("<a href=") == 1

    def test_an_anchor_in_a_buyer_name_cannot_add_a_second_link(self):
        session = make_session(
            customer_details={"name": '<a href="https://evil.example">click</a>'}
        )

        _, message, _ = sale_push(make_item(), session, timezone_name=TZ, site_url=SITE)

        assert "evil.example" not in message.split("View the listing")[1]
        assert message.count("<a href=") == 1
        assert "&lt;a href=" in message

    def test_an_address_line_is_escaped_too(self):
        session = make_session(
            collected_information={
                "shipping_details": {
                    "address": {"line1": "1 <script> Way", "city": "Ocala", "state": "FL"}
                }
            }
        )

        _, message, _ = sale_push(make_item(), session, timezone_name=TZ, site_url=SITE)

        assert "1 &lt;script&gt; Way" in message
        assert "<script>" not in message

    def test_an_item_name_with_markup_characters_is_escaped(self):
        item = make_item(name='iPad "Air" & <b>more</b>')

        _, message, _ = sale_push(item, make_session(), timezone_name=TZ, site_url=SITE)

        assert "&amp;" in message
        assert "<b>more</b>" not in message

    def test_the_title_is_not_escaped_because_it_is_not_html(self):
        """Pushover never parses the title as markup, so escaping it would
        show the buyer a literal &amp;."""
        item = make_item(name="iPad Air & Pencil")

        title, _, _ = sale_push(item, make_session(), timezone_name=TZ, site_url=SITE)

        assert title.startswith("iPad Air & Pencil has been purchased")
        assert "&amp;" not in title


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

    def test_html_mode_is_sent_when_asked(self, monkeypatch):
        captured = self._capture(monkeypatch)

        send_push(self._settings(), title="t", message='<a href="x">y</a>', html=True)

        assert captured["fields"]["html"] == ["1"]

    def test_html_mode_is_off_by_default(self, monkeypatch):
        """A plain-text caller must not have its & and < parsed as markup."""
        captured = self._capture(monkeypatch)

        send_push(self._settings(), title="t", message="a & b < c")

        assert "html" not in captured["fields"]

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
