"""Admin sessions: the store, the cookie, and what the cookie buys you.

The thing being pinned here is revocability — the whole reason these are
opaque tokens on disk rather than JWTs. A signed token stays valid until it
expires no matter what the server thinks; a row you can delete does not.
Several tests below would be impossible to write against a JWT, which is
rather the point.
"""

from __future__ import annotations

import time

import pytest

from backend.app.login_codes import CODE_LENGTH
from backend.app.sessions import COOKIE_NAME, SESSION_DAYS, SessionStore

DAY = 24 * 60 * 60


@pytest.fixture
def store(tmp_path) -> SessionStore:
    return SessionStore(tmp_path / "sessions.json")


# --- the store --------------------------------------------------------------


def test_create_then_lookup(store):
    token = store.create("cmsal06")
    assert store.lookup(token) == "cmsal06"


def test_tokens_are_long_and_unique(store):
    tokens = {store.create("cmsal06") for _ in range(50)}
    assert len(tokens) == 50
    assert all(len(t) >= 32 for t in tokens)


def test_unknown_token_is_nobody(store):
    store.create("cmsal06")
    assert store.lookup("not-a-real-token") is None


def test_no_token_is_nobody(store):
    assert store.lookup(None) is None
    assert store.lookup("") is None


def test_username_is_normalized(store):
    token = store.create("  CMSal06 ")
    assert store.lookup(token) == "cmsal06"


def test_plaintext_token_is_not_on_disk(tmp_path):
    path = tmp_path / "sessions.json"
    token = SessionStore(path).create("cmsal06")
    assert token not in path.read_text()


def test_session_survives_a_restart(tmp_path):
    path = tmp_path / "sessions.json"
    token = SessionStore(path).create("cmsal06")
    assert SessionStore(path).lookup(token) == "cmsal06"


# --- revocation: the reason this isn't a JWT --------------------------------


def test_revoke_kills_one_session(store):
    token = store.create("cmsal06")
    assert store.revoke(token) is True
    assert store.lookup(token) is None


def test_revoke_is_idempotent(store):
    token = store.create("cmsal06")
    store.revoke(token)
    assert store.revoke(token) is False


def test_revoking_one_device_leaves_the_others(store):
    phone = store.create("cmsal06")
    laptop = store.create("cmsal06")
    store.revoke(phone)
    assert store.lookup(phone) is None
    assert store.lookup(laptop) == "cmsal06"


def test_revoke_all_signs_out_every_device(store):
    # The lost-laptop button. Impossible with a stateless token short of
    # rotating the signing key and kicking everyone, including yourself.
    store.create("cmsal06")
    store.create("cmsal06")
    other = store.create("sam")
    assert store.revoke_all("cmsal06") == 2
    assert store.lookup(other) == "sam"


def test_revoke_all_on_a_stranger_does_nothing(store):
    token = store.create("cmsal06")
    assert store.revoke_all("nobody") == 0
    assert store.lookup(token) == "cmsal06"


# --- expiry -----------------------------------------------------------------


def test_session_lasts_three_days():
    assert SESSION_DAYS == 3


def test_session_is_alive_just_before_the_deadline(store, monkeypatch):
    token = store.create("cmsal06")
    almost = time.time() + SESSION_DAYS * DAY - 60
    monkeypatch.setattr(time, "time", lambda: almost)
    assert store.lookup(token) == "cmsal06"


def test_session_expires_at_the_deadline(store, monkeypatch):
    # Dead *at* the mark, not after it: expiry is `expires_at <= now`.
    token = store.create("cmsal06")
    deadline = time.time() + SESSION_DAYS * DAY
    monkeypatch.setattr(time, "time", lambda: deadline)
    assert store.lookup(token) is None


def test_using_a_session_does_not_extend_it(store, monkeypatch):
    # The point of a flat window. If lookup() ever starts sliding the
    # deadline again, an admin who keeps a tab open is never asked to sign
    # in — which is exactly what this lifetime exists to prevent.
    token = store.create("cmsal06")
    start = time.time()

    for hours in range(1, SESSION_DAYS * 24):
        moment = start + hours * 60 * 60
        monkeypatch.setattr(time, "time", lambda m=moment: m)
        assert store.lookup(token) == "cmsal06", f"died early at {hours}h"

    # Used constantly right up to the deadline, and still out on time.
    monkeypatch.setattr(time, "time", lambda: start + SESSION_DAYS * DAY)
    assert store.lookup(token) is None


def test_a_signed_in_lookup_does_not_rewrite_the_file(tmp_path):
    # Consequence of dropping the slide, and worth keeping: the common case
    # is now a pure read, so a page load costs no disk write.
    path = tmp_path / "sessions.json"
    store = SessionStore(path)
    token = store.create("cmsal06")
    before = path.stat().st_mtime_ns
    for _ in range(5):
        assert store.lookup(token) == "cmsal06"
    assert path.stat().st_mtime_ns == before


# --- the HTTP surface -------------------------------------------------------


def _sign_in(client, sent, username="cmsal06"):
    """Drive the real two-step flow and leave the client holding a cookie."""
    client.post("/api/admin/login", json={"username": username})
    message = sent["pushes"][-1]["message"]
    # The push reads "Your sign-in code is 123456. It expires in 10
    # minutes." — the slice stops before the 10.
    code = "".join(c for c in message if c.isdigit())[:CODE_LENGTH]
    res = client.post("/api/admin/verify", json={"username": username, "code": code})
    assert res.status_code == 200
    return res


def test_me_is_nobody_before_signing_in(client):
    res = client.get("/api/admin/me")
    # 200 with a null user, not a 401 — every page load asks this and "not
    # signed in" is the ordinary answer on a shop front.
    assert res.status_code == 200
    assert res.json() == {"user": None}


def test_verify_sets_a_session_cookie(client, sent):
    res = _sign_in(client, sent)
    cookie = res.headers["set-cookie"]
    assert COOKIE_NAME in cookie
    # httponly is what keeps the token out of reach of any script that
    # manages to run on the page.
    assert "HttpOnly" in cookie
    # Starlette writes the attribute lowercase.
    assert "samesite=lax" in cookie.lower()


def test_cookie_is_not_secure_against_a_plain_http_site_url(client, sent):
    # The dev settings use http://localhost. A Secure cookie is simply not
    # sent over http, so hardcoding it would make local sign-in impossible
    # in a way that looks like a backend bug.
    res = _sign_in(client, sent)
    assert "Secure" not in res.headers["set-cookie"]


def test_cookie_is_secure_when_the_site_is_https(client, sent, settings):
    settings.site_url = "https://shop.example.com"
    res = _sign_in(client, sent)
    assert "Secure" in res.headers["set-cookie"]


def test_me_knows_you_after_signing_in(client, sent):
    _sign_in(client, sent)
    assert client.get("/api/admin/me").json() == {"user": {"username": "cmsal06"}}


def test_session_outlives_the_burned_code(client, sent):
    # The code is single-use and already gone; the session is what carries
    # you from here. If this failed, sign-in would last exactly one request.
    _sign_in(client, sent)
    for _ in range(3):
        assert client.get("/api/admin/me").json()["user"]["username"] == "cmsal06"


def test_logout_signs_you_out(client, sent):
    _sign_in(client, sent)
    assert client.post("/api/admin/logout").status_code == 200
    assert client.get("/api/admin/me").json() == {"user": None}


def test_logout_kills_the_row_not_just_the_cookie(client, sent, session_store):
    # The difference between this and a JWT: the server forgets, so a
    # client that quietly kept its cookie still gets nothing.
    res = _sign_in(client, sent)
    token = res.cookies[COOKIE_NAME]
    client.post("/api/admin/logout")
    assert session_store.lookup(token) is None


def test_a_wrong_code_grants_no_session(client, sent):
    client.post("/api/admin/login", json={"username": "cmsal06"})
    code = "".join(c for c in sent["pushes"][-1]["message"] if c.isdigit())[:CODE_LENGTH]
    guess = "000000" if code != "000000" else "111111"
    res = client.post("/api/admin/verify", json={"username": "cmsal06", "code": guess})
    # 400, not 422: the guess has to be well-formed, or this would only be
    # testing the length check and never the wrong-code path it's named for.
    assert res.status_code == 400
    assert client.get("/api/admin/me").json() == {"user": None}


def test_a_forged_cookie_is_nobody(client):
    client.cookies.set(COOKIE_NAME, "obviously-made-up")
    assert client.get("/api/admin/me").json() == {"user": None}


def test_require_admin_rejects_the_signed_out(client):
    from backend.app.main import require_admin
    from fastapi import HTTPException

    class FakeRequest:
        cookies: dict = {}
        app = None

    FakeRequest.app = client.app
    with pytest.raises(HTTPException) as exc:
        require_admin(FakeRequest())
    assert exc.value.status_code == 401


def test_require_admin_accepts_the_signed_in(client, sent, session_store):
    from backend.app.main import require_admin

    token = session_store.create("cmsal06")

    class FakeRequest:
        cookies = {COOKIE_NAME: token}
        app = client.app

    assert require_admin(FakeRequest()) == "cmsal06"
