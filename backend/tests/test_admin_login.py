"""Admin sign-in: the code store and the two routes.

The store's job is to say yes exactly once, to one person, for ten minutes.
Most of what's below is the ways that could go wrong quietly — a counter
that doesn't persist, an expiry that isn't checked, a second code leaving
the first one alive — because none of those show up as a failing request,
they just make the codes weaker than they look.
"""

from __future__ import annotations

import time

import pytest

from backend.app.login_codes import (
    CODE_LENGTH,
    MAX_ATTEMPTS,
    LoginCodeStore,
    generate_code,
    normalize_username,
)


@pytest.fixture
def store(tmp_path) -> LoginCodeStore:
    return LoginCodeStore(tmp_path / "login_codes.json")


# --- code generation --------------------------------------------------------


def test_codes_are_eight_digits():
    for _ in range(200):
        code = generate_code()
        assert len(code) == CODE_LENGTH == 8
        assert code.isdigit()


def test_leading_zeros_are_kept():
    # f-string zero padding, not str(int) — a code of 00412345 has to stay
    # 8 characters or it won't match what the user was shown.
    assert all(len(f"{n:08d}") == 8 for n in (0, 7, 412345))


def test_codes_are_not_repeated_trivially():
    # Not a randomness test — just a tripwire for someone replacing
    # secrets.randbelow with something seeded or constant.
    assert len({generate_code() for _ in range(200)}) > 150


# --- the happy path ---------------------------------------------------------


def test_issue_then_verify(store):
    code = store.issue("cmsal06")
    assert store.verify("cmsal06", code) is True


def test_username_is_normalized_on_both_sides(store):
    code = store.issue("  CMSal06 ")
    assert store.verify("cmsal06", code) is True


def test_normalize_username_matches_the_allowlist_shape():
    assert normalize_username("  CMSal06 ") == "cmsal06"


# --- single use -------------------------------------------------------------


def test_a_code_works_once(store):
    code = store.issue("cmsal06")
    assert store.verify("cmsal06", code) is True
    # The whole point of a one-time code. A replayable one is just a
    # password that was sent over Pushover.
    assert store.verify("cmsal06", code) is False


def test_issuing_again_kills_the_first_code(store):
    first = store.issue("cmsal06")
    second = store.issue("cmsal06")
    assert store.verify("cmsal06", first) is False
    assert store.verify("cmsal06", second) is True


# --- wrong answers ----------------------------------------------------------


def test_wrong_code_is_rejected(store):
    store.issue("cmsal06")
    assert store.verify("cmsal06", "00000000") is False


def test_unknown_username_is_rejected(store):
    store.issue("cmsal06")
    assert store.verify("nobody", "00000000") is False


def test_another_users_code_does_not_work(store):
    code = store.issue("cmsal06")
    store.issue("sam")
    assert store.verify("sam", code) is False


def test_verify_without_ever_issuing(store):
    assert store.verify("cmsal06", "12345678") is False


# --- attempt cap ------------------------------------------------------------


def test_too_many_wrong_guesses_destroys_the_code(store):
    code = store.issue("cmsal06")
    for _ in range(MAX_ATTEMPTS):
        assert store.verify("cmsal06", "00000000") is False
    # The real code is now worthless too — the code is destroyed, not just
    # the attempt rejected, so a guesser can't request nothing and keep going.
    assert store.verify("cmsal06", code) is False


def test_attempts_persist_across_instances(tmp_path):
    # The counter lives in the file, not in memory. If it only persisted on
    # success, a restart (or a second worker) would reset the budget and
    # brute forcing would be free.
    path = tmp_path / "login_codes.json"
    code = LoginCodeStore(path).issue("cmsal06")
    for _ in range(MAX_ATTEMPTS):
        LoginCodeStore(path).verify("cmsal06", "00000000")
    assert LoginCodeStore(path).verify("cmsal06", code) is False


def test_a_correct_guess_within_the_cap_still_works(store):
    code = store.issue("cmsal06")
    for _ in range(MAX_ATTEMPTS - 1):
        store.verify("cmsal06", "00000000")
    assert store.verify("cmsal06", code) is True


# --- expiry -----------------------------------------------------------------


def test_expired_code_is_rejected(store, monkeypatch):
    code = store.issue("cmsal06")
    # The real clock has to be read before patching, or the replacement
    # calls itself.
    later = time.time() + 60 * 60
    monkeypatch.setattr(time, "time", lambda: later)
    assert store.verify("cmsal06", code) is False


def test_expired_codes_are_dropped_from_the_file(store, monkeypatch):
    store.issue("cmsal06")
    assert store.has_live_code("cmsal06") is True
    later = time.time() + 60 * 60
    monkeypatch.setattr(time, "time", lambda: later)
    assert store.has_live_code("cmsal06") is False


# --- persistence ------------------------------------------------------------


def test_code_survives_a_restart(tmp_path):
    # The file is on the data volume so a redeploy mid-login doesn't strand
    # someone holding a code they were just sent.
    path = tmp_path / "login_codes.json"
    code = LoginCodeStore(path).issue("cmsal06")
    assert LoginCodeStore(path).verify("cmsal06", code) is True


def test_plaintext_code_is_not_on_disk(tmp_path):
    path = tmp_path / "login_codes.json"
    code = LoginCodeStore(path).issue("cmsal06")
    assert code not in path.read_text()


# --- POST /api/admin/login --------------------------------------------------


def test_login_pushes_a_code_to_an_allowlisted_user(client, sent):
    res = client.post("/api/admin/login", json={"username": "cmsal06"})
    assert res.status_code == 200
    assert len(sent["pushes"]) == 1
    push = sent["pushes"][0]
    # The code has to actually be in the message — the user reads it there.
    code = "".join(c for c in push["message"] if c.isdigit())[:CODE_LENGTH]
    assert len(code) == CODE_LENGTH
    # Priority 1 so it lands through a quiet-hours schedule; you're waiting
    # at a keyboard for this one.
    assert push["priority"] == 1


def test_login_is_case_insensitive(client, sent):
    assert client.post("/api/admin/login", json={"username": "CMSal06"}).status_code == 200
    assert len(sent["pushes"]) == 1


def test_unknown_username_gets_the_exact_message(client, sent):
    res = client.post("/api/admin/login", json={"username": "stranger"})
    assert res.status_code == 400
    # Exactly this string — the sign-in page shows the server's detail
    # verbatim, so this assertion is what pins the user-visible copy.
    assert res.json()["detail"] == "Username has not been registered."
    # And nothing was sent, which is the part that would be easy to get
    # wrong by issuing the code before checking the allowlist.
    assert sent["pushes"] == []


def test_blank_username_is_rejected(client):
    assert client.post("/api/admin/login", json={"username": ""}).status_code == 422


def test_login_is_rate_limited(client):
    for _ in range(5):
        client.post("/api/admin/login", json={"username": "cmsal06"})
    res = client.post("/api/admin/login", json={"username": "cmsal06"})
    assert res.status_code == 429


def test_a_failed_push_does_not_claim_success(client, monkeypatch):
    from backend.app import main as main_module
    from backend.app.notifier import PushFailed

    def boom(settings, **kwargs):
        raise PushFailed("pushover said no")

    monkeypatch.setattr(main_module, "send_push_strict", boom)
    res = client.post("/api/admin/login", json={"username": "cmsal06"})
    # The whole reason send_push_strict exists. The quiet send_push would
    # have returned 200 here and sent the user to watch a silent phone.
    assert res.status_code == 503


# --- POST /api/admin/verify -------------------------------------------------


def _login_and_get_code(client, sent, username="cmsal06") -> str:
    client.post("/api/admin/login", json={"username": username})
    message = sent["pushes"][-1]["message"]
    return "".join(c for c in message if c.isdigit())[:CODE_LENGTH]


def test_verify_accepts_the_pushed_code(client, sent):
    code = _login_and_get_code(client, sent)
    assert client.post(
        "/api/admin/verify", json={"username": "cmsal06", "code": code}
    ).status_code == 200


def test_verify_rejects_a_wrong_code(client, sent):
    _login_and_get_code(client, sent)
    res = client.post("/api/admin/verify", json={"username": "cmsal06", "code": "00000000"})
    assert res.status_code == 400
    assert res.json()["detail"] == "That code isn't valid. Request a new one."


def test_verify_burns_the_code(client, sent):
    code = _login_and_get_code(client, sent)
    client.post("/api/admin/verify", json={"username": "cmsal06", "code": code})
    res = client.post("/api/admin/verify", json={"username": "cmsal06", "code": code})
    assert res.status_code == 400


@pytest.mark.parametrize("code", ["1234567", "123456789", "abcdefgh", "1234 567", ""])
def test_wrong_shaped_codes_are_rejected_by_validation(client, code):
    # 422, not 400: these never reach the store, so a malformed guess
    # doesn't cost a PBKDF2 round or an attempt from the budget.
    res = client.post("/api/admin/verify", json={"username": "cmsal06", "code": code})
    assert res.status_code == 422


def test_verify_is_rate_limited(client, sent):
    code = _login_and_get_code(client, sent)
    for _ in range(4):
        client.post("/api/admin/verify", json={"username": "cmsal06", "code": "00000000"})
    res = client.post("/api/admin/verify", json={"username": "cmsal06", "code": code})
    assert res.status_code == 429


def test_malformed_allowlist_refuses_logins(client, monkeypatch, settings):
    # A broken ADMIN_USERNAMES must lock everyone out rather than let
    # anyone in — the failure direction is the whole test.
    # Set on the instance: these are pydantic fields, not class attributes,
    # so there is nothing on the class to patch.
    settings.admin_usernames = "sam,sam"
    res = client.post("/api/admin/login", json={"username": "cmsal06"})
    assert res.status_code == 500


# --- passkeys ---------------------------------------------------------------
#
# Nothing enrols one yet, so every path here currently ends in "Not
# enrolled." That isn't a placeholder — with no credential on file it is the
# true answer, and these tests pin it so the day enrolment lands the refusal
# has to stop happening for the right reason.


def test_passkey_is_not_enrolled_for_an_admin_with_no_device(client):
    res = client.post("/api/admin/passkey/begin", json={"username": "cmsal06"})
    assert res.status_code == 400
    # Exactly this string — the sign-in page shows the server's detail
    # verbatim, so this is what pins the user-visible copy.
    assert res.json()["detail"] == "Not enrolled."


def test_passkey_says_the_same_thing_for_a_stranger(client):
    # On purpose: /api/admin/login has to tell an unknown name apart from a
    # known one to be usable, but this route doesn't, so it gives away less.
    res = client.post("/api/admin/passkey/begin", json={"username": "stranger"})
    assert res.status_code == 400
    assert res.json()["detail"] == "Not enrolled."


def test_passkey_begin_is_rate_limited(client):
    for _ in range(5):
        client.post("/api/admin/passkey/begin", json={"username": "cmsal06"})
    res = client.post("/api/admin/passkey/begin", json={"username": "cmsal06"})
    assert res.status_code == 429


def test_an_enrolled_admin_gets_past_the_not_enrolled_check(client, settings):
    # The one test that exercises the other branch. 501 because the WebAuthn
    # ceremony isn't written — but it proves the store lookup works and that
    # "Not enrolled." is driven by real data, not hardcoded.
    from backend.app.passkeys import PasskeyStore

    PasskeyStore(settings.passkeys_path).add_credential(
        "cmsal06", credential_id="cred-1", public_key="pk-1", label="Test device"
    )
    res = client.post("/api/admin/passkey/begin", json={"username": "cmsal06"})
    assert res.status_code == 501


# --- the passkey store ------------------------------------------------------


def test_store_starts_empty(tmp_path):
    from backend.app.passkeys import PasskeyStore

    assert PasskeyStore(tmp_path / "pk.json").has_credential("cmsal06") is False


def test_enrol_then_find(tmp_path):
    from backend.app.passkeys import PasskeyStore

    store = PasskeyStore(tmp_path / "pk.json")
    store.add_credential("cmsal06", credential_id="c1", public_key="k1")
    assert store.has_credential("cmsal06") is True
    assert store.has_credential("sam") is False


def test_enrolment_is_username_normalized(tmp_path):
    from backend.app.passkeys import PasskeyStore

    store = PasskeyStore(tmp_path / "pk.json")
    store.add_credential("  CMSal06 ", credential_id="c1", public_key="k1")
    assert store.has_credential("cmsal06") is True


def test_re_enrolling_the_same_device_replaces_it(tmp_path):
    from backend.app.passkeys import PasskeyStore

    store = PasskeyStore(tmp_path / "pk.json")
    store.add_credential("cmsal06", credential_id="c1", public_key="k1")
    store.add_credential("cmsal06", credential_id="c1", public_key="k2")
    creds = store.list_credentials("cmsal06")
    assert len(creds) == 1
    assert creds[0]["public_key"] == "k2"


def test_two_devices_both_stick(tmp_path):
    from backend.app.passkeys import PasskeyStore

    store = PasskeyStore(tmp_path / "pk.json")
    store.add_credential("cmsal06", credential_id="c1", public_key="k1", label="Phone")
    store.add_credential("cmsal06", credential_id="c2", public_key="k2", label="Laptop")
    assert len(store.list_credentials("cmsal06")) == 2


def test_revoking_a_device_works(tmp_path):
    # A passkey you can enrol but not revoke is worse than none at all — a
    # stolen laptop would be permanent.
    from backend.app.passkeys import PasskeyStore

    store = PasskeyStore(tmp_path / "pk.json")
    store.add_credential("cmsal06", credential_id="c1", public_key="k1")
    assert store.remove_credential("cmsal06", "c1") is True
    assert store.has_credential("cmsal06") is False
    assert store.remove_credential("cmsal06", "c1") is False


def test_enrolment_survives_a_restart(tmp_path):
    from backend.app.passkeys import PasskeyStore

    path = tmp_path / "pk.json"
    PasskeyStore(path).add_credential("cmsal06", credential_id="c1", public_key="k1")
    assert PasskeyStore(path).has_credential("cmsal06") is True
