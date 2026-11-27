"""Shared fixtures.

Everything here runs offline. Two properties of the app make that possible
without a mocking library:

- mailer.py and notifier.py no-op when their keys are blank, so a Settings
  with no secrets can't reach Resend or Pushover even by accident.
- SoldStore and CodeStore take explicit paths, so tmp_path isolates them.

Stripe is the only thing that genuinely needs replacing: `verify_webhook`
checks a real signature and `create_checkout_session` posts to Stripe's API.
Both are patched on `backend.app.main` — the module imports them by name, so
patching them where they're defined would have no effect.
"""

from __future__ import annotations

import datetime as dt

import pytest
from fastapi.testclient import TestClient

from backend.app import admin_orders as admin_orders_module
from backend.app import admin_packages as admin_packages_module
from backend.app import main as main_module
from backend.app.codes import CodeStore
from backend.app.config import Settings, get_settings
from backend.app.models import Item
from backend.app.login_codes import LoginCodeStore
from backend.app.orders import OrderStore
from backend.app.packages import PackageStore
from backend.app.passkeys import PasskeyStore
from backend.app.sessions import SessionStore
from backend.app.sold_store import SoldStore
from backend.tests.helpers import make_item

@pytest.fixture
def settings(tmp_path) -> Settings:
    """_env_file=None matters: without it pydantic-settings would read a real
    backend/.env if one exists on the machine running the tests, and the
    suite's behaviour would depend on whose laptop it is.

    A stripe key is set because the checkout route 500s without one. The
    Pushover keys are set too — otherwise pushover_configured is False and
    the push branch of the webhook never executes, so the tests covering it
    would pass without running anything. Nothing escapes: the `sent` fixture
    is autouse and replaces send_email/send_push for every test.

    resend_api_key stays blank as a second layer — if a patch ever slips,
    the real send_email no-ops instead of mailing someone.
    """
    return Settings(
        _env_file=None,
        stripe_secret_key="sk_test_fake",
        stripe_webhook_secret="whsec_fake",
        pushover_token="fake-token",
        pushover_user_key="fake-user-key",
        site_url="http://localhost:5173",
        notify_email="notify@example.com",
        sale_notify_email="sale@example.com",
        sold_state_path=tmp_path / "sold_state.json",
        subscribers_path=tmp_path / "subscribers.json",
        codes_path=tmp_path / "codes.json",
        login_codes_path=tmp_path / "login_codes.json",
        passkeys_path=tmp_path / "passkeys.json",
        sessions_path=tmp_path / "sessions.json",
        orders_path=tmp_path / "orders.json",
        packages_path=tmp_path / "packages.json",
        code_photos_dir=tmp_path / "code_photos",
        # Inventory editing defaults to the repo's real items.json, photos
        # and sold log. Every one of these has to be redirected, or a test
        # that creates a listing writes it into the developer's actual
        # catalog. deploy_script points at a file that's never executed —
        # Popen is patched wherever a test reaches the deploy route.
        catalog_path=tmp_path / "items.json",
        public_items_dir=tmp_path / "frontend" / "public" / "items",
        sold_items_path=tmp_path / "sold_items.json",
        deploy_script=tmp_path / "deploy" / "deploy.sh",
        deploy_state_path=tmp_path / "deploy_state.json",
        deploy_log_path=tmp_path / "deploy.log",
        admin_usernames="cmsal06",
    )


@pytest.fixture
def sold_store(settings) -> SoldStore:
    return SoldStore(settings.sold_state_path)


@pytest.fixture
def code_store(settings) -> CodeStore:
    return CodeStore(settings.codes_path)


@pytest.fixture
def login_code_store(settings) -> LoginCodeStore:
    return LoginCodeStore(settings.login_codes_path)


@pytest.fixture
def passkey_store(settings) -> PasskeyStore:
    return PasskeyStore(settings.passkeys_path)


@pytest.fixture
def session_store(settings) -> SessionStore:
    return SessionStore(settings.sessions_path)


@pytest.fixture
def order_store(settings) -> OrderStore:
    return OrderStore(settings.orders_path)


@pytest.fixture
def package_store(settings) -> PackageStore:
    return PackageStore(settings.packages_path)


@pytest.fixture
def catalog() -> dict[str, Item]:
    """One single-unit item and one three-unit item — the quantity > 1 case
    is where sold-state bugs actually cost inventory."""
    return {
        "ipad-air": make_item("ipad-air"),
        "ipod-lot": make_item("ipod-lot", quantity=3, name="iPod Touch (lot of 3)"),
    }


@pytest.fixture(autouse=True)
def _reset_rate_limiters():
    """The limiters in main.py are module-level singletons, so their hit
    counters would leak between tests and the 6th test to send a form would
    start failing with a 429. Cleared before and after each test.
    """
    for limiter in (
        main_module._form_limiter,
        main_module._code_limiter,
        main_module._admin_limiter,
    ):
        limiter._hits.clear()
    yield
    for limiter in (
        main_module._form_limiter,
        main_module._code_limiter,
        main_module._admin_limiter,
    ):
        limiter._hits.clear()


@pytest.fixture(autouse=True)
def sent(monkeypatch) -> dict[str, list]:
    """Captures what the app tried to send, instead of sending it.

    autouse on purpose: the settings fixture sets real-looking Pushover
    keys so the push branch actually runs, which means an unpatched test
    would POST to api.pushover.net. This is the thing that keeps the suite
    offline; request it as a fixture when you want to assert on the
    contents.
    """
    captured: dict[str, list] = {"emails": [], "pushes": []}

    def fake_send_email(settings, **kwargs):
        captured["emails"].append(kwargs)

    def fake_send_push(settings, **kwargs):
        captured["pushes"].append(kwargs)

    def fake_send_push_strict(settings, **kwargs):
        # Captured into the same list as the quiet one: tests care about
        # what the app tried to push, not which door it went out of.
        captured["pushes"].append(kwargs)

    monkeypatch.setattr(main_module, "send_email", fake_send_email)
    monkeypatch.setattr(main_module, "send_push", fake_send_push)
    monkeypatch.setattr(main_module, "send_push_strict", fake_send_push_strict)
    # The Orders tab emails buyers when tracking is added. Imported by name
    # there, so it's patched there — patching mailer would miss it.
    monkeypatch.setattr(admin_orders_module, "send_email", fake_send_email)
    # Delivered alerts from the Shippo webhook push from admin_packages.
    monkeypatch.setattr(admin_packages_module, "send_push", fake_send_push)
    return captured


@pytest.fixture
def stripe_calls(monkeypatch) -> list[dict]:
    """Captures create_checkout_session's arguments. This is how the
    'never trust a price from the browser' rule gets asserted: whatever the
    request said, the item handed to Stripe came from the server."""
    calls: list[dict] = []

    class FakeSession:
        url = "https://checkout.stripe.com/c/pay/cs_test_fake"

    def fake_create(*, item, settings, code=None):
        calls.append({"item": item, "code": code})
        return FakeSession()

    monkeypatch.setattr(main_module, "create_checkout_session", fake_create)
    return calls


@pytest.fixture
def webhook(monkeypatch):
    """Replaces signature verification with a pass-through, and returns a
    helper that posts an event.

    The signature itself is Stripe's code, not ours, and verify_webhook is a
    two-line wrapper over it; what's worth testing is everything the handler
    does *after* verification succeeds.
    """
    pending: dict[str, dict] = {}

    def fake_verify(*, payload, sig_header, settings):
        return pending["event"]

    monkeypatch.setattr(main_module, "verify_webhook", fake_verify)

    def post(client, event: dict):
        pending["event"] = event
        return client.post(
            "/api/stripe-webhook",
            content=b"{}",
            headers={"stripe-signature": "t=1,v1=fake"},
        )

    return post


@pytest.fixture
def client(
    settings,
    catalog,
    sold_store,
    code_store,
    login_code_store,
    passkey_store,
    session_store,
    order_store,
    package_store,
):
    """TestClient with the app's startup state swapped for the fixtures.

    The override has to happen inside the context manager: `with
    TestClient(app)` is what runs the lifespan, and the lifespan builds its
    own catalog and stores from the real settings. Replacing app.state
    afterwards is what points the app at tmp_path instead of the repo's
    actual data directory.
    """
    main_module.app.dependency_overrides[get_settings] = lambda: settings
    with TestClient(main_module.app) as test_client:
        main_module.app.state.catalog = catalog
        main_module.app.state.sold_store = sold_store
        main_module.app.state.code_store = code_store
        # These two were missing when the admin routes landed, which meant
        # every admin test was reading and writing the repo's real
        # backend/data/ files instead of tmp_path. Harmless-looking, since
        # the tests still passed — but they were leaving live sign-in codes
        # on the developer's machine, and a leftover one could have made a
        # later test pass for the wrong reason.
        main_module.app.state.login_code_store = login_code_store
        main_module.app.state.passkey_store = passkey_store
        main_module.app.state.session_store = session_store
        main_module.app.state.order_store = order_store
        main_module.app.state.package_store = package_store
        yield test_client
    main_module.app.dependency_overrides.clear()
